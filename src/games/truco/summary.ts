// Resumen de una mano de truco: de dónde salieron los puntos. Es una función pura sobre el estado,
// así la pantalla solo dibuja y los tests pueden comprobar cada cuenta.

import { envidoBreakdown, type Card, type EnvidoBreakdown } from './cards.ts'
import { type EnvidoCall, type HandResult, type Seat, type TrucoState } from './engine.ts'

export interface TrickLine {
  /** Número de baza (1 a 3). */
  number: number
  mine: Card
  rival: Card
  /** Quién la ganó (-1 = parda). */
  winner: Seat | -1
}

export interface EnvidoSummary {
  accepted: boolean
  chain: EnvidoCall[]
  winner: Seat
  /** Puntos que se llevó el ganador del envido. */
  won: number
  mine: EnvidoBreakdown
  rival: EnvidoBreakdown
  /** El rival muestra sus cartas solo si el envido se quiso (si no, nadie las ve). */
  revealed: boolean
  /** Hubo empate de tanto y ganó el que es mano. */
  tiedByMano: boolean
}

export interface HandSummary {
  result: HandResult
  /** 0 = Mano, 1 = Truco, 2 = Retruco, 3 = Vale cuatro. */
  stakeLevel: 0 | 1 | 2 | 3
  mineDealt: Card[]
  rivalDealt: Card[]
  /** Las cartas del rival se muestran todas si la mano se jugó hasta el final. */
  revealRival: boolean
  tricks: TrickLine[]
  envido: EnvidoSummary | null
  /** Puntos que sumó cada uno en esta mano (envido + mano). */
  total: [number, number]
}

export function summarizeHand(s: TrucoState): HandSummary | null {
  const result = s.handResult
  if (!result) return null

  const tricks: TrickLine[] = []
  s.tricks.forEach((winner, i) => {
    const mine = s.table[0][i]
    const rival = s.table[1][i]
    if (mine && rival) tricks.push({ number: i + 1, mine, rival, winner })
  })

  let envido: EnvidoSummary | null = null
  const er = s.envidoResult
  if (er) {
    const mine = envidoBreakdown(s.dealt[0])
    const rival = envidoBreakdown(s.dealt[1])
    envido = {
      accepted: er.accepted,
      chain: er.chain ?? [],
      winner: er.winner,
      won: er.won,
      mine,
      rival,
      revealed: er.accepted,
      tiedByMano: er.accepted && er.points[0] === er.points[1],
    }
  }

  const total: [number, number] = [0, 0]
  if (envido) total[envido.winner] += envido.won
  total[result.winner] += result.points

  return {
    result,
    stakeLevel: s.trucoLevel,
    mineDealt: s.dealt[0],
    rivalDealt: s.dealt[1],
    revealRival: result.reason === 'tricks' && result.points > 0,
    tricks,
    envido,
    total,
  }
}

/** Resumen de un envido recién resuelto (sin que la mano haya terminado). */
export function summarizeEnvido(s: TrucoState): EnvidoSummary | null {
  const er = s.envidoResult
  if (!er) return null
  return {
    accepted: er.accepted,
    chain: er.chain ?? [],
    winner: er.winner,
    won: er.won,
    mine: envidoBreakdown(s.dealt[0]),
    rival: envidoBreakdown(s.dealt[1]),
    revealed: er.accepted,
    tiedByMano: er.accepted && er.points[0] === er.points[1],
  }
}

/** Qué carta ganó una baza (null si fue parda). */
export function trickWinningCard(s: TrucoState, index: number): { seat: Seat; card: Card } | null {
  const winner = s.tricks[index]
  if (winner === undefined || winner === -1) return null
  const card = s.table[winner][index]
  return card ? { seat: winner, card } : null
}
