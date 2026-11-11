import { describe, expect, it } from 'vitest'
import { HW, N } from './data.ts'
import {
  DIST,
  LEN,
  NRM,
  TAN,
  TP,
  groundAt,
  nearestGlobal,
  nearestIdx,
  pickupSpots,
  ramps,
  trackCheck,
} from './track.ts'

describe('geometría de la pista', () => {
  it('es un circuito cerrado de unas 490 unidades con 700 puntos', () => {
    expect(TP).toHaveLength(N)
    expect(TAN).toHaveLength(N)
    expect(NRM).toHaveLength(N)
    expect(DIST[0]).toBe(0)
    expect(trackCheck.length).toBeCloseTo(LEN, 6)
    expect(LEN).toBeGreaterThan(400)
    expect(LEN).toBeLessThan(580)
    // se cierra: el último punto está a un paso del primero
    const last = TP[N - 1]!
    expect(Math.hypot(last.x - TP[0]!.x, last.z - TP[0]!.z)).toBeLessThan(2 * (LEN / N))
  })

  it('los tramos lejanos no se tocan (cabe el ancho de la pista) y las curvas son abiertas', () => {
    expect(trackCheck.minSep).toBeGreaterThan(HW * 2 + 10)
    expect(trackCheck.minRadius).toBeGreaterThan(HW * 1.5)
  })

  it('tangentes y normales son unitarias y perpendiculares', () => {
    for (let i = 0; i < N; i += 25) {
      const t = TAN[i]!
      const n = NRM[i]!
      expect(Math.hypot(t.x, t.z)).toBeCloseTo(1, 6)
      expect(t.x * n.x + t.z * n.z).toBeCloseTo(0, 6)
    }
  })

  it('encuentra el punto más cercano, global y local', () => {
    for (const i of [0, 120, 333, 699]) {
      const p = TP[i]!
      expect(nearestGlobal(p.x, p.z)).toBe(i)
      expect(nearestIdx(p.x, p.z, (i + 5) % N)).toBe(i)
    }
  })

  it('hay dos rampas que suben y doce cajas sorpresa sobre la pista', () => {
    expect(ramps).toHaveLength(2)
    for (const r of ramps) {
      const e = r.len / 2 - 0.01
      expect(groundAt(r.x - r.ux * e, r.z - r.uz * e)).toBeLessThan(0.1)
      expect(groundAt(r.x + r.ux * e, r.z + r.uz * e)).toBeGreaterThan(r.h * 0.9)
    }
    expect(groundAt(TP[300]!.x, TP[300]!.z)).toBe(0)
    expect(pickupSpots).toHaveLength(12)
    for (const p of pickupSpots) {
      const i = nearestGlobal(p.x, p.z)
      expect(Math.hypot(TP[i]!.x - p.x, TP[i]!.z - p.z)).toBeLessThanOrEqual(3.3)
    }
  })
})
