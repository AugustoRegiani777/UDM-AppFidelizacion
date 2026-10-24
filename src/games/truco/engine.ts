// Motor del truco argentino (1 contra 1, sin flor). Funciones puras: cada acción devuelve un estado nuevo.
// Asiento 0 = jugador, asiento 1 = rival. Las reglas están escritas acá; la pantalla solo muestra.

import { envidoPoints, fullDeck, trucoRank, type Card } from './cards.ts'

export type Seat = 0 | 1
export type EnvidoCall = 'envido' | 'real' | 'falta'
export type Say =
  'truco' | 'retruco' | 'valecuatro' | 'envido' | 'real' | 'falta' | 'quiero' | 'no' | 'mazo'

export type Action =
  | { t: 'play'; index: number }
  | { t: 'truco' }
  | { t: 'envido'; call: EnvidoCall }
  | { t: 'quiero' }
  | { t: 'no' }
  | { t: 'fold' }
  | { t: 'next' }

export type Phase = 'play' | 'respond' | 'handOver' | 'matchOver'

export type PendingTruco = { kind: 'truco'; from: Seat; level: 1 | 2 | 3 }
export type PendingEnvido = {
  kind: 'envido'
  from: Seat
  chain: EnvidoCall[]
  /** Truco que quedó esperando respuesta mientras se resuelve el envido ("el envido está primero"). */
  suspended: PendingTruco | null
}
export type Pending = PendingTruco | PendingEnvido

export interface EnvidoResult {
  points: [number, number]
  winner: Seat
  /** Puntos que se lleva el ganador. */
  won: number
  accepted: boolean
}

export interface HandResult {
  winner: Seat
  points: number
  reason: 'tricks' | 'fold' | 'noquiero'
}

export type Ev =
  | { t: 'deal' }
  | { t: 'play'; seat: Seat; card: Card }
  | { t: 'say'; seat: Seat; what: Say }
  | { t: 'trick'; winner: Seat | -1 }
  | { t: 'envido'; result: EnvidoResult }
  | { t: 'hand'; result: HandResult }
  | { t: 'match'; winner: Seat }

export interface TrucoState {
  scores: [number, number]
  target: number
  mano: Seat
  hands: [Card[], Card[]]
  dealt: [Card[], Card[]]
  table: [(Card | null)[], (Card | null)[]]
  /** Ganador de cada baza jugada (-1 = parda). */
  tricks: (Seat | -1)[]
  turn: Seat
  /** Quién juega la próxima carta cuando termina una ronda de respuestas. */
  resumeTurn: Seat
  phase: Phase
  trucoLevel: 0 | 1 | 2 | 3
  trucoLast: Seat | null
  pending: Pending | null
  envidoDone: boolean
  envidoResult: EnvidoResult | null
  handResult: HandResult | null
  matchWinner: Seat | null
  handNumber: number
  rngState: number
  /** Eventos que generó la última acción (para animaciones y sonido). */
  events: Ev[]
}

export const STAKES = [1, 2, 3, 4] as const
export const stakeOf = (s: TrucoState) => STAKES[s.trucoLevel]
export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0)

// --- Azar con semilla ------------------------------------------------------------------------------

function nextRandom(s: TrucoState): number {
  s.rngState = (s.rngState + 0x6d2b79f5) >>> 0
  let t = Math.imul(s.rngState ^ (s.rngState >>> 15), 1 | s.rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffled(s: TrucoState): Card[] {
  const deck = fullDeck()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1))
    const tmp = deck[i]!
    deck[i] = deck[j]!
    deck[j] = tmp
  }
  return deck
}

/** Qué tan buena es una mano (para la suerte del mate y para la IA). */
export function handStrength(hand: readonly Card[]): number {
  return hand.reduce((sum, card) => sum + trucoRank(card), 0) + envidoPoints(hand) / 8
}

// --- Creación y reparto ----------------------------------------------------------------------------

export function createMatch(seed: number, target = 15): TrucoState {
  const s: TrucoState = {
    scores: [0, 0],
    target,
    mano: 1,
    hands: [[], []],
    dealt: [[], []],
    table: [[], []],
    tricks: [],
    turn: 0,
    resumeTurn: 0,
    phase: 'play',
    trucoLevel: 0,
    trucoLast: null,
    pending: null,
    envidoDone: false,
    envidoResult: null,
    handResult: null,
    matchWinner: null,
    handNumber: 0,
    rngState: seed >>> 0,
    events: [],
  }
  return dealHand(s, 0)
}

/**
 * Reparte una mano nueva. `luck` (0..3) es la suerte del mate del jugador: reparte 1 + luck manos
 * posibles y le da la mejor. Es una regla visible en pantalla, igual para todas las partidas.
 */
export function dealHand(prev: TrucoState, luck: number): TrucoState {
  const s = structuredClone(prev)
  let best: Card[] | null = null
  let bestOther: Card[] = []
  let bestScore = -1
  for (let k = 0; k <= Math.max(0, Math.min(3, Math.floor(luck))); k++) {
    const deck = shuffled(s)
    const mine = deck.slice(0, 3)
    const score = handStrength(mine)
    if (score > bestScore) {
      bestScore = score
      best = mine
      bestOther = deck.slice(3, 6)
    }
  }
  s.mano = other(s.mano)
  s.hands = [[...best!], [...bestOther]]
  s.dealt = [[...best!], [...bestOther]]
  s.table = [[], []]
  s.tricks = []
  s.turn = s.mano
  s.resumeTurn = s.mano
  s.phase = 'play'
  s.trucoLevel = 0
  s.trucoLast = null
  s.pending = null
  s.envidoDone = false
  s.envidoResult = null
  s.handResult = null
  s.handNumber++
  s.events = [{ t: 'deal' }]
  return s
}

// --- Qué se puede hacer ----------------------------------------------------------------------------

function trickIndex(s: TrucoState, seat: Seat): number {
  return s.table[seat].length
}

export function canCallTruco(s: TrucoState, seat: Seat): boolean {
  if (s.pending || s.phase !== 'play' || s.turn !== seat) return false
  return s.trucoLevel === 0 || (s.trucoLast !== seat && s.trucoLevel < 3)
}

function envidoOpen(s: TrucoState, seat: Seat): boolean {
  return !s.envidoDone && s.tricks.length === 0 && trickIndex(s, seat) === 0 && s.trucoLevel === 0
}

const RAISES: Record<EnvidoCall, EnvidoCall[]> = {
  envido: ['envido', 'real', 'falta'],
  real: ['falta'],
  falta: [],
}

export function legalActions(s: TrucoState, seat: Seat): Action[] {
  if (s.phase === 'handOver') return [{ t: 'next' }]
  if (s.phase === 'matchOver' || s.turn !== seat) return []
  const actions: Action[] = []
  if (s.phase === 'play') {
    s.hands[seat].forEach((_, index) => actions.push({ t: 'play', index }))
    if (canCallTruco(s, seat)) actions.push({ t: 'truco' })
    if (envidoOpen(s, seat)) {
      for (const call of ['envido', 'real', 'falta'] as const) actions.push({ t: 'envido', call })
    }
    actions.push({ t: 'fold' })
    return actions
  }
  // Hay que responder a un canto.
  const pending = s.pending!
  actions.push({ t: 'quiero' }, { t: 'no' })
  if (pending.kind === 'truco') {
    if (pending.level < 3) actions.push({ t: 'truco' })
    if (envidoOpen(s, seat)) {
      for (const call of ['envido', 'real', 'falta'] as const) actions.push({ t: 'envido', call })
    }
  } else {
    const last = pending.chain[pending.chain.length - 1]!
    for (const call of RAISES[last]) actions.push({ t: 'envido', call })
  }
  return actions
}

export function isLegal(s: TrucoState, seat: Seat, action: Action): boolean {
  return legalActions(s, seat).some(
    (a) =>
      a.t === action.t &&
      (a.t !== 'play' || a.index === (action as { index: number }).index) &&
      (a.t !== 'envido' || a.call === (action as { call: EnvidoCall }).call),
  )
}

// --- Puntos ----------------------------------------------------------------------------------------

function faltaValue(s: TrucoState): number {
  return Math.max(1, s.target - Math.max(s.scores[0], s.scores[1]))
}

const CALL_POINTS: Record<EnvidoCall, number> = { envido: 2, real: 3, falta: 0 }

/** Puntos de una cadena de envidos aceptada. La falta envido vale lo que falta para ganar. */
function chainPoints(s: TrucoState, chain: readonly EnvidoCall[]): number {
  if (chain.includes('falta')) return faltaValue(s)
  return chain.reduce((sum, call) => sum + CALL_POINTS[call], 0)
}

/** Si no se quiere: el que cantó se lleva lo anterior a su último canto (mínimo 1). */
function declinedPoints(s: TrucoState, chain: readonly EnvidoCall[]): number {
  const before = chain.slice(0, -1)
  return before.length === 0 ? 1 : chainPoints(s, before)
}

function award(s: TrucoState, seat: Seat, points: number) {
  s.scores[seat] += points
}

function endHand(s: TrucoState, result: HandResult) {
  award(s, result.winner, result.points)
  s.handResult = result
  s.pending = null
  s.events.push({ t: 'hand', result })
  if (s.scores[result.winner] >= s.target) {
    s.phase = 'matchOver'
    s.matchWinner = result.winner
    s.events.push({ t: 'match', winner: result.winner })
  } else {
    s.phase = 'handOver'
  }
}

function checkMatchOverFromEnvido(s: TrucoState) {
  for (const seat of [0, 1] as const) {
    if (s.scores[seat] >= s.target && s.phase !== 'matchOver') {
      // El envido ya llevó a alguien al final: la partida termina sin jugar más cartas.
      s.phase = 'matchOver'
      s.matchWinner = seat
      s.handResult = { winner: seat, points: 0, reason: 'tricks' }
      s.pending = null
      s.events.push({ t: 'match', winner: seat })
    }
  }
}

function resolveEnvido(s: TrucoState, pending: PendingEnvido, accepted: boolean) {
  const points: [number, number] = [envidoPoints(s.dealt[0]), envidoPoints(s.dealt[1])]
  let winner: Seat
  let won: number
  if (accepted) {
    winner = points[0] > points[1] ? 0 : points[1] > points[0] ? 1 : s.mano
    won = chainPoints(s, pending.chain)
  } else {
    winner = pending.from
    won = declinedPoints(s, pending.chain)
  }
  award(s, winner, won)
  s.envidoDone = true
  s.envidoResult = { points, winner, won, accepted }
  s.events.push({ t: 'envido', result: s.envidoResult })

  const suspended = pending.suspended
  if (suspended) {
    // El truco que estaba cantado vuelve a esperar respuesta.
    s.pending = suspended
    s.turn = other(suspended.from)
    s.phase = 'respond'
  } else {
    s.pending = null
    s.turn = s.resumeTurn
    s.phase = 'play'
  }
  checkMatchOverFromEnvido(s)
}

// --- Cartas y bazas --------------------------------------------------------------------------------

function handWinnerFromTricks(s: TrucoState): Seat | null {
  const t = s.tricks
  if (t.length < 2) return null
  const [a, b, c] = t
  if (a !== -1 && b !== -1) {
    if (a === b) return a as Seat
    if (t.length === 2) return null
    return c === -1 ? (a as Seat) : (c as Seat)
  }
  if (a !== -1 && b === -1) return a as Seat
  if (a === -1 && b !== -1) return b as Seat
  // Parda las dos primeras: decide la tercera; si también empata, gana la mano.
  if (t.length === 2) return null
  return c === -1 ? s.mano : (c as Seat)
}

function playCard(s: TrucoState, seat: Seat, index: number) {
  const card = s.hands[seat].splice(index, 1)[0]!
  const idx = trickIndex(s, seat)
  s.table[seat][idx] = card
  s.events.push({ t: 'play', seat, card })
  const opponent = s.table[other(seat)][idx]
  if (!opponent) {
    s.turn = other(seat)
    s.resumeTurn = other(seat)
    return
  }
  const mine = trucoRank(card)
  const theirs = trucoRank(opponent)
  const winner: Seat | -1 = mine > theirs ? seat : theirs > mine ? other(seat) : -1
  s.tricks.push(winner)
  s.events.push({ t: 'trick', winner })
  const handWinner = handWinnerFromTricks(s)
  if (handWinner !== null) {
    endHand(s, { winner: handWinner, points: stakeOf(s), reason: 'tricks' })
    return
  }
  const leader: Seat = winner === -1 ? s.mano : winner
  s.turn = leader
  s.resumeTurn = leader
}

// --- Acción principal ------------------------------------------------------------------------------

const TRUCO_SAY: Record<1 | 2 | 3, Say> = { 1: 'truco', 2: 'retruco', 3: 'valecuatro' }

/** Aplica una acción. Lanza si no es legal (la pantalla y la IA solo mandan acciones legales). */
export function act(prev: TrucoState, seat: Seat, action: Action, luck = 0): TrucoState {
  if (action.t === 'next') {
    if (prev.phase !== 'handOver') throw new Error('no hay mano para repartir')
    return dealHand(prev, luck)
  }
  if (!isLegal(prev, seat, action)) throw new Error(`acción ilegal: ${JSON.stringify(action)}`)
  const s = structuredClone(prev)
  s.events = []

  switch (action.t) {
    case 'play':
      playCard(s, seat, action.index)
      break

    case 'fold':
      s.events.push({ t: 'say', seat, what: 'mazo' })
      endHand(s, { winner: other(seat), points: stakeOf(s), reason: 'fold' })
      break

    case 'truco': {
      const pending = s.pending
      if (pending && pending.kind === 'truco') {
        // "Quiero y retruco": se acepta lo anterior y se sube la apuesta.
        s.trucoLevel = pending.level
        s.trucoLast = pending.from
      }
      const level = (s.trucoLevel + 1) as 1 | 2 | 3
      s.events.push({ t: 'say', seat, what: TRUCO_SAY[level] })
      s.pending = { kind: 'truco', from: seat, level }
      s.turn = other(seat)
      s.phase = 'respond'
      break
    }

    case 'envido': {
      const pending = s.pending
      s.events.push({ t: 'say', seat, what: action.call })
      if (pending && pending.kind === 'envido') {
        pending.chain.push(action.call)
        pending.from = seat
      } else {
        s.pending = {
          kind: 'envido',
          from: seat,
          chain: [action.call],
          suspended: pending && pending.kind === 'truco' ? pending : null,
        }
      }
      s.turn = other(seat)
      s.phase = 'respond'
      break
    }

    case 'quiero': {
      const pending = s.pending!
      s.events.push({ t: 'say', seat, what: 'quiero' })
      if (pending.kind === 'truco') {
        s.trucoLevel = pending.level
        s.trucoLast = pending.from
        s.pending = null
        s.turn = s.resumeTurn
        s.phase = 'play'
      } else {
        resolveEnvido(s, pending, true)
      }
      break
    }

    case 'no': {
      const pending = s.pending!
      s.events.push({ t: 'say', seat, what: 'no' })
      if (pending.kind === 'truco') {
        endHand(s, { winner: pending.from, points: stakeOf(s), reason: 'noquiero' })
      } else {
        resolveEnvido(s, pending, false)
      }
      break
    }
  }
  return s
}

/** Cuántos puntos le faltan a cada uno para ganar. */
export const pointsLeft = (s: TrucoState, seat: Seat) => Math.max(0, s.target - s.scores[seat])
