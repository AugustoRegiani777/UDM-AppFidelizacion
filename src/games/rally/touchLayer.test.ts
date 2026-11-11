import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ICONS } from './data.ts'
import { createTouchLayer, type TouchLayer } from './touchLayer.ts'
import type { TouchButton } from './touchModel.ts'

const LABELS = {
  up: 'Acelerar',
  down: 'Frenar',
  left: 'Izquierda',
  right: 'Derecha',
  item: 'Usar el ítem',
  handbrake: 'Freno de mano',
  itemEmpty: 'SIN ÍTEM',
  itemRolling: 'SORTEO',
}

// Posiciones de cada botón en una pantalla de 844x390 (jsdom no calcula layout).
const BOX: Record<TouchButton, [number, number, number, number]> = {
  up: [90, 190, 160, 260],
  left: [14, 266, 84, 336],
  right: [166, 266, 236, 336],
  down: [90, 342, 160, 412],
  handbrake: [600, 290, 670, 360],
  item: [690, 270, 790, 370],
}
const center = (id: TouchButton): [number, number] => {
  const [l, t, r, b] = BOX[id]
  return [(l + r) / 2, (t + b) / 2]
}

function mount() {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const onPress = vi.fn()
  const layer = createTouchLayer(parent, { labels: LABELS, onPress })
  const btn = (id: TouchButton) => layer.el.querySelector<HTMLButtonElement>(`[data-btn="${id}"]`)!
  for (const id of Object.keys(BOX) as TouchButton[]) {
    const [l, t, r, b] = BOX[id]
    btn(id).getBoundingClientRect = () =>
      ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t, x: l, y: t }) as DOMRect
  }
  return { parent, layer, btn, onPress }
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
  })

  const pad = () => layer.el.querySelector('.rdc-pad')!
  const actions = () => layer.el.querySelector('.rdc-actions')!
  const press = (id: TouchButton, pointer: number) => {
    const [x, y] = center(id)
    fire(ctx.btn(id), 'pointerdown', pointer, x, y)
  }

  it('tiene la cruceta de 4 botones a la izquierda y 2 acciones a la derecha, con nombre accesible', () => {
    expect(pad().querySelectorAll('button')).toHaveLength(4)
    expect(actions().querySelectorAll('button')).toHaveLength(2)
    for (const label of [
      'Acelerar',
      'Frenar',
      'Izquierda',
      'Derecha',
      'Usar el ítem',
      'Freno de mano',
    ])
      expect(layer.el.querySelector(`[aria-label="${label}"]`)).not.toBeNull()
  })

  it('mantener apretado "adelante" acelera y soltar lo apaga', () => {
    press('up', 1)
    expect(layer.state()).toMatchObject({ throttle: 1, steer: 0 })
    expect(ctx.btn('up').dataset.pressed).toBe('true')
    fire(pad(), 'pointerup', 1, 0, 0)
    expect(layer.state().throttle).toBe(0)
    expect(ctx.btn('up').dataset.pressed).toBe('false')
  })

  it('adelante + izquierda con dos dedos, y soltar uno deja el otro', () => {
    press('up', 1)
    press('left', 2)
    expect(layer.state()).toMatchObject({ throttle: 1, steer: 1 })
    fire(pad(), 'pointerup', 2, 0, 0)
    expect(layer.state()).toMatchObject({ throttle: 1, steer: 0 })
  })

  it('un dedo que se desliza de izquierda a derecha cambia de botón', () => {
    press('left', 1)
    expect(layer.state().steer).toBe(1)
    const [x, y] = center('right')
    fire(pad(), 'pointermove', 1, x, y)
    expect(layer.state().steer).toBe(-1)
    expect(ctx.btn('left').dataset.pressed).toBe('false')
    expect(ctx.btn('right').dataset.pressed).toBe('true')
    // y si sale de todos los botones, suelta
    fire(pad(), 'pointermove', 1, 500, 100)
    expect(layer.state().steer).toBe(0)
  })

  it('pointercancel y lostpointercapture sueltan el dedo', () => {
    press('up', 1)
    press('left', 2)
    fire(pad(), 'pointercancel', 2, 0, 0)
    expect(layer.state().steer).toBe(0)
    fire(pad(), 'lostpointercapture', 1, 0, 0)
    expect(layer.state().throttle).toBe(0)
  })

  it('release() suelta todos los dedos (por ejemplo al perder el foco)', () => {
    press('up', 1)
    press('handbrake', 2)
    expect(layer.state()).toMatchObject({ throttle: 1, handbrake: true })
    layer.release()
    expect(layer.state()).toMatchObject({ throttle: 0, handbrake: false })
  })

  it('el botón del ítem avisa al apoyar; el freno de mano se mantiene', () => {
    press('item', 3)
    expect(ctx.onPress).toHaveBeenCalledWith('item')
    expect(layer.state().useItem).toBe(true)
    fire(actions(), 'pointerup', 3, 0, 0)
    expect(layer.state().useItem).toBe(false)
    press('handbrake', 4)
    expect(layer.state().handbrake).toBe(true)
    fire(actions(), 'pointermove', 4, ...center('handbrake'))
    expect(layer.state().handbrake).toBe(true)
  })

  it('un toque en el hueco de la cruceta no aprieta nada pero se puede deslizar a un botón', () => {
    fire(pad(), 'pointerdown', 5, 120, 300) // centro vacío de la cruceta
    expect(layer.state()).toMatchObject({ throttle: 0, brake: 0, steer: 0 })
    fire(pad(), 'pointermove', 5, ...center('down'))
    expect(layer.state().brake).toBe(1)
  })

  it('el ítem muestra el ícono, "SORTEO" mientras se sortea y el estado vacío', () => {
    const cap = () => layer.el.querySelector('[data-r="item-cap"]')!.textContent
    expect(cap()).toBe('SIN ÍTEM')
    layer.setItem(ICONS.turbo, 'TURBO', false)
    expect(cap()).toBe('TURBO')
    expect(layer.el.querySelector('[data-r="item-icon"] svg')).not.toBeNull()
    expect(ctx.btn('item').dataset.full).toBe('true')
    layer.setItem(ICONS.oil, 'ACEITE', true)
    expect(cap()).toBe('SORTEO')
    layer.setItem(null, '', false)
    expect(cap()).toBe('SIN ÍTEM')
    expect(ctx.btn('item').dataset.full).toBe('false')
  })

  it('no hay menú contextual ni selección por toque largo, y ocultar suelta los dedos', () => {
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true })
    layer.el.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    press('up', 1)
    layer.setVisible(false)
    expect(layer.el.hidden).toBe(true)
    expect(layer.state().throttle).toBe(0)
  })

  it('dispose saca todo del DOM', () => {
    layer.dispose()
    expect(ctx.parent.querySelector('.rdc-touch')).toBeNull()
  })
})
