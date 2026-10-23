import { prizeOdds } from './gameApi'

describe('prizeOdds', () => {
  it('convierte los pesos en porcentajes que suman 100', () => {
    const odds = prizeOdds([
      { id: 'a', label: 'A', points: 0, weight: 60 },
      { id: 'b', label: 'B', points: 5, weight: 25 },
      { id: 'c', label: 'C', points: 10, weight: 15 },
    ])
    expect(odds.map((o) => o.percent)).toEqual([60, 25, 15])
    expect(odds.reduce((sum, o) => sum + o.percent, 0)).toBeCloseTo(100)
  })
})
