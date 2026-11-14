import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'
import { signUp } from './support/session'

// El navegador de las pruebas no tiene GPU: el 3D corre a pocos cuadros por segundo. Márgenes largos
// y esperas por condición, nunca por tiempo fijo.
test.setTimeout(600_000)
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
})

type RallyHook = {
  sim: {
    state: string
    player: {
      vf: number
      steer: number
      turbo: number
      item: string | null
      lapsDone: number
      maxLap: number
      idx: number
      x: number
      z: number
      vx: number
      vz: number
      heading: number
    }
    totalLaps: number
    cars: unknown[]
  }
  tp: { x: number; z: number }[]
  tan: { x: number; z: number }[]
  trackCheck: { length: number; minSep: number; minRadius: number }
}
declare global {
  interface Window {
    __rally?: RallyHook
  }
}

/** Dedos de verdad (eventos táctiles del navegador): cada uno es un puntero distinto. */
class Fingers {
  private active = new Map<number, { x: number; y: number }>()
  constructor(private readonly cdp: CDPSession) {}
  private async send(type: 'touchStart' | 'touchMove' | 'touchEnd', ids?: number[]) {
    // touchEnd suelta solo los dedos que se listan; touchStart/Move llevan todos los apoyados.
    const list = ids ?? [...this.active.keys()]
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: list.map((id) => ({ id, x: this.active.get(id)!.x, y: this.active.get(id)!.y })),
    })
  }
  async down(id: number, x: number, y: number) {
    this.active.set(id, { x, y })
    await this.send('touchStart')
  }
  async move(id: number, x: number, y: number) {
    this.active.set(id, { x, y })
    await this.send('touchMove')
  }
  async up(id: number) {
    await this.send('touchEnd', [id])
    this.active.delete(id)
  }
  async upAll() {
    this.active.clear()
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
}

const center = async (loc: Locator) => {
  const box = (await loc.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width, h: box.height }
}
const speed = async (page: Page) => Number(await page.getByTestId('rally-speed').innerText())

async function openRally(page: Page) {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /Rally de Cocina/ }).click()
  const menu = page.getByRole('dialog', { name: 'Rally de Cocina' })
  // three.js va en su propio paquete: la primera carga tarda.
  await expect(menu.getByTestId('rally-start')).toBeVisible({ timeout: 90_000 })
  return menu
}

test('Rally de Cocina: menú, cuenta regresiva, controles táctiles con varios dedos, pausa, resultados y salida', async ({
  page,
  context,
}) => {
  const menu = await openRally(page)

  // Menú: sin el cartel viejo de "no tiene controles táctiles" y con la ayuda de los botones.
  await expect(page.getByText(/no tiene controles táctiles/)).toHaveCount(0)
  // Cartel de "cómo se maneja" con el dibujo, y los ajustes: "Un pulgar" por defecto.
  await expect(menu.getByTestId('rally-howto')).toBeVisible()
  await expect(menu.getByText(/Mitad izquierda, un solo pulgar/)).toBeVisible()
  await expect(menu.locator('#rdc-scheme-one')).toBeChecked()
  await menu.locator('label[for="rdc-scheme-two"]').click()
  await expect(menu.getByText(/Mitad derecha: pedales/)).toBeVisible()
  await menu.locator('label[for="rdc-scheme-one"]').click()
  await expect(menu.getByText('Elegí tu auto')).toBeVisible()
  const hasWebgl = await page
    .locator('canvas')
    .first()
    .evaluate((el) => {
      const c = el as HTMLCanvasElement
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
    })
  expect(hasWebgl).toBe(true)
  // Ni una sola fuente ni script de internet: todo sale del propio origen.
  const external = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter(
        (u) =>
          !u.startsWith(location.origin) &&
          !u.includes('127.0.0.1:55321') &&
          !u.startsWith('data:'),
      ),
  )
  expect(external.filter((u) => /fonts\.g|jsdelivr|unpkg|cdnjs/.test(u))).toEqual([])

  // Elegir auto, 3 vueltas y 2 rivales (para que el resultado salga rápido).
  await menu.getByTestId('rally-car-grillo').click()
  await expect(menu.getByTestId('rally-car-grillo')).toHaveAttribute('aria-checked', 'true')
  await menu.locator('label[for="rdc-laps-3"]').click()
  await menu.locator('label[for="rdc-rivals-2"]').click()
  await expect(menu.getByText(/Todavía no tenés récord con Grillo/)).toBeVisible()
  await menu.getByTestId('rally-start').click()

  // Cuenta regresiva y arranque.
  const root = page.getByTestId('rally-root')
  await expect(root).toHaveAttribute('data-state', 'countdown', { timeout: 30_000 })
  await expect(root).toHaveAttribute('data-state', 'race', { timeout: 120_000 })
  await expect(page.getByTestId('rally-lap')).toHaveText('1/3')

  // Controles táctiles "Un pulgar": mitad izquierda = una superficie con pedales por altura;
  // a la derecha, el ítem y el freno de mano (grandes y separados).
  const touch = page.getByTestId('rally-touch')
  await expect(touch).toBeVisible()
  await expect(touch).toHaveAttribute('data-scheme', 'one')
  const zone = await center(page.getByTestId('rally-zone-left'))
  expect(zone.x).toBeLessThan(422)
  expect(zone.w).toBeGreaterThanOrEqual(400)
  const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {}
  for (const id of ['item', 'handbrake'] as const) {
    const b = page.getByTestId(`rally-btn-${id}`)
    await expect(b).toBeVisible()
    boxes[id] = await center(b)
    expect(boxes[id]!.w).toBeGreaterThanOrEqual(84)
    expect(boxes[id]!.h).toBeGreaterThanOrEqual(84)
    expect(boxes[id]!.x).toBeGreaterThan(422)
  }
  // Bien separados entre sí (al menos 16 px de borde a borde).
  const gap = Math.hypot(boxes.item!.x - boxes.handbrake!.x, boxes.item!.y - boxes.handbrake!.y)
  expect(gap).toBeGreaterThan(boxes.item!.w / 2 + boxes.handbrake!.w / 2 + 16)
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activar sonido' })).toBeVisible()

  const fingers = new Fingers(await context.newCDPSession(page))
  const top = zone.y - zone.h / 2
  const gasY = top + zone.h * 0.3
  const brakeY = top + zone.h * 0.85
  const steer = () => page.evaluate(() => window.__rally!.sim.player.steer)

  // Sin tocar: punto muerto. Apoyar el pulgar arriba acelera y sube la velocidad del HUD.
  await expect(touch).toHaveAttribute('data-pedal', 'none')
  const before = await speed(page)
  await fingers.down(1, 200, gasY)
  await expect(touch).toHaveAttribute('data-pedal', 'gas')
  await expect.poll(() => speed(page), { timeout: 120_000 }).toBeGreaterThan(before + 12)

  // Deslizar el mismo pulgar a la izquierda dobla; a la derecha, al otro lado; volver al origen, derecho.
  await fingers.move(1, 200 - 60, gasY)
  await expect.poll(steer, { timeout: 60_000 }).toBeGreaterThan(0.3)
  await fingers.move(1, 200 + 60, gasY)
  await expect.poll(steer, { timeout: 60_000 }).toBeLessThan(-0.3)
  await fingers.move(1, 200, gasY)
  await expect.poll(() => steer().then(Math.abs), { timeout: 60_000 }).toBeLessThan(0.15)

  // Bajar el pulgar por debajo de la línea frena (y doblar mientras tanto = derrape).
  await fingers.move(1, 200, brakeY)
  await expect(touch).toHaveAttribute('data-pedal', 'brake')
  await fingers.move(1, 200 - 60, brakeY)
  await expect(touch).toHaveAttribute('data-drift', 'true')
  await fingers.move(1, 200, gasY)
  await expect(touch).toHaveAttribute('data-pedal', 'gas')

  // Botón del ítem con el pad apoyado (multitouch): con un ítem en mano, un toque lo usa (turbo).
  await page.evaluate(() => {
    window.__rally!.sim.player.item = 'turbo'
  })
  await expect(page.getByTestId('rally-btn-item')).toHaveAttribute('data-full', 'true')
  await fingers.down(3, boxes.item!.x, boxes.item!.y)
  await expect(touch).toHaveAttribute('data-pedal', 'gas') // el pad sigue apretado
  await fingers.up(3)
  await expect
    .poll(() => page.evaluate(() => window.__rally!.sim.player.turbo), { timeout: 30_000 })
    .toBeGreaterThan(0)
  await expect(page.getByTestId('rally-btn-item')).toHaveAttribute('data-full', 'false')

  // Freno de mano: mantenido, queda apretado aunque el dedo se corra afuera del botón.
  await fingers.down(4, boxes.handbrake!.x, boxes.handbrake!.y)
  await expect(page.getByTestId('rally-btn-handbrake')).toHaveAttribute('data-pressed', 'true')
  await fingers.move(4, boxes.handbrake!.x - 150, boxes.handbrake!.y - 30)
  await expect(page.getByTestId('rally-btn-handbrake')).toHaveAttribute('data-pressed', 'true')
  await fingers.up(4)
  await expect(page.getByTestId('rally-btn-handbrake')).toHaveAttribute('data-pressed', 'false')

  // Levantar el pulgar: punto muerto.
  await fingers.up(1)
  await expect(touch).toHaveAttribute('data-pedal', 'none')

  // Pausa y seguir.
  await page.getByRole('button', { name: 'Pausa' }).click()
  const pause = page.getByRole('dialog', { name: 'Pausa' })
  await expect(pause).toBeVisible()
  await expect(root).toHaveAttribute('data-state', 'paused')
  await pause.getByTestId('rally-resume').click()
  await expect(root).toHaveAttribute('data-state', 'race')

  // Cruzar la meta: resultados con vos y los rivales.
  await page.evaluate(() => {
    const r = window.__rally!
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
  await expect(results).toBeVisible({ timeout: 120_000 })
  await expect(results.locator('tbody tr')).toHaveCount(3)
  await expect(results.locator('tr.me')).toContainText('Grillo (vos)')
  await expect(results.getByRole('button', { name: 'Revancha' })).toBeVisible()

  // Revancha → pausa → salir a la sala de juegos.
  await results.getByTestId('rally-again').click()
  await expect(root).toHaveAttribute('data-state', /countdown|race/)
  await page.getByRole('button', { name: 'Pausa' }).click()
  await page.getByTestId('rally-exit-pause').click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
  await expect(page.getByTestId('rally-root')).toHaveCount(0)

  // Volver a entrar: el auto y los ajustes quedaron guardados (claves rdc:).
  await page.getByRole('button', { name: /Rally de Cocina/ }).click()
  const again = page.getByRole('dialog', { name: 'Rally de Cocina' })
  await expect(again.getByTestId('rally-start')).toBeVisible({ timeout: 90_000 })
  await expect(again.getByTestId('rally-car-grillo')).toHaveAttribute('aria-checked', 'true')
  await expect(again.locator('#rdc-laps-3')).toBeChecked()
  await expect(page.getByTestId('rally-root')).toHaveCount(1) // StrictMode no deja duplicados
  await again.getByTestId('rally-exit').click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
})

test('Rally de Cocina: la pista cumple sus números de sanidad', async ({ page }) => {
  await openRally(page)
  const check = await page.evaluate(() => window.__rally!.trackCheck)
  expect(check.length).toBeGreaterThan(400)
  expect(check.minSep).toBeGreaterThan(20)
  expect(check.minRadius).toBeGreaterThan(8)
})

test('Rally de Cocina: "Dos pulgares" (izquierda dirección, derecha pedales) se elige en el menú y se guarda', async ({
  page,
  context,
}) => {
  const menu = await openRally(page)
  await menu.locator('label[for="rdc-scheme-two"]').click()
  await menu.locator('label[for="rdc-laps-3"]').click()
  await menu.getByTestId('rally-start').click()
  const root = page.getByTestId('rally-root')
  await expect(root).toHaveAttribute('data-state', 'race', { timeout: 120_000 })

  const touch = page.getByTestId('rally-touch')
  await expect(touch).toHaveAttribute('data-scheme', 'two')
  const left = await center(page.getByTestId('rally-zone-left'))
  const right = await center(page.getByTestId('rally-zone-right'))
  expect(left.x).toBeLessThan(422)
  expect(right.x).toBeGreaterThan(422)
  const item = await center(page.getByTestId('rally-btn-item'))
  const hb = await center(page.getByTestId('rally-btn-handbrake'))
  expect(item.w).toBeGreaterThanOrEqual(84)
  expect(hb.w).toBeGreaterThanOrEqual(60)
  // El ítem y el freno de mano quedan en la columna del borde, fuera de la superficie de pedales.
  expect(item.x - item.w / 2).toBeGreaterThanOrEqual(right.x + right.w / 2 - 2)

  const fingers = new Fingers(await context.newCDPSession(page))
  const rTop = right.y - right.h / 2
  const steer = () => page.evaluate(() => window.__rally!.sim.player.steer)
  // Pulgar izquierdo: solo dirección (la altura no cambia nada).
  await fingers.down(1, 250, 300)
  await fingers.move(1, 190, 300)
  await expect.poll(steer, { timeout: 60_000 }).toBeGreaterThan(0.3)
  await expect(touch).toHaveAttribute('data-pedal', 'none')
  // Pulgar derecho: arriba acelera; abajo frena; frenar mientras dobla = derrape.
  const before = await speed(page)
  await fingers.down(2, right.x, rTop + right.h * 0.3)
  await expect(touch).toHaveAttribute('data-pedal', 'gas')
  await expect.poll(() => speed(page), { timeout: 120_000 }).toBeGreaterThan(before + 8)
  await fingers.move(2, right.x, rTop + right.h * 0.85)
  await expect(touch).toHaveAttribute('data-pedal', 'brake')
  await expect(touch).toHaveAttribute('data-drift', 'true')
  await fingers.upAll()
  await expect(touch).toHaveAttribute('data-pedal', 'none')

  // La elección queda guardada (clave rdc:scheme).
  expect(await page.evaluate(() => localStorage.getItem('rdc:scheme'))).toBe('"two"')
  await page.getByRole('button', { name: 'Pausa' }).click()
  await page.getByTestId('rally-exit-pause').click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
  await page.getByRole('button', { name: /Rally de Cocina/ }).click()
  const again = page.getByRole('dialog', { name: 'Rally de Cocina' })
  await expect(again.getByTestId('rally-start')).toBeVisible({ timeout: 90_000 })
  await expect(again.locator('#rdc-scheme-two')).toBeChecked()
  // Dejar el valor por defecto para no pisar otros tests del mismo navegador.
  await again.locator('label[for="rdc-scheme-one"]').click()
  await again.getByTestId('rally-exit').click()
})
