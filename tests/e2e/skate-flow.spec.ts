import { expect, test } from '@playwright/test'
import {
  configureChest,
  createMockSale,
  QUICK_SKATE,
  resetChestConfig,
} from '../integration/helpers'

// El skate se juega en horizontal. Para el e2e el circuito se recorta (se completa rodando en pocos segundos).
test.use({ viewport: { width: 844, height: 390 } })
test.beforeAll(() => configureChest('skate', QUICK_SKATE))
test.afterAll(() => resetChestConfig())

test('cofre con skate: se juega en horizontal y al llegar a la meta sale el código', async ({
  page,
}) => {
  const sale = await createMockSale({ total_cents: 4000 })
  await page.goto(`/s/${sale}`)
  await page.getByLabel('Email').fill(`e2e-${crypto.randomUUID()}@test.local`)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
  await expect(page.getByText('¡Sumaste 400 puntos!')).toBeVisible({ timeout: 20_000 })

  const popup = page.getByRole('dialog')
  await expect(popup.getByText(/un café va por la casa/i)).toBeVisible({ timeout: 10_000 })
  await popup.getByRole('button', { name: 'Abrir cofre' }).click({ force: true })
  await page.getByRole('button', { name: 'Abrir el cofre' }).click()

  // Menú inicial con la guía de los dos pulgares.
  const menu = page.getByRole('dialog', { name: 'Skate de Miga' })
  await expect(menu).toBeVisible({ timeout: 15_000 })
  await expect(menu.getByText(/pulgar derecho/i)).toBeVisible()
  await menu.getByRole('button', { name: '¡A rodar!' }).click()

  // El servidor reproduce la partida y recién entonces abre el cofre.
  await expect(page.getByRole('heading', { name: '¡Cofre abierto!' })).toBeVisible({
    timeout: 40_000,
  })
  await page.getByRole('button', { name: 'Ver mi código' }).click()
  await expect(page.getByText('Tu código de canje')).toBeVisible()
})
