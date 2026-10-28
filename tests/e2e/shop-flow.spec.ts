import { expect, test } from '@playwright/test'
import { admin } from '../integration/helpers'
import { signUp } from './support/session'

test('tienda: mejora de personaje y premio del local con código, sin atrasar los escalones', async ({
  page,
}) => {
  const email = await signUp(page)
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const id = data.users.find((u) => u.email === email)!.id
  await admin.from('point_movements').insert({ customer_id: id, kind: 'adjustment', points: 700 })

  await page.goto('/tienda')
  await expect(page.getByText('700 puntos para gastar')).toBeVisible({ timeout: 15_000 })

  // Mejora: corazón extra (300 puntos el nivel 1).
  await page.getByRole('button', { name: /Subir de nivel Corazón extra, 300 puntos/ }).click()
  await expect(page.getByText('Corazón extra: nivel 1')).toBeVisible()
  await expect(page.getByText('400 puntos para gastar')).toBeVisible()
  await expect(page.getByText('Nivel 1 de 3')).toBeVisible()

  // Premio del local con código para el mostrador.
  await page.getByRole('tab', { name: 'Premios del local' }).click()
  await page.getByRole('button', { name: /Comprar Un chipá, 150 puntos/ }).click()
  await expect(page.getByText('Tu código para el mostrador:')).toBeVisible()
  await expect(page.getByText('250 puntos para gastar')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tus códigos' })).toBeVisible()
  await expect(page.getByText('Para usar')).toBeVisible()

  // En el panel el saldo total sigue en 700: los escalones de comida no se atrasan.
  await page.goto('/panel')
  await expect(page.getByText('700').first()).toBeVisible()
})
