import { devices, expect, type Browser, type Page } from '@playwright/test'
import { admin } from '../../integration/helpers'

/** Registra un cliente nuevo con el login por email de desarrollo y lo deja en su panel. */
export async function signUp(page: Page, email = `e2e-${crypto.randomUUID()}@test.local`) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
  await expect(page.getByText('Tu primera compra suma puntos')).toBeVisible({ timeout: 20_000 })
  return email
}

export async function makeAdmin(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error('usuario no encontrado')
  await admin.from('profiles').update({ is_admin: true }).eq('id', user.id)
}

/** Segunda sesión de navegador (otro dispositivo) ya registrada como administrador. */
export async function openAdminSession(browser: Browser) {
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    baseURL: 'http://localhost:5173',
  })
  const page = await context.newPage()
  const email = await signUp(page)
  await makeAdmin(email)
  return { page, context }
}
