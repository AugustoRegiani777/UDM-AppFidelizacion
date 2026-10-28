import { expect, test } from '@playwright/test'
import { join } from 'node:path'
import { admin } from '../integration/helpers'
import { writeQrVideo } from './support/fake-camera'

// uuid fijo: el QR de la cámara falsa se genera antes de abrir el navegador.
const SALE_UUID = '00000000-0000-4000-8000-0000000000aa'
const VIDEO = join(import.meta.dirname, '.fake-camera', 'sale-qr.y4m')
writeQrVideo(VIDEO, `http://localhost:5173/s/${SALE_UUID}`)

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
})

test('el escáner interno lee el QR de la caja y suma la compra', async ({ page }) => {
  await admin.from('claims').delete().eq('sale_uuid', SALE_UUID)
  await admin.from('dev_mock_sales').delete().eq('uuid', SALE_UUID)
  await admin.from('dev_mock_sales').insert({ uuid: SALE_UUID, total_cents: 6200 })

  await page.goto('/')
  await page.getByLabel('Email').fill(`e2e-${crypto.randomUUID()}@test.local`)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()

  await expect(page.getByText('Tu primera compra suma puntos')).toBeVisible()
  await page.getByRole('link', { name: 'Escanear mi compra' }).click()

  // Antes de pedir la cámara se explica para qué.
  await expect(page.getByText(/no sacamos ni guardamos fotos/i)).toBeVisible()
  await page.getByRole('button', { name: 'Activar cámara' }).click()

  await expect(page).toHaveURL(new RegExp(`/s/${SALE_UUID}`), { timeout: 20_000 })
  await expect(page.getByText('¡Sumaste 620 puntos!')).toBeVisible()

  await page.getByRole('link', { name: 'Ir a mi panel' }).click()
  await expect(page.getByText('Te faltan 180 puntos').first()).toBeVisible()
  await expect(page.getByText('+62').first()).toBeVisible()

  await page.getByRole('link', { name: 'Ver todo el historial' }).click()
  await expect(page.getByRole('heading', { name: 'Historial de puntos' })).toBeVisible()
  await expect(page.getByText('Compra', { exact: true })).toBeVisible()
})
