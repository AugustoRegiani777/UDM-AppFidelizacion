import { expect, test, type Page } from '@playwright/test'
import { signUp } from './support/session'

// El navegador de las pruebas no tiene GPU: el 3D corre a pocos cuadros por segundo. Márgenes largos
// y esperas por condición, nunca por tiempo fijo.
test.setTimeout(420_000)
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
})

type RallyHook = {
  sim: {
    state: string
    totalLaps: number
    track: { id: string; name: string }
    player: {
      idx: number
      x: number
      z: number
      heading: number
      vx: number
      vz: number
      lapsDone: number
      maxLap: number
    }
  }
  trackId: string
  tp: { x: number; z: number }[]
  tan: { x: number; z: number }[]
  stats: { calls: number; triangles: number }
}
type W = Window & { __rally: RallyHook }

async function openRally(page: Page) {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /Rally de Cocina/ }).click()
  const menu = page.getByRole('dialog', { name: 'Rally de Cocina' })
  // three.js va en su propio paquete: la primera carga tarda.
  await expect(menu.getByTestId('rally-start')).toBeVisible({ timeout: 120_000 })
  return menu
}

test('Rally de Cocina: elegir otra pista, correr, ver su nombre en el HUD y en los resultados, y abrir la siguiente', async ({
  page,
}) => {
  // Récord viejo (de cuando había una sola pista) y una carrera corta para que el resultado salga rápido.
  await page.addInitScript(() => {
    if (localStorage.getItem('rdc:e2e-seeded')) return
    localStorage.setItem('rdc:e2e-seeded', '1')
    localStorage.setItem('rdc:best:chispa', '21.5')
    localStorage.setItem('rdc:laps', '3')
    localStorage.setItem('rdc:rivals', '2')
  })
  const menu = await openRally(page)

  // El récord viejo pasó a la Cocina.
  await expect(menu.getByText('Tu mejor vuelta con Chispa en La Cocina: 0:21.50')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('rdc:best:cocina:chispa'))).toBe('21.5')

  // Selector: una tarjeta por pista; las dos primeras abiertas y las demás con candado.
  const grid = menu.getByTestId('rally-tracks')
  await expect(grid.locator('.track-card')).toHaveCount(7)
  await expect(menu.getByTestId('rally-track-cocina')).toHaveAttribute('aria-checked', 'true')
  await expect(menu.getByTestId('rally-track-terraza')).toBeEnabled()
  for (const id of ['obrador', 'barra', 'vitrina', 'harina', 'fallas'])
    await expect(menu.getByTestId(`rally-track-${id}`)).toBeDisabled()
  await expect(menu.getByTestId('rally-track-harina')).toHaveAttribute(
    'aria-label',
    /Subí al podio en La Vitrina/,
  )
  await expect(menu.getByTestId('rally-track-harina').locator('svg').first()).toBeVisible() // dibujo del trazado
  await expect(menu.getByTestId('rally-eyebrow')).toContainText('Pista 1 · La Cocina')

  // Elegir La Terraza cambia el mundo, el récord mostrado y el texto de arriba.
  await menu.getByTestId('rally-track-terraza').click()
  await expect(menu.getByTestId('rally-track-terraza')).toHaveAttribute('aria-checked', 'true')
  await expect(menu.getByTestId('rally-eyebrow')).toContainText('Pista 2 · La Terraza')
  await expect(menu.getByText('Todavía no tenés récord con Chispa en La Terraza.')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as W).__rally.trackId))
    .toBe('terraza')

  // Correr: el HUD muestra la pista elegida y el mundo la dibuja.
  await menu.getByTestId('rally-start').click()
  const root = page.getByTestId('rally-root')
  await expect(root).toHaveAttribute('data-state', 'countdown', { timeout: 60_000 })
  await expect(root).toHaveAttribute('data-state', 'race', { timeout: 180_000 })
  await expect(page.getByTestId('rally-hud-track')).toHaveText('La Terraza')
  await expect(page.getByTestId('rally-lap')).toHaveText('1/3')
  const info = await page.evaluate(() => ({
    id: (window as unknown as W).__rally.sim.track.id,
    calls: (window as unknown as W).__rally.stats.calls,
  }))
  expect(info.id).toBe('terraza')
  expect(info.calls).toBeGreaterThan(5)
  expect(info.calls).toBeLessThan(200) // presupuesto de dibujo

  // Cruzar la meta en primer lugar: resultados con el nombre de la pista, récord y pista nueva abierta.
  await page.evaluate(() => {
    const r = (window as unknown as W).__rally
    const p = r.sim.player
    const i = r.tp.length - 4
    p.idx = i
    p.x = r.tp[i]!.x
    p.z = r.tp[i]!.z
    p.heading = Math.atan2(r.tan[i]!.x, r.tan[i]!.z)
    p.vx = r.tan[i]!.x * 20
    p.vz = r.tan[i]!.z * 20
    p.lapsDone = r.sim.totalLaps - 1
    p.maxLap = p.lapsDone
  })
  const results = page.getByRole('dialog', { name: 'Resultados' })
  await expect(results).toBeVisible({ timeout: 180_000 })
  await expect(results.getByTestId('rally-results-track')).toHaveText('Resultados · La Terraza')
  await expect(results.locator('tbody tr')).toHaveCount(3)
  await expect(results.getByText(/en La Terraza/)).toBeVisible()
  await expect(results.getByText(/Abriste una pista nueva: El Obrador/)).toBeVisible()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('rdc:podiums') ?? '[]')),
  ).toContain('terraza')
  expect(await page.evaluate(() => localStorage.getItem('rdc:track'))).toBe('"terraza"')
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('rdc:best:terraza:')),
    ),
  ).toHaveLength(1)

  // De vuelta al menú: El Obrador ya no tiene candado y la pista elegida sigue siendo La Terraza.
  await results.getByRole('button', { name: 'Menú' }).click()
  await expect(menu.getByTestId('rally-track-obrador')).toBeEnabled()
  await expect(menu.getByTestId('rally-track-barra')).toBeDisabled()
  await expect(menu.getByTestId('rally-track-terraza')).toHaveAttribute('aria-checked', 'true')

  // Cambiar a la pista nueva y arrancar: otro nombre en el HUD.
  await menu.getByTestId('rally-track-obrador').click()
  await menu.getByTestId('rally-start').click()
  await expect(root).toHaveAttribute('data-state', 'race', { timeout: 180_000 })
  await expect(page.getByTestId('rally-hud-track')).toHaveText('El Obrador')
  await page.getByRole('button', { name: 'Pausa' }).click()
  await page.getByTestId('rally-exit-pause').click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()

  // Al volver a entrar, la pista elegida y el desbloqueo quedaron guardados.
  await page.getByRole('button', { name: /Rally de Cocina/ }).click()
  const again = page.getByRole('dialog', { name: 'Rally de Cocina' })
  await expect(again.getByTestId('rally-start')).toBeVisible({ timeout: 120_000 })
  await expect(again.getByTestId('rally-track-obrador')).toHaveAttribute('aria-checked', 'true')
  await expect(again.getByTestId('rally-eyebrow')).toContainText('Pista 3 · El Obrador')
  await again.getByTestId('rally-exit').click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
})

test('Rally de Cocina: una pista bloqueada no se puede elegir aunque se fuerce el toque', async ({
  page,
}) => {
  const menu = await openRally(page)
  await menu.getByTestId('rally-track-fallas').click({ force: true })
  await expect(menu.getByTestId('rally-track-cocina')).toHaveAttribute('aria-checked', 'true')
  await expect(menu.getByTestId('rally-track-fallas')).toHaveAttribute('aria-checked', 'false')
  await expect(menu.getByTestId('rally-eyebrow')).toContainText('Pista 1 · La Cocina')
})
