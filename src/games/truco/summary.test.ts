// @vitest-environment node
import { cardNick, envidoBreakdown, envidoFormula, type Card } from './cards.ts'
import { act, createMatch, type TrucoState } from './engine.ts'
import { summarizeHand, trickWinningCard } from './summary.ts'

const c = (n: number, suit: Card['suit']): Card => ({ n, suit })

function rigged(mine: Card[], theirs: Card[], mano: 0 | 1 = 0): TrucoState {
  const s = createMatch(1)
  return {
    ...s,
    mano,
    turn: mano,
    resumeTurn: mano,
    hands: [[...mine], [...theirs]],
    dealt: [[...mine], [...theirs]],
    table: [[], []],
    tricks: [],
    phase: 'play',
    pending: null,
    trucoLevel: 0,
    trucoLast: null,
    envidoDone: false,
    envidoResult: null,
    handResult: null,
    scores: [0, 0],
  }
}

describe('desglose del envido', () => {
  it('muestra las cartas que hacen el tanto y la cuenta', () => {
    const b = envidoBreakdown([c(7, 'espada'), c(6, 'espada'), c(1, 'oro')])
    expect(b.points).toBe(33)
    expect(b.base).toBe(20)
    expect(b.cards).toEqual([c(7, 'espada'), c(6, 'espada')])
    expect(envidoFormula(b)).toBe('33 de espada: 7 de espada + 6 de espada + 20')
  })

  it('sin dos del mismo palo, el tanto es la carta más alta', () => {
    const b = envidoBreakdown([c(5, 'oro'), c(12, 'copa'), c(3, 'basto')])
    expect(b.points).toBe(5)
    expect(b.cards).toEqual([c(5, 'oro')])
    expect(b.base).toBe(0)
  })

  it('elige el mejor par cuando hay tres del mismo palo', () => {
    const b = envidoBreakdown([c(7, 'oro'), c(6, 'oro'), c(5, 'oro')])
    expect(b.points).toBe(33)
  })
})

describe('apodos de las cartas', () => {
  it('nombra las bravas por su nombre', () => {
    expect(cardNick(c(1, 'espada'))).toBe('el ancho de espadas')
    expect(cardNick(c(7, 'oro'))).toBe('el siete de oro')
    expect(cardNick(c(3, 'copa'))).toBe('un tres de copas')
  })
})

describe('resumen de la mano', () => {
  it('suma envido y truco y revela las cartas del rival al jugarse hasta el final', () => {
    let s = rigged(
      [c(1, 'espada'), c(7, 'espada'), c(6, 'espada')],
      [c(4, 'copa'), c(5, 'oro'), c(2, 'basto')],
    )
    s = act(s, 0, { t: 'envido', call: 'envido' })
    s = act(s, 1, { t: 'quiero' })
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'quiero' })
    s = act(s, 0, { t: 'play', index: 0 }) // ancho de espadas
    s = act(s, 1, { t: 'play', index: 0 })
    expect(trickWinningCard(s, 0)).toEqual({ seat: 0, card: c(1, 'espada') })
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })

    const summary = summarizeHand(s)!
    expect(summary.revealRival).toBe(true)
    expect(summary.envido?.mine.points).toBe(33)
    expect(summary.envido?.won).toBe(2)
    expect(summary.envido?.winner).toBe(0)
    expect(summary.tricks).toHaveLength(2)
    expect(summary.stakeLevel).toBe(1)
    // 2 del envido + 2 del truco
    expect(summary.total).toEqual([4, 0])
  })

  it('si alguien se va al mazo, el rival no muestra sus cartas', () => {
    let s = rigged(
      [c(4, 'oro'), c(5, 'copa'), c(6, 'basto')],
      [c(1, 'espada'), c(1, 'basto'), c(7, 'espada')],
    )
    s = act(s, 0, { t: 'fold' })
    const summary = summarizeHand(s)!
    expect(summary.revealRival).toBe(false)
    expect(summary.total).toEqual([0, 1])
  })

  it('un envido que no se quiere no muestra los tantos', () => {
    let s = rigged(
      [c(4, 'oro'), c(5, 'copa'), c(6, 'basto')],
      [c(1, 'espada'), c(1, 'basto'), c(7, 'espada')],
    )
    s = act(s, 0, { t: 'envido', call: 'real' })
    s = act(s, 1, { t: 'no' })
    expect(s.envidoResult?.accepted).toBe(false)
    expect(s.envidoResult?.chain).toEqual(['real'])
  })
})
