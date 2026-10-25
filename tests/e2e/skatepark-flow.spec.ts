import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

test('Skate Spot: niveles bloqueados, se juega con el teclado y se puede pausar', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  // El skate se juega en horizontal: se gira el celular después de registrarse.
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: /Skate Spot/ }).click()
  await expect(page.getByText('Sacá una estrella en el nivel anterior para abrirlo')).toHaveCount(4)
  await page.getByRole('button', { name: /Nivel 1/ }).click()

  const menu = page.getByRole('dialog', { name: 'Skate Spot' })
  await expect(menu.getByText('La plaza')).toBeVisible()
  await menu.getByRole('button', { name: '¡A patinar!' }).click()
  await expect(page.getByRole('timer', { name: 'Tiempo que falta' })).toBeVisible()

  // Turbo: el pulgar izquierdo (acá, una flecha) en el suelo. La barra baja y sale el cartel.
  const turbo = page.getByRole('meter', { name: 'TURBO' })
  await expect(turbo).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'C:/Users/NOTRUL~1/AppData/Local/Temp/park-turbo.png' })
  await expect.poll(async () => Number(await turbo.getAttribute('aria-valuenow'))).toBeLessThan(90)
  await page.keyboard.up('ArrowRight')

  // Rueda un rato y salta una vez (espacio = botón derecho) con un truco en el aire.
  await page.waitForTimeout(1500)
  await page.keyboard.down(' ')
  await page.waitForTimeout(300)
  await page.keyboard.up(' ')
  await page.waitForTimeout(250)
  await page.keyboard.down(' ')
  await page.waitForTimeout(80)
  await page.keyboard.up(' ')
  await page.waitForTimeout(150)
  await page.screenshot({ path: 'C:/Users/NOTRUL~1/AppData/Local/Temp/park1.png' })

  await page.getByRole('button', { name: 'Pausa' }).click()
  const pause = page.getByRole('dialog', { name: 'Pausa' })
  await expect(pause).toBeVisible()
  await pause.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Skate Spot' })).toBeVisible()
})
