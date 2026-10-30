import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { acceptLegal, signUp } from './support/session'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

test('un invitado ve "Guardar mi progreso con Google" y su sesión sobrevive a recargar', async ({
  page,
}) => {
  // Sesión de invitado real (cuenta anónima de Supabase local), puesta como la guarda la app.
  const { data, error } = await createClient(URL, ANON_KEY, {
    auth: { persistSession: false },
  }).auth.signInAnonymously()
  expect(error).toBeNull()
  await page.addInitScript(
    ([key, session]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, session)
    },
    ['sb-localhost-auth-token', JSON.stringify(data.session)],
  )

  await page.goto('/panel')
  await acceptLegal(page)
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
  await expect(page.getByRole('link', { name: /guardá tu progreso con google/i })).toBeVisible({
    timeout: 20_000,
  })

  await page.goto('/perfil')
  await expect(page.getByRole('button', { name: 'Guardar mi progreso con Google' })).toBeVisible()
  await expect(page.getByText(/no vas a poder volver a abrir esta cuenta/i)).toBeVisible()

  // La sesión persiste: recargar no pide entrar de nuevo ni pierde la cuenta.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Guardar mi progreso con Google' })).toBeVisible()
})

test('quien entra con una cuenta normal no ve el botón de guardar progreso', async ({ page }) => {
  await signUp(page)
  await page.goto('/perfil')
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar mi progreso con Google' })).toHaveCount(0)
})
