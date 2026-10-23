import { devices, expect, test, type Page } from '@playwright/test'
import { admin } from '../integration/helpers'

async function signUp(page: Page, email: string) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
  await page.getByText('Tu primera compra suma puntos').waitFor({ timeout: 20_000 })
}

async function makeAdmin(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error('usuario no encontrado')
  await admin.from('profiles').update({ is_admin: true }).eq('id', user.id)
}

test('misiones: Instagram suma al instante, la reseña la aprueba el admin', async ({
  page,
  browser,
}) => {
  const customerEmail = `cliente-${crypto.randomUUID()}@test.local`
  const googleName = `Lu ${crypto.randomUUID().slice(0, 8)}`
  await signUp(page, customerEmail)

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
  const adminContext = await browser.newContext({
    ...devices['Pixel 5'],
    baseURL: 'http://localhost:5173',
  })
  const adminPage = await adminContext.newPage()
  const adminEmail = `admin-${crypto.randomUUID()}@test.local`
  await signUp(adminPage, adminEmail)
  await makeAdmin(adminEmail)
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
