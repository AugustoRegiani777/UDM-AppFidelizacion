import { describe, expect, it } from 'vitest'
import { combineInput, type PadSnapshot } from './input.ts'
import { EMPTY_TOUCH } from './touchModel.ts'

const keys = (...k: string[]) => new Set(k)

describe('combineInput: teclado, joystick y táctil', () => {
  it('sin nada no pide nada', () => {
    expect(combineInput(keys(), null)).toEqual({
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
    })
  })

  it('teclado: flechas y WASD, Shift de freno de mano', () => {
    expect(combineInput(keys('ArrowUp', 'ArrowLeft'), null)).toMatchObject({
      throttle: 1,
      steer: 1,
    })
    expect(combineInput(keys('KeyS', 'KeyD'), null)).toMatchObject({ brake: 1, steer: -1 })
    expect(combineInput(keys('ShiftLeft'), null).handbrake).toBe(true)
  })

  it('joystick: eje izquierdo dobla (con zona muerta), gatillo acelera, botón 1 es freno de mano', () => {
    const pad: PadSnapshot = {
      axes: [0.5],
      buttons: Array.from({ length: 10 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })),
    }
    expect(combineInput(keys(), pad)).toMatchObject({ throttle: 1, steer: -0.5 })
    expect(combineInput(keys(), { ...pad, axes: [0.1] }).steer).toBe(0)
    const hb: PadSnapshot = {
      axes: [0],
      buttons: [
        { pressed: false, value: 0 },
        { pressed: true, value: 1 },
      ],
    }
    expect(combineInput(keys(), hb).handbrake).toBe(true)
  })

  it('táctil: adelante + izquierda + freno de mano', () => {
    const touch = { ...EMPTY_TOUCH, throttle: 1, steer: 1, handbrake: true }
    expect(combineInput(keys(), null, touch)).toEqual({
      throttle: 1,
      brake: 0,
      steer: 1,
      handbrake: true,
    })
  })

  it('la dirección táctil pisa al teclado, pero acelerar se suma', () => {
    const touch = { ...EMPTY_TOUCH, steer: -1 }
    expect(combineInput(keys('ArrowLeft', 'ArrowUp'), null, touch)).toMatchObject({
      throttle: 1,
      steer: -1,
    })
  })
})
