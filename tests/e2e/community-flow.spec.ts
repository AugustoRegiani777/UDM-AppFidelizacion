import { expect, test } from '@playwright/test'
import { openAdminSession, signUp } from './support/session'

test('comunidad: el admin carga un lugar, un cliente da like y comenta, y propone otro que se aprueba', async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6)
  const loaded = `Pizzería Tango ${suffix}`
  const proposed = `Medialunas Gardel ${suffix}`

  // El administrador carga un lugar directamente.
  const { page: adminPage, context: adminContext } = await openAdminSession(browser)
  await adminPage.goto('/admin')
  await adminPage.getByLabel('Nombre del lugar').fill(loaded)
  await adminPage.getByRole('button', { name: 'Cargar lugar' }).click()
  await expect(adminPage.getByText('Lugar cargado.')).toBeVisible()

  // El cliente lo ve, le da like y comenta (suma puntos, de forma anónima).
  await signUp(page)
  await page.getByRole('link', { name: /Comunidad/ }).click()
  const card = page.locator('.rounded-card', { hasText: loaded })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Dar like' }).click()
  await expect(card.getByText('+1 punto')).toBeVisible()

  await card.getByRole('link', { name: loaded }).click()
  await page.getByPlaceholder('Contá tu experiencia…').fill('Una fugazzeta de diez')
  await page.getByRole('button', { name: 'Comentar' }).click()
  await expect(page.getByText('+3 puntos')).toBeVisible()
  await expect(page.getByText('Una fugazzeta de diez')).toBeVisible()
  await expect(page.getByText('Vos', { exact: true })).toBeVisible()

  // Propone un lugar nuevo: queda pendiente hasta que el admin lo apruebe.
  await page.getByRole('link', { name: 'Volver a la comunidad' }).click()
  await page.getByRole('button', { name: 'Sumar un lugar' }).click()
  await page.getByLabel('Nombre del lugar').fill(proposed)
  await page.getByRole('button', { name: 'Enviar para revisión' }).click()
  await expect(page.getByText(/Lo revisamos/)).toBeVisible()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.locator('.rounded-card', { hasText: proposed })).toHaveCount(0)

  await adminPage.reload()
  const pending = adminPage.locator('.rounded-card', { hasText: proposed })
  await expect(pending).toBeVisible()
  await pending.getByRole('button', { name: 'Aprobar' }).click()
  await expect(pending).toHaveCount(0)
  await adminContext.close()

  // El cliente ve el lugar aprobado y sus puntos: 1 (like) + 3 (comentario) + 30 (lugar) = 34.
  await page.reload()
  await expect(page.locator('.rounded-card', { hasText: proposed })).toBeVisible()
  await page.getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByText('34').first()).toBeVisible()
})
