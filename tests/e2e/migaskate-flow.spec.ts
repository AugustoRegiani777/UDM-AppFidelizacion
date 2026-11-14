import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

// El navegador de las pruebas no tiene GPU: el 3D corre lento. Por eso los margenes largos y las esperas
// por condicion (nunca por tiempo fijo).
test.setTimeout(240_000)
// Pantalla chica y sin densidad extra: el dibujo por software es mucho mas liviano.
test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 })

// Version 3D fuera del menu de la sala de juegos (se conserva el codigo). Reactivar al volver a mostrarla.
test.skip('Miga Skate 3D: spots bloqueados, canvas WebGL, tutorial, un ollie con el dedo y se puede salir', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /Miga Skate/ }).click()
  await expect(page.getByText('Sacá una estrella en el spot anterior para abrirlo')).toHaveCount(4)
  await page.getByRole('button', { name: /La plaza de la miga/ }).click()

  // El parque 3D se carga recien aca (three.js va en su propio paquete) y el menu de inicio aparece.
  const menu = page.getByRole('dialog', { name: 'Miga Skate' })
  await expect(menu.getByRole('button', { name: '¡A patinar!' })).toBeVisible({ timeout: 60_000 })

  const canvas = page.getByTestId('skate-canvas')
  await expect(canvas).toBeVisible()
  const hasWebgl = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  })
  expect(hasWebgl).toBe(true)

  // Modo zurdo: se puede prender y se recuerda.
  const lefty = menu.getByLabel('Modo zurdo (invierte los controles)')
  await lefty.check()
  await expect(lefty).toBeChecked()
  await lefty.uncheck()

  await menu.getByRole('button', { name: '¡A patinar!' }).click()
  await expect(page.getByRole('timer', { name: 'Tiempo que falta' })).toBeVisible()

  // La primera vez hay un tutorial corto e interactivo: el primer paso es el ollie.
  const tutorial = page.getByTestId('skate-tutorial')
  await expect(tutorial).toContainText('Paso 1 de 3')
  await expect(tutorial).toContainText('cola de la tabla')

  // Ollie: dedo sobre la cola de la tabla y deslizar hacia arriba. En un navegador sin GPU el primer
  // cuadro tarda: se reintenta (solo cuando el skater esta en el suelo) hasta que el paso se cumple.
  const pad = page.getByTestId('skate-pad')
  const box = (await pad.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const scale = Math.min(box.width, box.height) / 2
  const state = () => page.locator('[data-skate-state]').getAttribute('data-skate-state')
  const ollie = async () => {
    await page.mouse.move(cx, cy + 0.7 * scale)
    await page.mouse.down()
    await page.mouse.move(cx, cy + 0.3 * scale, { steps: 4 })
    await page.mouse.move(cx, cy - 0.3 * scale, { steps: 4 })
    await page.mouse.up()
  }
  await expect
    .poll(
      async () => {
        if ((await tutorial.textContent())?.includes('Paso 2 de 3')) return true
        if ((await state()) === 'grounded') await ollie()
        return false
      },
      { timeout: 120_000, intervals: [2_000] },
    )
    .toBe(true)

  // Un ollie aterrizado suma un truco y, pasado el tiempo de gracia, cobra el combo: sube el puntaje.
  await expect
    .poll(async () => Number(await page.getByTestId('skate-score').innerText()), {
      timeout: 120_000,
    })
    .toBeGreaterThan(0)

  // El tutorial se puede saltear y no vuelve.
  await tutorial.getByRole('button', { name: 'Saltear' }).click()
  await expect(tutorial).toHaveCount(0)

  await page.getByRole('button', { name: 'Pausa' }).click()
  const pause = page.getByRole('dialog', { name: 'Pausa' })
  await expect(pause).toBeVisible()
  await pause.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Miga Skate' })).toBeVisible()
})
