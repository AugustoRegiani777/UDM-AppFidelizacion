// IA del rival de truco. Decide con lo que un jugador de verdad puede ver: sus cartas, las que están en
// la mesa, los cantos y el marcador. Nunca mira la mano del jugador. Todo el azar entra por `random`,
// así que con una semilla las decisiones se repiten (y se pueden testear).
//
// Cada rival tiene su personalidad:
// - El Pibe (principiante): honesto y conservador. Canta lo que tiene, casi no miente y nunca se va al mazo.
// - Doña Rosa (intermedia): equilibrada. Algún farol de vez en cuando y sabe cuándo bajarse.
// - El Maestro (experto): agresivo y mentiroso. Canta sin tener, miente con el quiero / no quiero según
//   el marcador, se va al mazo a tiempo y a veces arriesga una falta envido.

import { envidoPoints, trucoRank, type Card } from './cards.ts'
import {
  canCallTruco,
  legalActions,
  other,
  stakeOf,
  type Action,
  type EnvidoCall,
  type Seat,
  type TrucoState,
} from './engine.ts'

export interface Profile {
  id: 'pibe' | 'rosa' | 'maestro'
  /** Qué tan seguido canta sin tener juego (0..1). */
  bluff: number
  /** Qué tan fácil acepta y sube la apuesta (0..1). */
  aggression: number
  /** Qué tan bien elige la carta (0..1). */
  skill: number
  /** Qué tan seguido miente al responder quiero / no quiero (0..1). */
  lie: number
  /** Cuánto le cambia el marcador el apetito de riesgo (0..1). */
  risk: number
  /** Qué tan dispuesto está a irse al mazo cuando la mano está perdida (0..1). */
  foldiness: number
  /** Chance de arriesgar una falta envido sin tener tanto (0..1). */
  faltaBluff: number
}

export const PROFILES: readonly Profile[] = [
  {
    id: 'pibe',
    bluff: 0.01,
    aggression: 0.3,
    skill: 0.45,
    lie: 0,
    risk: 0,
    foldiness: 0,
    faltaBluff: 0,
  },
  {
    id: 'rosa',
    bluff: 0.14,
    aggression: 0.5,
    skill: 0.75,
    lie: 0.08,
    risk: 0.3,
    foldiness: 0.3,
    faltaBluff: 0.01,
  },
  {
    id: 'maestro',
    bluff: 0.5,
    aggression: 0.75,
    skill: 0.97,
    lie: 0.32,
    risk: 0.85,
    foldiness: 0.8,
    faltaBluff: 0.07,
  },
]

/** Cómo mintió (si mintió) una decisión: `bluff` = cantó sin tener, `lie` = mintió al responder. */
export type Deceit = 'bluff' | 'lie' | null

export interface Decision {
  action: Action
  deceit: Deceit
}

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

/**
 * Apetito de riesgo según el marcador: más de 1 si va perdiendo (se la juega), menos de 1 si va ganando
 * y cuida la ventaja. Los perfiles prudentes casi no lo sienten.
 */
export function riskMultiplier(s: TrucoState, seat: Seat, profile: Profile): number {
  const behind = (s.scores[other(seat)] - s.scores[seat]) / s.target
  let mul = 1 + profile.risk * behind * 1.6
  // Si el rival está por ganar la partida, no hay nada que cuidar.
  if (s.target - s.scores[other(seat)] <= 3) mul += profile.risk * 0.3
  return Math.max(0.4, Math.min(2, mul))
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

const honest = (action: Action): Decision => ({ action, deceit: null })

function envidoReply(
  s: TrucoState,
  seat: Seat,
  chain: readonly EnvidoCall[],
  profile: Profile,
  random: () => number,
): Decision {
  const e = envidoPoints(s.dealt[seat])
  const last = chain[chain.length - 1]!
  const mul = riskMultiplier(s, seat, profile)
  const slack = (profile.aggression - 0.5) * 4 + (mul - 1) * 2
  const need = last === 'envido' ? 26 - slack : last === 'real' ? 29 - slack : 32 - slack
  const options = legalActions(s, seat)
  const can = (call: EnvidoCall) => options.some((a) => a.t === 'envido' && a.call === call)

  // Subir con juego de verdad.
  if (can('falta') && e >= 33 && random() < 0.5) return honest({ t: 'envido', call: 'falta' })
  if (can('real') && e >= 30 && random() < 0.6) return honest({ t: 'envido', call: 'real' })
  if (can('envido') && e >= 29 && random() < 0.35) return honest({ t: 'envido', call: 'envido' })

  // Subir sin tener (farol): solo los que mienten, y más si el marcador los empuja.
  if (e < need - 1) {
    if (can('falta') && random() < profile.faltaBluff * mul) {
      return { action: { t: 'envido', call: 'falta' }, deceit: 'bluff' }
    }
    if (random() < profile.bluff * 0.3 * mul) {
      const call: EnvidoCall | null = can('real') ? 'real' : can('envido') ? 'envido' : null
      if (call) return { action: { t: 'envido', call }, deceit: 'bluff' }
    }
  }

  if (e >= need) {
    // Tiene para querer, pero a veces dice que no para esconder que tiene (solo si va ganando).
    if (e < need + 2 && mul < 1 && random() < profile.lie * 0.25) {
      return { action: { t: 'no' }, deceit: 'lie' }
    }
    return honest({ t: 'quiero' })
  }
  // Acepta con tanto flojo para que el otro dude.
  if (e >= need - 3 && random() < Math.max(profile.bluff * 0.8, profile.lie * mul * 0.6)) {
    return { action: { t: 'quiero' }, deceit: 'lie' }
  }
  return honest({ t: 'no' })
}

function trucoReply(
  s: TrucoState,
  seat: Seat,
  level: 1 | 2 | 3,
  profile: Profile,
  random: () => number,
): Decision {
  const p = winChance(s, seat)
  const mul = riskMultiplier(s, seat, profile)
  const options = legalActions(s, seat)
  const canRaise = options.some((a) => a.t === 'truco')
  const threshold = 0.4 + 0.09 * (level - 1) - (profile.aggression - 0.5) * 0.15 - (mul - 1) * 0.08

  if (canRaise && p > 0.8) return honest({ t: 'truco' })
  // "Quiero y retruco" sin tener: el farol más caro.
  if (canRaise && p < threshold + 0.12 && random() < profile.bluff * 0.3 * mul) {
    return { action: { t: 'truco' }, deceit: 'bluff' }
  }
  if (p >= threshold) {
    // Con una mano justa y la apuesta alta, el que va ganando dice que no para cuidar la ventaja.
    if (level >= 2 && mul < 1 && p < threshold + 0.1 && random() < profile.lie * 0.5) {
      return { action: { t: 'no' }, deceit: 'lie' }
    }
    return honest({ t: 'quiero' })
  }
  // Mano floja: acepta igual para que el otro dude (más si va perdiendo).
  if (p >= threshold - 0.15 && random() < profile.lie * mul) {
    return { action: { t: 'quiero' }, deceit: 'lie' }
  }
  if (random() < profile.bluff * 0.3) return { action: { t: 'quiero' }, deceit: 'lie' }
  return honest({ t: 'no' })
}

/** Elige la acción del rival y dice si fue un farol o una mentira (para los tests y para afinar). */
export function decide(
  s: TrucoState,
  seat: Seat,
  profile: Profile,
  random: () => number,
): Decision {
  if (s.phase === 'handOver') return honest({ t: 'next' })
  const pending = s.pending
  if (s.phase === 'respond' && pending) {
    return pending.kind === 'envido'
      ? envidoReply(s, seat, pending.chain, profile, random)
      : trucoReply(s, seat, pending.level, profile, random)
  }

  const options = legalActions(s, seat)
  const hasEnvido = options.some((a) => a.t === 'envido')
  const mul = riskMultiplier(s, seat, profile)
  // Un jugador audaz baja un poco la vara; uno prudente la sube.
  const shift = Math.round((0.5 - profile.aggression) * 4)

  if (hasEnvido) {
    const e = envidoPoints(s.dealt[seat])
    if (e >= 31 + shift && random() < 0.7) {
      return honest({ t: 'envido', call: e >= 33 + shift && random() < 0.3 ? 'falta' : 'real' })
    }
    if (e >= 27 + shift && random() < 0.55) return honest({ t: 'envido', call: 'envido' })
    if (e <= 24) {
      if (random() < profile.faltaBluff * mul) {
        return { action: { t: 'envido', call: 'falta' }, deceit: 'bluff' }
      }
      if (random() < profile.bluff * 0.45 * mul) {
        return {
          action: { t: 'envido', call: random() < 0.7 ? 'envido' : 'real' },
          deceit: 'bluff',
        }
      }
    }
  }

  const p = winChance(s, seat)
  if (canCallTruco(s, seat)) {
    if (p > 0.72 && random() < 0.5 + profile.aggression * 0.3) return honest({ t: 'truco' })
    if (p < 0.45 && random() < profile.bluff * 0.3 * mul) {
      return { action: { t: 'truco' }, deceit: 'bluff' }
    }
  }

  // Irse al mazo a tiempo: la mano está perdida y no vale la pena seguir pagando.
  if (s.tricks.length > 0 && p < 0.1) {
    const weight = stakeOf(s) >= 2 ? 1 : 0.4
    if (random() < profile.foldiness * weight) return honest({ t: 'fold' })
  }
  return honest({ t: 'play', index: chooseCard(s, seat, profile, random) })
}

/** Elige la acción del rival en su turno (jugar, cantar o responder). */
export function chooseAction(
  s: TrucoState,
  seat: Seat,
  profile: Profile,
  random: () => number,
): Action {
  return decide(s, seat, profile, random).action
}
