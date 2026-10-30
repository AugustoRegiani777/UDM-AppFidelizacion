import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

// El navegador de las pruebas no tiene GPU: el 3D corre lento. Por eso los margenes largos.
test.setTimeout(120_000)
// Pantalla chica y sin densidad extra: el dibujo por software es mucho mas liviano.
test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 })

test('Miga Skate: spots bloqueados, canvas WebGL, un ollie con el dedo y se puede salir', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /Miga Skate/ }).click()
  await expect(page.getByText('Sacá una estrella en el spot anterior para abrirlo')).toHaveCount(4)
  await page.getByRole('button', { name: /La plaza de la miga/ }).click()

  // El parque 3D se carga recien aca (three.js va en su propio paquete) y el menu de inicio aparece.
  const menu = page.getByRole('dialog', { name: 'Miga Skate' })
  await expect(menu.getByRole('button', { name: '¡A patinar!' })).toBeVisible({ timeout: 30_000 })

  const canvas = page.getByTestId('skate-canvas')
  await expect(canvas).toBeVisible()
  const hasWebgl = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  })
  expect(hasWebgl).toBe(true)

  await menu.getByRole('button', { name: '¡A patinar!' }).click()
  await expect(page.getByRole('timer', { name: 'Tiempo que falta' })).toBeVisible()

  // Ollie: dedo sobre la cola de la tabla y deslizar hacia arriba.
  const pad = page.getByTestId('skate-pad')
  const box = (await pad.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const scale = Math.min(box.width, box.height) / 2
  await page.waitForTimeout(600)
  await page.mouse.move(cx, cy + 0.6 * scale)
  await page.mouse.down()
  await page.mouse.move(cx, cy + 0.2 * scale, { steps: 4 })
  await page.mouse.move(cx, cy - 0.3 * scale, { steps: 4 })
  await page.mouse.up()

  // Un ollie aterrizado suma un truco y, pasado el tiempo de gracia, cobra el combo: sube el puntaje.
  await expect
    .poll(async () => Number(await page.getByTestId('skate-score').innerText()), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Pausa' }).click()
  const pause = page.getByRole('dialog', { name: 'Pausa' })
  await expect(pause).toBeVisible()
  await pause.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Miga Skate' })).toBeVisible()
})
