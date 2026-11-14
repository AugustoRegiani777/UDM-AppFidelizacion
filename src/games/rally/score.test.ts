import { describe, expect, it } from 'vitest'
import { LAP_POINTS, RALLY_SCORE_MAX, rallyScore } from './score.ts'

describe('rallyScore', () => {
  it('sin récords vale 0', () => {
    expect(rallyScore([])).toBe(0)
  })

  it('toma la mejor vuelta de cada pista entre todos los autos y suma las pistas', () => {
    const s = rallyScore([
      ['best:cocina:chispa', 25],
      ['best:cocina:rayo', 20],
      ['best:barra:chispa', 40],
    ])
    expect(s).toBe(Math.round(LAP_POINTS / 20) + Math.round(LAP_POINTS / 40))
  })

  it('una vuelta más rápida da más puntos y correr otra pista suma', () => {
    const base = rallyScore([['best:cocina:chispa', 25]])
    expect(rallyScore([['best:cocina:chispa', 24]])).toBeGreaterThan(base)
    expect(rallyScore([['best:cocina:chispa', 25], ['best:barra:rayo', 50]])).toBeGreaterThan(base)
  })

  it('ignora pistas propias, claves viejas, basura y tiempos inválidos', () => {
    expect(
      rallyScore([
        ['best:mia-pista:chispa', 1],
        ['best:chispa', 20],
        ['race:cocina:chispa:3', 60],
        ['best:cocina:rayo', 'basura'],
        ['best:cocina:grillo', -3],
        ['best:cocina:x', 0],
      ]),
    ).toBe(0)
  })

  it('no pasa del tope del servidor', () => {
    expect(rallyScore([['best:cocina:chispa', 0.0001]])).toBe(RALLY_SCORE_MAX)
  })
})
