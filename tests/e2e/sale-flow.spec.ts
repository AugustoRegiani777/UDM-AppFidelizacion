import { expect, test, type Page } from '@playwright/test'
import { createMockSale } from '../integration/helpers'

/** Entra con el login por email de desarrollo (Supabase local crea el usuario si no existe). */
async function signInDev(page: Page) {
  const email = `e2e-${crypto.randomUUID()}@test.local`
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
}

async function acceptWelcome(page: Page) {
  await expect(page.getByRole('heading', { name: /bienvenido a la miga/i })).toBeVisible()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
}

test('escanear el QR sin sesión: login, bienvenida y compra sumada sin perder el uuid', async ({
  page,
}) => {
  const sale = await createMockSale({ total_cents: 6200 })

  await page.goto(`/s/${sale}`)
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(/ya la guardamos/i)).toBeVisible()

  await signInDev(page)
  await acceptWelcome(page)

  await expect(page).toHaveURL(new RegExp(`/s/${sale}`))
  await expect(page.getByText('¡Sumaste 62 puntos!')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Esta compra ya estaba sumada')).toBeVisible()
})

test('una venta de Glovo se explica con amabilidad y no suma', async ({ page }) => {
  const sale = await createMockSale({ total_cents: 3000, channel: 'glovo' })

  await page.goto(`/s/${sale}`)
  await signInDev(page)
  await acceptWelcome(page)

  await expect(page.getByText(/glovo y too good to go no suman puntos/i)).toBeVisible()
})

test('una venta que el POS todavía no conoce queda pendiente y se acredita sola', async ({
  page,
}) => {
  const sale = await createMockSale({ total_cents: 2000, appears_in_seconds: 4 })

  await page.goto(`/s/${sale}`)
  await signInDev(page)
  await acceptWelcome(page)

  await expect(page.getByText('Tu compra todavía no llegó')).toBeVisible()
  // La pantalla vuelve a consultar sola cada 10 s y celebra cuando aparece.
  await expect(page.getByText('¡Sumaste 20 puntos!')).toBeVisible({ timeout: 25_000 })
})

test('la portada funciona como punto de entrada (QR fijo / NFC)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /cada miga suma/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible()
  await expect(page.getByText('Así funciona')).toBeVisible()
})
