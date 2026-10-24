// @vitest-environment node
import { cardId, envidoPoints, fullDeck, trucoRank, type Card } from './cards.ts'
import { chooseAction, PROFILES, type Profile } from './ai.ts'
import {
  act,
  createMatch,
  dealHand,
  handStrength,
  isLegal,
  legalActions,
  stakeOf,
  type Action,
  type Seat,
  type TrucoState,
} from './engine.ts'

const c = (n: number, suit: Card['suit']): Card => ({ n, suit })

/** Arma una mano con cartas fijas (mano = quien juega primero). */
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

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('cartas', () => {
  it('la baraja tiene 40 cartas distintas', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(40)
    expect(new Set(deck.map(cardId)).size).toBe(40)
  })

  it('la jerarquía del truco está en orden', () => {
    const order: Card[] = [
      c(1, 'espada'),
      c(1, 'basto'),
      c(7, 'espada'),
      c(7, 'oro'),
      c(3, 'copa'),
      c(2, 'oro'),
      c(1, 'copa'),
      c(12, 'basto'),
      c(11, 'oro'),
      c(10, 'espada'),
      c(7, 'copa'),
      c(6, 'basto'),
      c(5, 'oro'),
      c(4, 'copa'),
    ]
    for (let i = 1; i < order.length; i++) {
      expect(trucoRank(order[i - 1]!)).toBeGreaterThan(trucoRank(order[i]!))
    }
    // Los tres de cualquier palo valen lo mismo, y los dos también.
    expect(trucoRank(c(3, 'oro'))).toBe(trucoRank(c(3, 'basto')))
    expect(trucoRank(c(2, 'copa'))).toBe(trucoRank(c(2, 'espada')))
    expect(trucoRank(c(1, 'oro'))).toBe(trucoRank(c(1, 'copa')))
  })

  it('calcula el envido', () => {
    expect(envidoPoints([c(7, 'oro'), c(6, 'oro'), c(1, 'copa')])).toBe(33)
    expect(envidoPoints([c(12, 'oro'), c(11, 'oro'), c(5, 'copa')])).toBe(20)
    expect(envidoPoints([c(7, 'oro'), c(5, 'copa'), c(2, 'basto')])).toBe(7)
    expect(envidoPoints([c(12, 'oro'), c(11, 'copa'), c(10, 'basto')])).toBe(0)
    expect(envidoPoints([c(4, 'oro'), c(5, 'oro'), c(6, 'oro')])).toBe(31)
  })
})

describe('bazas', () => {
  it('gana la mano quien gana dos bazas', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(2, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.tricks).toEqual([0])
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.phase).toBe('handOver')
    expect(s.handResult).toEqual({ winner: 0, points: 1, reason: 'tricks' })
    expect(s.scores).toEqual([1, 0])
  })

  it('con la primera parda decide la segunda', () => {
    let s = rigged(
      [c(3, 'oro'), c(4, 'copa'), c(5, 'copa')],
      [c(3, 'copa'), c(1, 'espada'), c(2, 'copa')],
    )
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.tricks).toEqual([-1])
    expect(s.turn).toBe(0) // tras una parda juega primero la mano
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.handResult?.winner).toBe(1)
  })

  it('si gana la primera y empata la segunda, gana la primera', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(3, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.tricks).toEqual([0, -1])
    expect(s.handResult?.winner).toBe(0)
  })

  it('si todo empata gana la mano', () => {
    let s = rigged(
      [c(3, 'oro'), c(2, 'oro'), c(4, 'oro')],
      [c(3, 'copa'), c(2, 'copa'), c(4, 'copa')],
      1,
    )
    for (let i = 0; i < 3; i++) {
      s = act(s, s.turn, { t: 'play', index: 0 })
      s = act(s, s.turn, { t: 'play', index: 0 })
    }
    expect(s.tricks).toEqual([-1, -1, -1])
    expect(s.handResult?.winner).toBe(1)
  })

  it('el que gana una baza juega primero la siguiente', () => {
    let s = rigged(
      [c(4, 'oro'), c(3, 'oro'), c(2, 'oro')],
      [c(1, 'espada'), c(5, 'copa'), c(6, 'copa')],
    )
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.turn).toBe(1)
    expect(isLegal(s, 0, { t: 'play', index: 0 })).toBe(false)
  })
})

describe('truco', () => {
  it('quiero: la mano pasa a valer 2 y sigue el juego', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(2, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'truco' })
    expect(s.phase).toBe('respond')
    expect(s.turn).toBe(1)
    s = act(s, 1, { t: 'quiero' })
    expect(stakeOf(s)).toBe(2)
    expect(s.phase).toBe('play')
    expect(s.turn).toBe(0)
  })

  it('no quiero: el que cantó se lleva 1 punto', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(2, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'no' })
    expect(s.handResult).toEqual({ winner: 0, points: 1, reason: 'noquiero' })
    expect(s.scores).toEqual([1, 0])
  })

  it('retruco y vale cuatro suben la apuesta; el que cantó último no puede subir', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(2, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'truco' }) // quiero y retruco
    expect(s.pending).toMatchObject({ kind: 'truco', level: 2, from: 1 })
    expect(stakeOf(s)).toBe(2)
    s = act(s, 0, { t: 'truco' }) // quiero y vale cuatro
    s = act(s, 1, { t: 'quiero' })
    expect(stakeOf(s)).toBe(4)
    expect(legalActions(s, 0).some((a) => a.t === 'truco')).toBe(false)
    expect(legalActions(s, 1).some((a) => a.t === 'truco')).toBe(false)
  })

  it('rechazar un retruco da los puntos del truco aceptado', () => {
    let s = rigged(
      [c(1, 'espada'), c(3, 'oro'), c(4, 'copa')],
      [c(2, 'oro'), c(2, 'copa'), c(5, 'basto')],
    )
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'truco' })
    s = act(s, 0, { t: 'no' })
    expect(s.handResult).toEqual({ winner: 1, points: 2, reason: 'noquiero' })
  })

  it('ir al mazo regala la mano con la apuesta actual', () => {
    let s = rigged(
      [c(4, 'oro'), c(5, 'oro'), c(6, 'oro')],
      [c(1, 'espada'), c(1, 'basto'), c(7, 'oro')],
    )
    s = act(s, 0, { t: 'fold' })
    expect(s.handResult).toEqual({ winner: 1, points: 1, reason: 'fold' })
  })

  it('la mano ganada vale lo que se aceptó', () => {
    let s = rigged(
      [c(1, 'espada'), c(1, 'basto'), c(4, 'copa')],
      [c(4, 'oro'), c(5, 'copa'), c(6, 'basto')],
    )
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'quiero' })
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    s = act(s, 0, { t: 'play', index: 0 })
    s = act(s, 1, { t: 'play', index: 0 })
    expect(s.handResult).toEqual({ winner: 0, points: 2, reason: 'tricks' })
  })
})

describe('envido', () => {
  it('quiero: gana el tanto más alto y suma 2', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s = act(s, 0, { t: 'envido', call: 'envido' })
    s = act(s, 1, { t: 'quiero' })
    expect(s.envidoResult).toMatchObject({ winner: 0, won: 2, points: [33, 5] })
    expect(s.scores).toEqual([2, 0])
    expect(s.phase).toBe('play')
  })

  it('no quiero: el que cantó se lleva 1', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s = act(s, 0, { t: 'envido', call: 'envido' })
    s = act(s, 1, { t: 'no' })
    expect(s.scores).toEqual([1, 0])
  })

  it('envido, real envido y quiero: 5 puntos; si no quiere, 2', () => {
    const start = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    let s = act(start, 0, { t: 'envido', call: 'envido' })
    s = act(s, 1, { t: 'envido', call: 'real' })
    s = act(s, 0, { t: 'quiero' })
    expect(s.scores).toEqual([5, 0])

    let t = act(start, 0, { t: 'envido', call: 'envido' })
    t = act(t, 1, { t: 'envido', call: 'real' })
    t = act(t, 0, { t: 'no' })
    expect(t.scores).toEqual([0, 2])
  })

  it('falta envido vale lo que falta para ganar', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s.scores = [4, 9]
    s = act(s, 0, { t: 'envido', call: 'falta' })
    s = act(s, 1, { t: 'quiero' })
    expect(s.scores).toEqual([4 + 6, 9])
  })

  it('con tanto igual gana la mano', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(7, 'copa'), c(6, 'copa'), c(1, 'oro')],
      1,
    )
    s = act(s, 1, { t: 'envido', call: 'envido' })
    s = act(s, 0, { t: 'quiero' })
    expect(s.envidoResult?.winner).toBe(1)
  })

  it('solo se puede cantar antes de jugar la primera carta y sin truco aceptado', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s = act(s, 0, { t: 'play', index: 0 })
    expect(legalActions(s, 0).some((a) => a.t === 'envido')).toBe(false)
    // El segundo en jugar todavía puede cantar.
    expect(legalActions(s, 1).some((a) => a.t === 'envido')).toBe(true)
    s = act(s, 1, { t: 'play', index: 0 })
    expect(legalActions(s, s.turn).some((a) => a.t === 'envido')).toBe(false)

    let t = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    t = act(t, 0, { t: 'truco' })
    t = act(t, 1, { t: 'quiero' })
    expect(legalActions(t, 0).some((a) => a.t === 'envido')).toBe(false)
  })

  it('"el envido está primero": se resuelve y el truco sigue esperando respuesta', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s = act(s, 0, { t: 'truco' })
    s = act(s, 1, { t: 'envido', call: 'envido' })
    s = act(s, 0, { t: 'quiero' })
    expect(s.scores).toEqual([2, 0])
    expect(s.phase).toBe('respond')
    expect(s.pending).toMatchObject({ kind: 'truco', from: 0 })
    expect(s.turn).toBe(1)
    s = act(s, 1, { t: 'quiero' })
    expect(stakeOf(s)).toBe(2)
  })

  it('un envido puede terminar la partida', () => {
    let s = rigged(
      [c(7, 'oro'), c(6, 'oro'), c(1, 'copa')],
      [c(5, 'copa'), c(4, 'basto'), c(2, 'espada')],
    )
    s.scores = [13, 0]
    s = act(s, 0, { t: 'envido', call: 'envido' })
    s = act(s, 1, { t: 'quiero' })
    expect(s.phase).toBe('matchOver')
    expect(s.matchWinner).toBe(0)
  })
})

describe('reparto y suerte', () => {
  it('es reproducible con la misma semilla', () => {
    expect(createMatch(5).hands).toEqual(createMatch(5).hands)
    expect(createMatch(5).hands).not.toEqual(createMatch(6).hands)
  })

  it('reparte 3 cartas distintas a cada uno', () => {
    const s = createMatch(11)
    const ids = [...s.hands[0], ...s.hands[1]].map(cardId)
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(6)
  })

  it('la suerte del mate mejora las cartas del jugador de forma medible', () => {
    const average = (luck: number) => {
      let total = 0
      let s = createMatch(1)
      for (let i = 0; i < 400; i++) {
        s = dealHand({ ...s, rngState: i * 977 + 3 }, luck)
        total += handStrength(s.hands[0])
      }
      return total / 400
    }
    expect(average(3)).toBeGreaterThan(average(1) + 1)
    expect(average(1)).toBeGreaterThan(average(0) + 0.5)
  })
})

describe('partidas completas con la IA', () => {
  function playMatch(seed: number, p0: Profile, p1: Profile) {
    const random = rng(seed * 31 + 7)
    let s = createMatch(seed)
    let guard = 0
    while (s.phase !== 'matchOver') {
      if (++guard > 4000) throw new Error('la partida no termina')
      const seat: Seat = s.phase === 'handOver' ? 0 : s.turn
      const action: Action = chooseAction(s, seat, seat === 0 ? p0 : p1, random)
      s = act(s, seat, action)
    }
    return s
  }

  it('toda partida termina con un ganador y sin acciones ilegales', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const profile = PROFILES[seed % PROFILES.length]!
      const s = playMatch(seed, profile, PROFILES[(seed + 1) % PROFILES.length]!)
      expect(s.matchWinner).not.toBeNull()
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(15)
    }
  })

  it('el rival más hábil le gana al más flojo más seguido', () => {
    let maestroWins = 0
    const games = 40
    for (let seed = 1; seed <= games; seed++) {
      const s =
        seed % 2 === 0
          ? playMatch(seed, PROFILES[2]!, PROFILES[0]!)
          : playMatch(seed, PROFILES[0]!, PROFILES[2]!)
      const maestroSeat = seed % 2 === 0 ? 0 : 1
      if (s.matchWinner === maestroSeat) maestroWins++
    }
    expect(maestroWins).toBeGreaterThan(games / 2)
  })
})
