import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ICONS } from './data.ts'
import {
  DEFAULT_PREFS,
  createTouchLayer,
  loadTouchPrefs,
  touchHelpHtml,
  touchOptionsHtml,
  type TouchLayer,
} from './touchLayer.ts'

const LABELS = {
  item: 'Usar el ítem',
  handbrake: 'Freno de mano',
  itemEmpty: 'SIN ÍTEM',
  itemRolling: 'SORTEO',
  gas: 'Acelerar',
  brake: 'Frenar',
  steer: 'Deslizá para doblar',
}

// Posiciones en una pantalla de 844x390 (jsdom no calcula layout).
const rect = (l: number, t: number, r: number, b: number) =>
  ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, x: l, y: t }) as DOMRect
const GAS = { x: 200, y: 150 }
const BRAKE = { x: 200, y: 340 }

function mount(prefs = DEFAULT_PREFS) {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const onPress = vi.fn()
  const layer = createTouchLayer(parent, { labels: LABELS, prefs, onPress })
  const q = (sel: string) => layer.el.querySelector<HTMLElement>(sel)!
  layer.el.getBoundingClientRect = () => rect(0, 0, 844, 390)
  q('.rdc-zone-l').getBoundingClientRect = () => rect(0, 60, 422, 390)
  q('.rdc-zone-r').getBoundingClientRect = () => rect(422, 60, 726, 390)
  q('[data-btn="item"]').getBoundingClientRect = () => rect(650, 190, 740, 280)
  q('[data-btn="handbrake"]').getBoundingClientRect = () => rect(736, 290, 826, 376)
  return { parent, layer, q, onPress }
}

/** Evento de puntero (jsdom no siempre trae PointerEvent: se arma con MouseEvent + pointerId). */
function fire(el: Element, type: string, pointerId: number, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerId', { value: pointerId })
  el.dispatchEvent(e)
  return e
}

describe('capa táctil (eventos de puntero)', () => {
  let ctx: ReturnType<typeof mount>
  let layer: TouchLayer
  beforeEach(() => {
    ctx = mount()
    layer = ctx.layer
  })
  afterEach(() => {
    layer.dispose()
    ctx.parent.remove()
    vi.restoreAllMocks()
  })
  const zl = () => ctx.q('.rdc-zone-l')
  const zr = () => ctx.q('.rdc-zone-r')

  it('tiene la superficie izquierda, la guía de pedales y los dos botones de la derecha con nombre accesible', () => {
    expect(zl().querySelector('.rdc-pedals')).not.toBeNull()
    expect(layer.el.querySelectorAll('button')).toHaveLength(2)
    for (const label of ['Usar el ítem', 'Freno de mano'])
      expect(layer.el.querySelector(`[aria-label="${label}"]`)).not.toBeNull()
    expect(layer.el.dataset.scheme).toBe('one')
  })

  it('arriba de la línea acelera, abajo frena, y levantar el pulgar vuelve a punto muerto', () => {
    fire(zl(), 'pointerdown', 1, GAS.x, GAS.y)
    expect(layer.state()).toMatchObject({ throttle: 1, brake: 0, idle: false })
    expect(layer.el.dataset.pedal).toBe('gas')
    fire(zl(), 'pointermove', 1, BRAKE.x, BRAKE.y)
    expect(layer.state()).toMatchObject({ throttle: 0, brake: 1 })
    expect(layer.el.dataset.pedal).toBe('brake')
    fire(zl(), 'pointerup', 1, BRAKE.x, BRAKE.y)
    expect(layer.state()).toMatchObject({ throttle: 0, brake: 0, idle: true })
    expect(layer.el.dataset.pedal).toBe('none')
  })

  it('deslizar el pulgar a un costado dobla (con rampa) y muestra la barrita de dirección', () => {
    fire(zl(), 'pointerdown', 1, 300, GAS.y)
    expect(layer.el.dataset.steering).toBe('true')
    fire(zl(), 'pointermove', 1, 250, GAS.y)
    let s = layer.state(1 / 60)
    expect(s.steer).toBeGreaterThan(0)
    for (let i = 0; i < 60; i++) s = layer.state(1 / 60)
    expect(s.steer).toBeGreaterThan(0.6)
    fire(zl(), 'pointerup', 1, 250, GAS.y)
    expect(layer.el.dataset.steering).toBe('false')
  })

  it('multitouch: pad + ítem + freno de mano a la vez; cada uno se suelta por separado', () => {
    fire(zl(), 'pointerdown', 1, GAS.x, GAS.y)
    fire(ctx.q('[data-btn="item"]'), 'pointerdown', 2, 700, 230)
    fire(ctx.q('[data-btn="handbrake"]'), 'pointerdown', 3, 780, 330)
    expect(layer.state()).toMatchObject({ throttle: 1, useItem: true, handbrake: true })
    expect(ctx.onPress).toHaveBeenCalledWith('item')
    expect(ctx.q('[data-btn="item"]').dataset.pressed).toBe('true')
    fire(ctx.q('[data-btn="item"]'), 'pointerup', 2, 700, 230)
    expect(layer.state()).toMatchObject({ throttle: 1, useItem: false, handbrake: true })
    fire(ctx.q('[data-btn="handbrake"]'), 'pointerup', 3, 780, 330)
    expect(layer.state().handbrake).toBe(false)
    expect(ctx.q('[data-btn="handbrake"]').dataset.pressed).toBe('false')
  })

  it('el dedo no se cae del botón al salirse de él: sigue apretado hasta levantarlo', () => {
    const hb = ctx.q('[data-btn="handbrake"]')
    fire(hb, 'pointerdown', 3, 780, 330)
    fire(hb, 'pointermove', 3, 300, 100)
    expect(layer.state().handbrake).toBe(true)
    fire(hb, 'pointerup', 3, 300, 100)
    expect(layer.state().handbrake).toBe(false)
  })

  it('pointercancel y lostpointercapture sueltan el dedo (pad y botones)', () => {
    fire(zl(), 'pointerdown', 1, GAS.x, GAS.y)
    fire(ctx.q('[data-btn="handbrake"]'), 'pointerdown', 3, 780, 330)
    fire(zl(), 'pointercancel', 1, 0, 0)
    expect(layer.state()).toMatchObject({ throttle: 0, idle: true })
    fire(ctx.q('[data-btn="handbrake"]'), 'lostpointercapture', 3, 0, 0)
    expect(layer.state().handbrake).toBe(false)
  })

  it('release() y perder el foco de la ventana sueltan todos los dedos', () => {
    fire(zl(), 'pointerdown', 1, GAS.x, GAS.y)
    fire(ctx.q('[data-btn="handbrake"]'), 'pointerdown', 3, 780, 330)
    layer.release()
    expect(layer.state()).toMatchObject({ throttle: 0, handbrake: false, idle: true })
    fire(zl(), 'pointerdown', 4, GAS.x, GAS.y)
    window.dispatchEvent(new Event('blur'))
    expect(layer.state().throttle).toBe(0)
  })

  it('vibra un toque corto al apretar un botón (si el navegador lo permite) y no falla si no hay', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    fire(ctx.q('[data-btn="item"]'), 'pointerdown', 2, 700, 230)
    expect(vibrate).toHaveBeenCalledWith(14)
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })
    expect(() => fire(ctx.q('[data-btn="handbrake"]'), 'pointerdown', 3, 780, 330)).not.toThrow()
  })

  it('"Dos pulgares": la izquierda dobla, la derecha son los pedales y el esquema se cambia en vivo', () => {
    layer.setPrefs({ scheme: 'two', sensitivity: 1 })
    expect(layer.el.dataset.scheme).toBe('two')
    fire(zl(), 'pointerdown', 1, 300, BRAKE.y)
    fire(zl(), 'pointermove', 1, 250, BRAKE.y)
    for (let i = 0; i < 60; i++) layer.state(1 / 60)
    expect(layer.state()).toMatchObject({ throttle: 0, brake: 0, idle: true })
    expect(layer.state().steer).toBeGreaterThan(0.5)
    fire(zr(), 'pointerdown', 2, 560, 340)
    fire(zr(), 'pointermove', 2, 560, 340)
    expect(layer.state()).toMatchObject({ idle: false })
    expect(layer.state().brake).toBeGreaterThan(0) // frenar mientras dobla: derrape
    expect(layer.state().drift).toBe(true)
    fire(zr(), 'pointerup', 2, 560, 340)
    fire(zl(), 'pointerup', 1, 250, BRAKE.y)
    expect(layer.state()).toMatchObject({ idle: true, drift: false })
  })

  it('el ítem muestra el ícono, "SORTEO" mientras se sortea y el estado vacío', () => {
    const cap = () => layer.el.querySelector('[data-r="item-cap"]')!.textContent
    expect(cap()).toBe('SIN ÍTEM')
    layer.setItem(ICONS.turbo, 'TURBO', false)
    expect(cap()).toBe('TURBO')
    expect(layer.el.querySelector('[data-r="item-icon"] svg')).not.toBeNull()
    expect(ctx.q('[data-btn="item"]').dataset.full).toBe('true')
    layer.setItem(ICONS.oil, 'ACEITE', true)
    expect(cap()).toBe('SORTEO')
    layer.setItem(null, '', false)
    expect(cap()).toBe('SIN ÍTEM')
    expect(ctx.q('[data-btn="item"]').dataset.full).toBe('false')
  })

  it('no hay menú contextual ni selección por toque largo, y ocultar suelta los dedos', () => {
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true })
    layer.el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    fire(zl(), 'pointerdown', 1, GAS.x, GAS.y)
    layer.setVisible(false)
    expect(layer.el.hidden).toBe(true)
    expect(layer.state().throttle).toBe(0)
  })

  it('dispose saca todo del DOM', () => {
    layer.dispose()
    expect(ctx.parent.querySelector('.rdc-touch')).toBeNull()
  })
})

describe('ajustes y cartel de controles', () => {
  afterEach(() => localStorage.clear())

  it('por defecto es "Un pulgar" y sensibilidad normal; lee lo guardado con claves rdc:', () => {
    expect(loadTouchPrefs()).toEqual({ scheme: 'one', sensitivity: 1 })
    localStorage.setItem('rdc:scheme', JSON.stringify('two'))
    localStorage.setItem('rdc:sens', JSON.stringify(1.3))
    expect(loadTouchPrefs()).toEqual({ scheme: 'two', sensitivity: 1.3 })
    localStorage.setItem('rdc:scheme', JSON.stringify('otro'))
    localStorage.setItem('rdc:sens', JSON.stringify(9))
    expect(loadTouchPrefs()).toEqual({ scheme: 'one', sensitivity: 1 })
  })

  it('el menú ofrece los dos esquemas y las tres sensibilidades', () => {
    const div = document.createElement('div')
    div.innerHTML = touchOptionsHtml()
    expect(div.querySelectorAll('input[name="rdc-scheme"]')).toHaveLength(2)
    expect(div.querySelectorAll('input[name="rdc-sens"]')).toHaveLength(3)
    expect(div.textContent).toContain('Un pulgar')
    expect(div.textContent).toContain('Dos pulgares')
  })

  it('el cartel de "cómo se maneja" trae un dibujo por esquema', () => {
    for (const s of ['one', 'two'] as const) {
      const div = document.createElement('div')
      div.innerHTML = touchHelpHtml(s)
      expect(div.querySelector('svg')).not.toBeNull()
      expect(div.querySelector(`[data-scheme="${s}"]`)).not.toBeNull()
      expect(div.querySelectorAll('li').length).toBeGreaterThanOrEqual(4)
    }
  })
})
