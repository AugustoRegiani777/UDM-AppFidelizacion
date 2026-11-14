import { addTrucoWin, trucoWins } from './progress'

const reportScore = vi.hoisted(() => vi.fn())
vi.mock('@/features/economy/reportScore', () => ({ reportScore }))

describe('victorias de truco', () => {
  beforeEach(() => {
    localStorage.clear()
    reportScore.mockClear()
  })

  it('suma una victoria y la informa al ranking', () => {
    expect(trucoWins()).toBe(0)
    expect(addTrucoWin()).toBe(1)
    expect(addTrucoWin()).toBe(2)
    expect(trucoWins()).toBe(2)
    expect(reportScore).toHaveBeenLastCalledWith('truco', 2)
  })
})
