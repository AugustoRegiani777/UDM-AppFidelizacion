import { describe, expect, it } from 'vitest'
import {
  adaptResolution,
  detectTouch,
  MIN_PIXEL_RATIO,
  qualityFor,
  shouldDisableShadows,
} from './quality.ts'

describe('perfiles de calidad', () => {
  it('escritorio: el de la demo (densidad hasta 1.5, antialias, sombras 2048)', () => {
    const q = qualityFor(false, 3, false)
    expect(q).toMatchObject({
      pixelRatio: 1.5,
      antialias: true,
      shadowSize: 2048,
      particles: 500,
      adaptive: false,
    })
    expect(qualityFor(false, 1, false).pixelRatio).toBe(1)
  })

  it('celular: densidad 1, sin antialias, sombras livianas y menos partículas', () => {
    const q = qualityFor(true, 3, false)
    expect(q).toMatchObject({ pixelRatio: 1, antialias: false, shadowSize: 1024, adaptive: true })
    expect(q.particles).toBeLessThan(500)
    expect(q.particleScale).toBeLessThan(1)
  })

  it('baja la resolución solo si los cuadros promedian más de ~22 ms, y nunca por debajo del mínimo', () => {
    expect(adaptResolution(16, 1)).toBeNull()
    expect(adaptResolution(30, 1)!.pixelRatio).toBeLessThan(1)
    expect(adaptResolution(30, MIN_PIXEL_RATIO)).toBeNull()
    let r = 1
    for (let i = 0; i < 20; i++) r = adaptResolution(40, r)?.pixelRatio ?? r
    expect(r).toBe(MIN_PIXEL_RATIO)
  })

  it('apaga las sombras si la prueba de rendimiento sale lenta', () => {
    expect(shouldDisableShadows(18)).toBe(false)
    expect(shouldDisableShadows(40)).toBe(true)
  })

  it('?touch=1 fuerza la capa táctil y ?touch=0 la apaga', () => {
    expect(detectTouch('?touch=1')).toBe(true)
    expect(detectTouch('?touch=0')).toBe(false)
    const fake = (coarse: boolean, points: number) =>
      ({
        matchMedia: () => ({ matches: coarse }),
        navigator: { maxTouchPoints: points },
      }) as unknown as Window
    expect(detectTouch('', fake(true, 0))).toBe(true)
    expect(detectTouch('', fake(false, 5))).toBe(true)
    expect(detectTouch('', fake(false, 0))).toBe(false)
  })
})
