import { expect, test } from '@playwright/test'
import { callFunction, createMockSale, QUICK_GAME, setChestOverrides } from '../integration/helpers'

// El juego real dura 50 s; para el e2e se usa una partida de 2 s sin enemigos (reglas en settings).
test.beforeAll(() => setChestOverrides(QUICK_GAME))
test.afterAll(() => setChestOverrides({}))

test('compra grande: regalo, cofre con juego, código y validación en caja', async ({ page }) => {
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

  // Desde el panel el premio está desbloqueado: hay que abrir el cofre.
  await page.getByRole('link', { name: 'Ir a mi panel' }).click()
  await expect(page.getByText('Desbloqueado')).toBeVisible()
  await page.getByRole('button', { name: 'Abrir cofre' }).click()
  await expect(page.getByRole('heading', { name: /abrí el cofre de tu un café/i })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir el cofre' }).click()

  // Menú inicial del juego y partida.
  await expect(page.getByRole('dialog', { name: 'Sobreviví a las migas' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Sobreviví 2 segundos')).toBeVisible()
  await page.getByRole('button', { name: '¡Jugar!' }).click()

  // El servidor reproduce la partida y recién entonces abre el cofre.
  await expect(page.getByRole('heading', { name: '¡Cofre abierto!' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Ver mi código' }).click()

  // Código con cuenta regresiva real.
  await expect(page.getByText('Tu código de canje')).toBeVisible()
  await expect(page.getByRole('timer')).toContainText(/Vence en 1[45]:\d\d/)
  const code = await page.locator('p[aria-label^="MIGA-"]').getAttribute('aria-label')
  expect(code).toMatch(/^MIGA-[A-Z2-9]{4}$/)

  // La caja valida el código (firmado con HMAC) y la pantalla del cliente lo nota sola.
  const validated = await callFunction('dev-pos-redeem', { code })
  expect(validated.body).toMatchObject({ valid: true })
  await expect(page.getByText(/disfrutá tu un café/i)).toBeVisible({ timeout: 10_000 })

  // Los puntos no se gastan: el saldo sigue en 160 y el próximo café es a los 300.
  await page.getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByText('160').first()).toBeVisible()
  await expect(page.getByText('Te faltan 140 puntos').first()).toBeVisible()
})
