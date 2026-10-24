// IA del rival de truco. Decide con lo que un jugador de verdad puede ver: sus cartas, las que están en
// la mesa y los cantos. Nunca mira la mano del jugador.

import { envidoPoints, trucoRank, type Card } from './cards.ts'
import {
  canCallTruco,
  legalActions,
  other,
  type Action,
  type EnvidoCall,
  type Seat,
  type TrucoState,
} from './engine.ts'

export interface Profile {
  id: 'pibe' | 'rosa' | 'maestro'
  /** Qué tan seguido se tira un farol (0..1). */
  bluff: number
  /** Qué tan fácil acepta y sube la apuesta (0..1). */
  aggression: number
  /** Qué tan bien elige la carta (0..1). */
  skill: number
}

export const PROFILES: readonly Profile[] = [
  { id: 'pibe', bluff: 0.35, aggression: 0.35, skill: 0.45 },
  { id: 'rosa', bluff: 0.2, aggression: 0.5, skill: 0.75 },
  { id: 'maestro', bluff: 0.14, aggression: 0.6, skill: 0.97 },
]

/** Probabilidad aproximada de ganar la mano con lo que queda (0..1). */
export function winChance(s: TrucoState, seat: Seat): number {
  const hand = s.hands[seat]
  const ranks = hand.map(trucoRank).sort((a, b) => b - a)
  const top = (ranks[0] ?? 0) / 14
  const second = (ranks[1] ?? ranks[0] ?? 0) / 14
  let p = 0.55 * top + 0.35 * second + 0.1 * ((ranks[2] ?? 0) / 14)
  const won = s.tricks.filter((t) => t === seat).length
  const lost = s.tricks.filter((t) => t === other(seat)).length
  p += 0.22 * won - 0.25 * lost
  if (s.tricks.length > 0 && s.tricks[0] === -1) p += 0.12 // tras una parda, la carta alta decide
  return Math.max(0, Math.min(1, p))
}

function lowestIndex(hand: readonly Card[]): number {
  let best = 0
  for (let i = 1; i < hand.length; i++) {
    if (trucoRank(hand[i]!) < trucoRank(hand[best]!)) best = i
  }
  return best
}

function highestIndex(hand: readonly Card[]): number {
  let best = 0
  for (let i = 1; i < hand.length; i++) {
    if (trucoRank(hand[i]!) > trucoRank(hand[best]!)) best = i
  }
  return best
}

function chooseCard(s: TrucoState, seat: Seat, profile: Profile, random: () => number): number {
  const hand = s.hands[seat]
  if (hand.length === 1) return 0
  const idx = s.table[seat].length
  const opponentCard = s.table[other(seat)][idx]
  // Un jugador flojo a veces tira cualquier carta.
  if (random() > profile.skill) return Math.floor(random() * hand.length)

  if (opponentCard) {
    const target = trucoRank(opponentCard)
    let bestIndex = -1
    for (let i = 0; i < hand.length; i++) {
      const rank = trucoRank(hand[i]!)
      if (rank > target && (bestIndex === -1 || rank < trucoRank(hand[bestIndex]!))) bestIndex = i
    }
    // Si no le gana, tira la más baja (o empata si es la primera y no tiene con qué ganar).
    return bestIndex === -1 ? lowestIndex(hand) : bestIndex
  }
  if (s.tricks.length === 0) {
    // Primera baza: con mano fuerte tira la mejor, con mano floja la del medio para no regalar.
    const sorted = hand.map((c, i) => ({ i, r: trucoRank(c) })).sort((a, b) => a.r - b.r)
    return winChance(s, seat) > 0.6 ? highestIndex(hand) : sorted[Math.floor(sorted.length / 2)]!.i
  }
  return highestIndex(hand)
}

function envidoReply(
  s: TrucoState,
  seat: Seat,
  chain: readonly EnvidoCall[],
  profile: Profile,
  random: () => number,
): Action {
  const e = envidoPoints(s.dealt[seat])
  const last = chain[chain.length - 1]!
  const slack = (profile.aggression - 0.5) * 4
  const need = last === 'envido' ? 26 - slack : last === 'real' ? 29 - slack : 32 - slack
  const options = legalActions(s, seat)
  const can = (call: EnvidoCall) => options.some((a) => a.t === 'envido' && a.call === call)
  if (can('falta') && e >= 33 && random() < 0.5) return { t: 'envido', call: 'falta' }
  if (can('real') && e >= 30 && random() < 0.6) return { t: 'envido', call: 'real' }
  if (can('envido') && e >= 29 && random() < 0.35) return { t: 'envido', call: 'envido' }
  if (e >= need) return { t: 'quiero' }
  // Se tira un farol aceptando con tanto flojo.
  if (e >= need - 3 && random() < profile.bluff * 0.8) return { t: 'quiero' }
  return { t: 'no' }
}

function trucoReply(
  s: TrucoState,
  seat: Seat,
  level: 1 | 2 | 3,
  profile: Profile,
  random: () => number,
): Action {
  const p = winChance(s, seat)
  const options = legalActions(s, seat)
  const canRaise = options.some((a) => a.t === 'truco')
  const threshold = 0.4 + 0.09 * (level - 1) - (profile.aggression - 0.5) * 0.15
  if (canRaise && (p > 0.8 || (p > 0.5 && random() < profile.bluff * 0.25))) return { t: 'truco' }
  if (p >= threshold) return { t: 'quiero' }
  if (random() < profile.bluff * 0.5) return { t: 'quiero' }
  return { t: 'no' }
}

/** Elige la acción del rival en su turno (jugar, cantar o responder). */
export function chooseAction(
  s: TrucoState,
  seat: Seat,
  profile: Profile,
  random: () => number,
): Action {
  if (s.phase === 'handOver') return { t: 'next' }
  const pending = s.pending
  if (s.phase === 'respond' && pending) {
    return pending.kind === 'envido'
      ? envidoReply(s, seat, pending.chain, profile, random)
      : trucoReply(s, seat, pending.level, profile, random)
  }

  const options = legalActions(s, seat)
  const hasEnvido = options.some((a) => a.t === 'envido')
  if (hasEnvido) {
    const e = envidoPoints(s.dealt[seat])
    if (e >= 31 && random() < 0.7)
      return { t: 'envido', call: e >= 33 && random() < 0.3 ? 'falta' : 'real' }
    if (e >= 27 && random() < 0.55) return { t: 'envido', call: 'envido' }
    if (e < 22 && random() < profile.bluff * 0.1) return { t: 'envido', call: 'envido' }
  }
  if (canCallTruco(s, seat)) {
    const p = winChance(s, seat)
    if (p > 0.72 && random() < 0.5 + profile.aggression * 0.3) return { t: 'truco' }
    if (p > 0.3 && p < 0.55 && random() < profile.bluff * 0.1) return { t: 'truco' }
  }
  // Tirar la mano al mazo solo si ya no hay nada que hacer y la apuesta es alta.
  if (s.tricks.length > 0 && winChance(s, seat) < 0.06 && s.trucoLevel >= 2 && random() < 0.5) {
    return { t: 'fold' }
  }
  return { t: 'play', index: chooseCard(s, seat, profile, random) }
}
