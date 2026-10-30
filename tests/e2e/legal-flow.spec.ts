import { expect, test } from '@playwright/test'
import { admin } from '../integration/helpers'
import { acceptLegal, signUp } from './support/session'

const PUBLIC_PAGES = [
  { path: '/aviso-legal', title: 'Aviso legal' },
  { path: '/privacidad', title: 'Política de privacidad' },
  { path: '/cookies', title: 'Política de cookies y almacenamiento local' },
  { path: '/bases', title: 'Bases y condiciones del programa de fidelización' },
  { path: '/normas', title: 'Normas de la comunidad' },
]

test('las páginas legales cargan sin sesión, con versión y fecha, y enlazan entre sí', async ({
  page,
}) => {
  for (const { path, title } of PUBLIC_PAGES) {
    await page.goto(path)
    // Sin sesión no hay redirección al login: la URL queda donde se pidió.
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByText(/Versión \d{4}-\d{2}-\d{2}/)).toBeVisible()
    await expect(page.getByText(/Última actualización:/)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
  }
  // Navegación por el pie de página.
  await page.goto('/privacidad')
  await page
    .getByRole('navigation', { name: 'Información legal' })
    .getByRole('link', { name: 'Bases del programa' })
    .click()
  await expect(page).toHaveURL(/\/bases$/)
})

test('la portada y el login tienen el pie legal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
  await page.goto('/login')
  await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
})

test('onboarding: casillas desmarcadas, no avanza sin las obligatorias y deja prueba en el servidor', async ({
  page,
}) => {
  const email = `e2e-${crypto.randomUUID()}@test.local`
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()

  const submit = page.getByRole('button', { name: 'Empezar a sumar' })
  const adult = page.getByRole('checkbox', { name: /18 años o más/i })
  const privacy = page.getByRole('checkbox', { name: /política de privacidad/i })
  const terms = page.getByRole('checkbox', { name: /bases del programa/i })
  const promo = page.getByRole('checkbox', { name: /novedades y promos/i })

  for (const box of [adult, privacy, terms, promo]) await expect(box).not.toBeChecked()
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Para continuar necesitamos que marques:')).toBeVisible()

  await adult.check()
  await privacy.check()
  await expect(submit).toBeDisabled()
  await expect(page.getByText(/aceptás las Bases del programa y las Normas/)).toBeVisible()

  await terms.check()
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByText('Tu primera compra suma puntos')).toBeVisible({ timeout: 20_000 })

  // Prueba de consentimiento guardada por el servidor, con la promo opcional sin marcar.
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const id = data.users.find((u) => u.email === email)!.id
  const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single()
  expect(profile?.adult_confirmed_at).not.toBeNull()
  expect(profile?.privacy_accepted_at).not.toBeNull()
  expect(profile?.terms_accepted_at).not.toBeNull()
  expect(profile?.legal_version).toBe('2026-11-01')
  expect(profile?.promo_consent).toBe(false)
})

test('si sube la versión legal hay que volver a aceptar, sin perder nada', async ({ page }) => {
  await signUp(page)
  const original = await admin.from('settings').select('value').eq('key', 'legal').single()
  try {
    await admin
      .from('settings')
      .update({ value: { version: '2099-01-01' } })
      .eq('key', 'legal')
    await page.goto('/panel')
    await expect(page).toHaveURL(/\/bienvenida$/)
    await expect(page.getByText('Actualizamos nuestros textos legales')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aceptar y continuar' })).toBeDisabled()
    await acceptLegal(page)
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click()
    await expect(page.getByText('Tu primera compra suma puntos')).toBeVisible({ timeout: 20_000 })
  } finally {
    await admin.from('settings').update({ value: original.data!.value }).eq('key', 'legal')
  }
})

test('perfil: descarga de datos y borrado de cuenta con explicación clara', async ({ page }) => {
  await signUp(page)
  await page.goto('/perfil')
  await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar mis datos' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^mis-datos-uno-de-miga-\d{4}-\d{2}-\d{2}\.json$/)

  await page.getByRole('button', { name: 'Borrar mi cuenta y mis datos' }).click()
  await expect(page.getByText(/Lo que se conserva/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'No, mantener mi cuenta' })).toBeVisible()
})
