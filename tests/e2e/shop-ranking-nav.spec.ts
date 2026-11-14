import { expect, test } from '@playwright/test'
import { admin } from '../integration/helpers'
import { signUp } from './support/session'

test('ranking: un selector con todos los juegos, progreso no oficial, y Volver lleva al menú', async ({
  page,
}) => {
  const email = await signUp(page)
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const id = data.users.find((u) => u.email === email)!.id
  await admin.from('game_scores').upsert({ customer_id: id, game: 'ninja', score: 17 })
  await admin.from('point_movements').insert({ customer_id: id, kind: 'purchase', points: 700 })

  await page.goto('/ranking')
  for (const name of ['Sobreviví', 'Racers', 'Skate Spot', 'Entregas', 'Ninja', 'Puntos']) {
    await expect(page.getByRole('tab', { name })).toBeVisible()
  }
  await page.getByRole('tab', { name: 'Ninja' }).click()
  await expect(page.getByText('· Vos')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Estás en el puesto 1 con 17 estrellas/)).toBeVisible()
  await expect(page.getByText(/Ranking no oficial/)).toBeVisible()
  await page.screenshot({ path: 'tmp-shots/after-ranking.png', fullPage: true })

  await page.getByRole('tab', { name: 'Puntos' }).click()
  await expect(page.getByText('· Vos')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('link', { name: 'Volver al menú' }).click()
  await expect(page).toHaveURL(/\/panel$/)
})

test('tienda: Volver lleva al menú, explica qué se paga con qué y avisa lo que falta', async ({
  page,
}) => {
  const email = await signUp(page)
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const id = data.users.find((u) => u.email === email)!.id
  await admin.from('point_movements').insert({ customer_id: id, kind: 'adjustment', points: 200 })

  await page.goto('/tienda')
  await expect(page.getByText(/Tenés 200 puntos de tienda para gastar/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Puntos de tienda: los ganás con tus compras/)).toBeVisible()
  await expect(page.getByText(/Te faltan 100 puntos/)).toBeVisible()
  await page.screenshot({ path: 'tmp-shots/after-tienda.png', fullPage: true })

  await page.getByRole('tab', { name: 'Pases' }).click()
  await expect(page.getByText(/Los pases se pagan con monedas/)).toBeVisible()
  await expect(page.getByText(/Te faltan 80 monedas/)).toBeVisible()

  await page.getByRole('link', { name: 'Volver al menú' }).click()
  await expect(page).toHaveURL(/\/panel$/)
})
