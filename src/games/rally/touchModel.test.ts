import { describe, expect, it, vi } from 'vitest'
import {
  ActionModel,
  PEDAL_SPLIT,
  TUNING,
  TouchControls,
  hitTest,
  withIdleBrake,
  type Rect,
} from './touchModel.ts'

// Pantalla de 844x390: superficie izquierda x 0..422, derecha 422..726 (la columna del borde queda libre).
const LEFT: Rect = { left: 0, top: 60, right: 422, bottom: 390 }
const RIGHT: Rect = { left: 422, top: 60, right: 726, bottom: 390 }
const H = LEFT.bottom - LEFT.top
const LINE = LEFT.top + H * PEDAL_SPLIT
const GAS_Y = LEFT.top + H * 0.3
const BRAKE_Y = LEFT.top + H * 0.85
const R = 58

const make = (scheme: 'one' | 'two' = 'one') => {
  const c = new TouchControls({ scheme, radius: R })
  c.setLayout(LEFT, RIGHT)
  return c
}
/** Avanza la rampa lo suficiente para que el giro llegue a su valor. */
const settle = (c: TouchControls) => {
  for (let i = 0; i < 60; i++) c.step(1 / 60)
  return c.state()
}

describe('Un pulgar: pedales por posición vertical absoluta', () => {
  it('sin tocar nada es punto muerto: ni acelera ni frena (el frenado suave lo pone el juego)', () => {
    const c = make()
    expect(c.state()).toMatchObject({ throttle: 0, brake: 0, steer: 0, idle: true, drift: false })
  })

  it('la parte de arriba acelera y la de abajo frena, con la línea en PEDAL_SPLIT', () => {
    expect(PEDAL_SPLIT).toBe(0.6)
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    expect(c.state()).toMatchObject({ throttle: 1, brake: 0, idle: false })
    c.up(1)
    c.down(1, 'left', 200, BRAKE_Y)
    expect(c.state()).toMatchObject({ throttle: 0, brake: 1, idle: false })
  })

  it('apoyar justo en la línea cuenta como frenar y un píxel arriba como acelerar', () => {
    const c = make()
    c.down(1, 'left', 200, LINE - 1)
    expect(c.pedal).toBe('gas')
    c.up(1)
    c.down(1, 'left', 200, LINE)
    expect(c.pedal).toBe('brake')
  })

  it('deslizar el pulgar hacia arriba o abajo cambia de pedal sin levantarlo, con histéresis en la línea', () => {
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    c.move(1, 200, LINE + TUNING.pedalHyst - 1) // pasó la línea pero dentro de la histéresis
    expect(c.pedal).toBe('gas')
    c.move(1, 200, LINE + TUNING.pedalHyst + 1)
    expect(c.pedal).toBe('brake')
    c.move(1, 200, LINE - TUNING.pedalHyst + 1) // vuelve a la zona de histéresis: sigue frenando
    expect(c.pedal).toBe('brake')
    c.move(1, 200, LINE - TUNING.pedalHyst - 1)
    expect(c.pedal).toBe('gas')
  })

  it('el ruido de ±12 px del pulgar lejos de la línea no cambia de pedal', () => {
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    for (const n of [-12, 12, -9, 11, 0]) {
      c.move(1, 200, GAS_Y + n)
      expect(c.pedal).toBe('gas')
    }
  })

  it('al levantar el pulgar vuelve al punto muerto', () => {
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    c.up(1)
    expect(c.state()).toMatchObject({ throttle: 0, brake: 0, idle: true })
  })

  it('withIdleBrake: en punto muerto y andando, frena suave; si no, no toca nada', () => {
    const idle = { idle: true }
    expect(withIdleBrake({ throttle: 0, brake: 0 }, idle, 12).brake).toBe(TUNING.idleBrake)
    expect(withIdleBrake({ throttle: 0, brake: 0 }, idle, 0.5).brake).toBe(0) // parado: no mete reversa
    expect(withIdleBrake({ throttle: 0, brake: 0 }, { idle: false }, 12).brake).toBe(0)
    expect(withIdleBrake({ throttle: 1, brake: 0 }, idle, 12).brake).toBe(0) // teclado acelerando
  })
})

describe('dirección: origen flotante, zona muerta, rampa y sensibilidad', () => {
  it('el origen es donde apoyó el pulgar: apoyar en cualquier lado no dobla', () => {
    for (const x of [30, 200, 400]) {
      const c = make()
      c.down(1, 'left', x, GAS_Y)
      expect(settle(c).steer).toBe(0)
    }
  })

  it('deslizar a la izquierda dobla a la izquierda (steer > 0) y a la derecha al revés', () => {
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    c.move(1, 200 - 0.5 * R, GAS_Y)
    expect(settle(c).steer).toBeGreaterThan(0.3)
    c.move(1, 200 + 0.5 * R, GAS_Y)
    expect(settle(c).steer).toBeLessThan(-0.3)
  })

  it('zona muerta chica: un temblor de pocos px no dobla, y con histéresis para no parpadear', () => {
    const c = make()
    c.down(1, 'left', 200, GAS_Y)
    c.move(1, 200 - TUNING.steerDeadEnter * R + 1, GAS_Y)
    expect(settle(c).steer).toBe(0)
    c.move(1, 200 - TUNING.steerDeadEnter * R - 2, GAS_Y)
    expect(settle(c).steer).toBeGreaterThan(0)
    // ya doblando, vuelve un poco hacia el centro (dentro de la histéresis): sigue doblando
    c.move(1, 200 - (TUNING.steerDeadEnter - 0.02) * R, GAS_Y)
    expect(settle(c).steer).toBeGreaterThan(0)
    c.move(1, 200 - (TUNING.steerDeadExit - 0.01) * R, GAS_Y)
    expect(settle(c).steer).toBe(0)
  })

  it('es proporcional: más desplazamiento, más giro, hasta el máximo', () => {
    const c = make()
    c.down(1, 'left', 300, GAS_Y)
    const at = (d: number) => {
      c.move(1, 300 - d * R, GAS_Y)
      return settle(c).steer
    }
    const a = at(0.3)
    const b = at(0.5)
    const d = at(0.7)
    expect(0).toBeLessThan(a)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(d)
    expect(at(TUNING.steerFull)).toBeCloseTo(1, 5)
    expect(at(1)).toBe(1)
  })

  it('la sensibilidad escala el giro por desplazamiento', () => {
    const c = make()
    c.down(1, 'left', 300, GAS_Y)
    c.move(1, 300 - 0.45 * R, GAS_Y)
    const normal = settle(c).steer
    c.configure({ sensitivity: 1.3 })
    const alta = settle(c).steer
    c.configure({ sensitivity: 0.75 })
    const suave = settle(c).steer
    expect(suave).toBeLessThan(normal)
    expect(normal).toBeLessThan(alta)
  })

  it('el giro tiene rampa: no salta de golpe al máximo al apretar ni vuelve de golpe al soltar', () => {
    const c = make()
    c.down(1, 'left', 300, GAS_Y)
    c.move(1, 300 - R, GAS_Y)
    const first = c.step(1 / 60).steer
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(0.3)
    expect(settle(c).steer).toBe(1)
    c.up(1)
    const back = c.step(1 / 60).steer
    expect(back).toBeLessThan(1)
    expect(back).toBeGreaterThan(0.5)
    expect(settle(c).steer).toBe(0)
  })

  it('si el pulgar se aleja de más, el origen lo sigue (no queda lejos del punto de partida)', () => {
    const c = make()
    c.down(1, 'left', 300, GAS_Y)
    c.move(1, 300 - 3 * R, GAS_Y)
    expect(c.origin).toBeCloseTo(300 - 3 * R + TUNING.follow * R, 5)
    // y para volver a derecho solo hay que acercarse al nuevo origen
    c.move(1, c.origin, GAS_Y)
    expect(settle(c).steer).toBe(0)
  })
})

describe('derrape = frenar + doblar', () => {
  it('frenar con giro a un lado derrapa hacia ese lado: freno reducido y freno de mano pulsado', () => {
    const c = make()
    c.down(1, 'left', 300, BRAKE_Y)
    c.move(1, 300 + 0.7 * R, BRAKE_Y) // a la derecha
    let handbrakeFrames = 0
    let last = c.state()
    for (let i = 0; i < 120; i++) {
      last = c.step(1 / 60)
      if (last.handbrake) handbrakeFrames++
    }
    expect(last.drift).toBe(true)
    expect(last.steer).toBeLessThan(0) // hacia la derecha
    expect(last.brake).toBe(TUNING.driftBrake)
    expect(last.throttle).toBe(0)
    // el freno de mano va a pulsos (agarre reducido asistido): ni siempre ni nunca
    expect(handbrakeFrames).toBeGreaterThan(5)
    expect(handbrakeFrames).toBeLessThan(115)
  })

  it('frenar derecho no derrapa y acelerar con giro tampoco', () => {
    const c = make()
    c.down(1, 'left', 300, BRAKE_Y)
    expect(settle(c)).toMatchObject({ drift: false, brake: 1, handbrake: false })
    c.move(1, 300 - 0.7 * R, GAS_Y)
    expect(settle(c)).toMatchObject({ drift: false, throttle: 1, handbrake: false })
  })

  it('a la izquierda derrapa a la izquierda', () => {
    const c = make()
    c.down(1, 'left', 300, BRAKE_Y)
    c.move(1, 300 - 0.7 * R, BRAKE_Y)
    expect(settle(c)).toMatchObject({ drift: true })
    expect(c.state().steer).toBeGreaterThan(0)
  })
})

describe('Dos pulgares: izquierda dirección, derecha pedales', () => {
  it('la izquierda solo dobla: la altura no cambia de pedal y sigue en punto muerto', () => {
    const c = make('two')
    c.down(1, 'left', 300, BRAKE_Y)
    c.move(1, 300 - 0.6 * R, BRAKE_Y)
    const s = settle(c)
    expect(s.steer).toBeGreaterThan(0.3)
    expect(s).toMatchObject({ throttle: 0, brake: 0, idle: true })
  })

  it('la derecha es la superficie de pedales: arriba acelera, abajo frena', () => {
    const c = make('two')
    c.down(2, 'right', 560, RIGHT.top + (RIGHT.bottom - RIGHT.top) * 0.3)
    expect(c.state()).toMatchObject({ throttle: 1, brake: 0, idle: false })
    c.move(2, 560, RIGHT.top + (RIGHT.bottom - RIGHT.top) * 0.85)
    expect(c.state()).toMatchObject({ throttle: 0, brake: 1 })
    expect(c.pedalLineY).toBeCloseTo(RIGHT.top + (RIGHT.bottom - RIGHT.top) * PEDAL_SPLIT)
  })

  it('multitouch: doblar con un pulgar y frenar con el otro derrapa; soltar uno deja el otro', () => {
    const c = make('two')
    c.down(1, 'left', 300, GAS_Y)
    c.down(2, 'right', 560, RIGHT.bottom - 40)
    c.move(1, 300 + 0.7 * R, GAS_Y)
    const s = settle(c)
    expect(s.drift).toBe(true)
    expect(s.steer).toBeLessThan(0)
    c.up(2)
    expect(settle(c)).toMatchObject({ drift: false, brake: 0, idle: true })
    expect(c.state().steer).toBeLessThan(0)
    c.up(1)
    expect(settle(c).steer).toBe(0)
  })

  it('la superficie izquierda no toma un segundo dedo (queda ignorado) y la derecha no acepta en "Un pulgar"', () => {
    const c = make('two')
    expect(c.down(1, 'left', 100, 200)).toBe(true)
    expect(c.down(2, 'left', 150, 200)).toBe(false)
    const one = make('one')
    expect(one.down(1, 'right', 500, 200)).toBe(false)
  })
})

describe('cancelación y cambio de esquema', () => {
  it('cancel y clear sueltan todo (pointercancel, pérdida de foco)', () => {
    const c = make('two')
    c.down(1, 'left', 300, GAS_Y)
    c.down(2, 'right', 560, GAS_Y)
    c.actions.down(3, 'handbrake')
    c.cancel(2)
    expect(c.pedal).toBe('none')
    expect(c.state().handbrake).toBe(true)
    c.clear()
    expect(c.state()).toMatchObject({
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      idle: true,
    })
    expect(c.steerPointer).toBeNull()
  })

  it('cambiar de esquema en medio suelta los dedos', () => {
    const c = make('one')
    c.down(1, 'left', 300, GAS_Y)
    c.configure({ scheme: 'two' })
    expect(c.steerPointer).toBeNull()
    expect(c.state().idle).toBe(true)
  })
})

describe('botones de acción', () => {
  it('cada dedo se queda con su botón hasta que lo levanta, aunque se salga del dibujo', () => {
    const onPress = vi.fn()
    const m = new ActionModel(onPress)
    expect(m.down(1, 'handbrake')).toBe(true)
    expect(onPress).toHaveBeenCalledWith('handbrake')
    expect([...m.pressed()]).toEqual(['handbrake'])
    expect(m.has(1)).toBe(true)
    m.up(1)
    expect(m.pressed().size).toBe(0)
    expect(m.down(2, null)).toBe(false)
  })

  it('ítem + freno de mano + pad a la vez (multitouch real)', () => {
    const c = make('one')
    c.down(1, 'left', 200, GAS_Y)
    c.actions.down(2, 'item')
    c.actions.down(3, 'handbrake')
    expect(c.state()).toMatchObject({ throttle: 1, useItem: true, handbrake: true })
    c.up(2)
    expect(c.state()).toMatchObject({ useItem: false, handbrake: true, throttle: 1 })
  })

  it('hitTest toma el botón más cercano hasta 14 px y ninguno más allá', () => {
    const rects = {
      item: { left: 700, top: 100, right: 790, bottom: 190 },
      handbrake: { left: 740, top: 300, right: 830, bottom: 390 },
    }
    expect(hitTest(rects, 740, 150)).toBe('item')
    expect(hitTest(rects, 740, 200)).toBe('item') // 10 px debajo
    expect(hitTest(rects, 740, 260)).toBeNull()
    expect(hitTest(rects, 780, 295)).toBe('handbrake')
  })
})
