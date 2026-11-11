import { describe, expect, it, vi } from 'vitest'
import { TouchModel, hitTest, type Rect, type TouchButton } from './touchModel.ts'

describe('TouchModel: botones ↔ controles', () => {
  it('sin dedos no pide nada', () => {
    expect(new TouchModel().state()).toEqual({
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      useItem: false,
    })
  })

  it('cada botón de la cruceta mapea a su control', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    expect(m.state()).toMatchObject({ throttle: 1, brake: 0, steer: 0 })
    m.up(1)
    m.down(1, 'down')
    expect(m.state()).toMatchObject({ throttle: 0, brake: 1 })
    m.up(1)
    m.down(1, 'left')
    expect(m.state().steer).toBe(1)
    m.up(1)
    m.down(1, 'right')
    expect(m.state().steer).toBe(-1)
  })

  it('adelante + izquierda a la vez (dos dedos)', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    m.down(2, 'left')
    expect(m.state()).toMatchObject({ throttle: 1, steer: 1, brake: 0 })
  })

  it('al soltar un dedo, el otro sigue apretando', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    m.down(2, 'left')
    m.up(2)
    expect(m.state()).toMatchObject({ throttle: 1, steer: 0 })
    m.up(1)
    expect(m.state().throttle).toBe(0)
  })

  it('izquierda + derecha se anulan; adelante + atrás piden las dos cosas', () => {
    const m = new TouchModel()
    m.down(1, 'left')
    m.down(2, 'right')
    expect(m.state().steer).toBe(0)
    m.down(3, 'up')
    m.down(4, 'down')
    expect(m.state()).toMatchObject({ throttle: 1, brake: 1 })
  })

  it('un dedo que se desliza de un botón a otro lo sigue', () => {
    const m = new TouchModel()
    m.down(1, 'left')
    m.move(1, 'right')
    expect(m.state().steer).toBe(-1)
    m.move(1, 'up')
    expect(m.state()).toMatchObject({ steer: 0, throttle: 1 })
  })

  it('si el dedo sale de los botones suelta, y al volver a uno lo retoma', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    m.move(1, null)
    expect(m.state().throttle).toBe(0)
    expect(m.has(1)).toBe(true)
    m.move(1, 'up')
    expect(m.state().throttle).toBe(1)
  })

  it('un dedo que empezó fuera de los botones y entra, también cuenta', () => {
    const m = new TouchModel()
    m.down(1, null)
    expect(m.state().throttle).toBe(0)
    m.move(1, 'left')
    expect(m.state().steer).toBe(1)
  })

  it('cancelar un puntero (o perder el foco) lo suelta; clear() suelta todos', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    m.down(2, 'handbrake')
    m.cancel(2)
    expect(m.state().handbrake).toBe(false)
    expect(m.state().throttle).toBe(1)
    m.down(3, 'left')
    m.clear()
    expect(m.state()).toMatchObject({ throttle: 0, steer: 0 })
    expect(m.has(1)).toBe(false)
  })

  it('mover un puntero desconocido no hace nada', () => {
    const m = new TouchModel()
    m.move(9, 'up')
    expect(m.state().throttle).toBe(0)
  })

  it('el botón del ítem avisa una sola vez al apoyar y no al deslizarse', () => {
    const onPress = vi.fn()
    const m = new TouchModel(onPress)
    m.down(1, 'item')
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith('item')
    expect(m.state().useItem).toBe(true)
    m.up(1)
    expect(m.state().useItem).toBe(false)
    m.down(2, 'handbrake')
    m.move(2, 'item')
    expect(onPress).toHaveBeenCalledTimes(2) // el 'item' por deslizamiento no dispara
    expect(onPress).toHaveBeenLastCalledWith('handbrake')
  })

  it('freno de mano mantenido junto con la cruceta', () => {
    const m = new TouchModel()
    m.down(1, 'up')
    m.down(2, 'left')
    m.down(3, 'handbrake')
    expect(m.state()).toEqual({ throttle: 1, brake: 0, steer: 1, handbrake: true, useItem: false })
  })
})

describe('hitTest', () => {
  const rects: Partial<Record<TouchButton, Rect>> = {
    up: { left: 100, top: 0, right: 170, bottom: 70 },
    left: { left: 20, top: 76, right: 90, bottom: 146 },
  }
  it('elige el botón bajo el dedo', () => {
    expect(hitTest(rects, 120, 30)).toBe('up')
    expect(hitTest(rects, 50, 100)).toBe('left')
  })
  it('en el hueco entre botones toma el más cercano dentro del margen', () => {
    expect(hitTest(rects, 97, 72, 10)).toBe('up')
  })
  it('lejos de todo no hay botón', () => {
    expect(hitTest(rects, 400, 400)).toBeNull()
  })
})
