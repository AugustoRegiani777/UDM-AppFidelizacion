import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

test('Miga Ninja: se abre el nivel 1, un tajo con el mouse suma puntos, pausa y salida', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /^Miga Ninja/ }).click()
  await expect(page.getByRole('heading', { name: 'Miga Ninja' })).toBeVisible()
  // Solo el primer nivel está abierto.
  await expect(page.getByText('Pasá el nivel anterior para abrirlo')).toHaveCount(9)
  await page.getByRole('button', { name: /El mostrador/ }).click()

  const intro = page.getByRole('dialog', { name: 'El mostrador' })
  await expect(intro.getByText('Objetivo: 150 puntos')).toBeVisible()
  await intro.getByRole('button', { name: '¡A cortar!' }).click()

  const score = page.getByRole('status')
  await expect(score).toHaveText('0 pts')

  // Se tira tajo tras tajo, de lado a lado y a distintas alturas, hasta que algo se corta.
  const size = page.viewportSize()!
  const x0 = size.width * 0.05
  const x1 = size.width * 0.95
  let cut = false
  for (let round = 0; round < 30 && !cut; round++) {
    for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const y = size.height * f
      await page.mouse.move(x0, y)
      await page.mouse.down()
      await page.mouse.move(x1, y + 10, { steps: 14 })
      await page.mouse.up()
    }
    cut = (await score.innerText()) !== '0 pts'
  }
  await expect(score).toHaveText(/^[1-9]\d* pts$/)

  // Pausa y seguir.
  await page.getByRole('button', { name: 'Pausa' }).click()
  const paused = page.getByRole('dialog', { name: 'Pausa' })
  await expect(paused).toBeVisible()
  await paused.getByRole('button', { name: 'Seguir' }).click()
  await expect(paused).toBeHidden()

  // Salir vuelve a la lista de niveles.
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Miga Ninja' })).toBeVisible()
})
