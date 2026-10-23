import { expect, test } from '@playwright/test'
import { callFunction, createMockSale } from '../integration/helpers'

test('compra grande: el regalo se abre, se canjea y la caja valida el código', async ({ page }) => {
  const sale = await createMockSale({ total_cents: 16000 })

  await page.goto(`/s/${sale}`)
  await page.getByLabel('Email').fill(`e2e-${crypto.randomUUID()}@test.local`)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()

  await expect(page.getByText('¡Sumaste 160 puntos!')).toBeVisible({ timeout: 20_000 })

  // El popup de premio se abre solo y se puede cerrar con la X.
  const popup = page.getByRole('dialog')
  await expect(popup.getByText(/un café va por la casa/i)).toBeVisible({ timeout: 10_000 })
  await popup.getByRole('button', { name: 'Cerrar' }).click()
  await expect(popup).toBeHidden()

  // Desde el panel el premio está desbloqueado.
  await page.getByRole('link', { name: 'Ir a mi panel' }).click()
  await expect(page.getByText('Desbloqueado')).toBeVisible()
  await page.getByRole('button', { name: 'Canjear' }).click()

  // Código con cuenta regresiva real.
  await expect(page.getByText('Tu código de canje')).toBeVisible()
  await expect(page.getByRole('timer')).toContainText(/Vence en 1[45]:\d\d/)
  const code = await page.locator('p[aria-label^="MIGA-"]').getAttribute('aria-label')
  expect(code).toMatch(/^MIGA-[A-Z2-9]{4}$/)

  // La caja valida el código (firmado con HMAC) y la pantalla del cliente lo nota sola.
  const validated = await callFunction('dev-pos-redeem', { code })
  expect(validated.body).toMatchObject({ valid: true })
  await expect(page.getByText(/disfrutá tu un café/i)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByText('Te faltan 140 puntos')).toBeVisible()
})
