import { expect, test } from '@playwright/test'
import { openAdminSession, signUp } from './support/session'

test('misiones: Instagram suma al instante, la reseña la aprueba el admin', async ({
  page,
  browser,
}) => {
  const googleName = `Lu ${crypto.randomUUID().slice(0, 8)}`
  await signUp(page)

  await page.getByRole('link', { name: /Puntos extra/ }).click()
  await expect(page.getByRole('heading', { name: 'Ganá más puntos' })).toBeVisible()

  // Instagram: sin verificación, una sola vez.
  await page.getByRole('button', { name: 'Ya lo seguí' }).click()
  await expect(page.getByText('¡Puntos sumados!')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ya lo seguí' })).toHaveCount(0)

  // Reseña de Google: queda en revisión.
  await page.getByLabel(/tu nombre en google/i).fill(googleName)
  await page.getByRole('button', { name: 'Ya dejé mi reseña' }).click()
  await expect(page.getByText(/en revisión/i)).toBeVisible()

  // El admin la ve con el nombre y la aprueba.
  const { page: adminPage, context: adminContext } = await openAdminSession(browser)
  await adminPage.goto('/admin')
  await expect(adminPage.getByRole('heading', { name: 'Administración' })).toBeVisible()
  const card = adminPage.locator('.rounded-card', { hasText: googleName })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Aprobar' }).click()
  await expect(card).toHaveCount(0)
  await adminContext.close()

  // El cliente ve sus puntos: 15 (Instagram) + 50 (reseña) = 65.
  await page.goto('/misiones')
  await expect(page.getByText('¡Puntos sumados!')).toHaveCount(2)
  await page.getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByText('65').first()).toBeVisible()
})

test('un cliente común no entra al panel de administración', async ({ page }) => {
  await signUp(page, `cliente-${crypto.randomUUID()}@test.local`)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/panel/)
})
