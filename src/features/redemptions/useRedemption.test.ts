import { formatCountdown } from './useRedemption'

describe('formatCountdown', () => {
  it.each([
    [15 * 60_000, '15:00'],
    [61_000, '1:01'],
    [9_400, '0:10'],
    [0, '0:00'],
  ])('%i ms -> %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected)
  })
})
