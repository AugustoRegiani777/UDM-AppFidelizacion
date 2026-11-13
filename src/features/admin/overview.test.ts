import { describe, expect, it } from 'vitest'
import { barHeights, isOverviewEmpty, normalizeOverview, sumSeries } from './overview'

const mock = {
  users: {
    total: 12,
    new_by_day: [
      { day: '2026-11-01', count: 2 },
      { day: '2026-11-02', count: 4 },
    ],
    active_7d: 5,
    active_30d: 9,
  },
  points: {
    issued: 1000,
    redeemed: 300,
    circulating: 700,
    top_customers: [{ display_name: 'Ana', balance: 250 }],
  },
  sales: {
    claimed_by_day: [{ day: '2026-11-01', count: 3 }],
    qr_scans_by_day: [{ day: '2026-11-01', count: 5 }],
  },
  games: [
    {
      game: 'rally',
      plays_by_day: [{ day: '2026-11-01', count: 7 }],
      plays_total: 7,
      rewards_given: 2,
      limit_hits: 1,
    },
  ],
  rewards: [{ name: 'Bebida', redemptions: 3 }],
}

describe('overview', () => {
  it('normaliza datos completos', () => {
    const o = normalizeOverview(mock)
    expect(o.users.total).toBe(12)
    expect(o.games[0]?.plays_total).toBe(7)
    expect(isOverviewEmpty(o)).toBe(false)
  })

  it('tolera null y campos faltantes', () => {
    const o = normalizeOverview(null)
    expect(o.users.new_by_day).toEqual([])
    expect(o.games).toEqual([])
    expect(isOverviewEmpty(o)).toBe(true)
  })

  it('suma series y calcula alturas relativas', () => {
    const data = normalizeOverview(mock).users.new_by_day
    expect(sumSeries(data)).toBe(6)
    expect(barHeights(data)).toEqual([0.5, 1])
    expect(barHeights([{ day: 'a', count: 0 }])).toEqual([0])
  })
})
