// Reproducción de una partida a partir de la semilla y las entradas grabadas.
// El servidor la usa para decidir si la partida realmente se ganó (el celular solo manda las entradas).

import { NO_DIR, POWERS, UPGRADES, type GameConfig } from './config.ts'
import {
  createGame,
  pick,
  scoreOf,
  step,
  type EndReason,
  type GameState,
  type GameStatus,
} from './sim.ts'

export interface InputLog {
  /** Cambios de dirección: [tick, dirección 0..16]. */
  moves: [number, number][]
  /** Mejoras elegidas al subir de nivel: [tick, índice 0..2]. */
  picks: [number, number][]
  /** Poderes soltados: [tick, poder 0..2]. Es opcional: un registro sin él no soltó ninguno. */
  casts?: [number, number][]
}

export interface ReplayResult {
  valid: boolean
  status: GameStatus
  ticks: number
  kills: number
  level: number
  hp: number
  /** Puntaje de la partida (más alto cuanto más rápido cae la Reina). */
  score: number
  endReason: EndReason
}

const MAX_MOVES = 6000
const MAX_PICKS = UPGRADES.reduce((sum, u) => sum + u.maxLevel, 0)
const MAX_CASTS = 400

function isPair(value: unknown, maxSecond: number): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    value[0] >= 0 &&
    Number.isInteger(value[1]) &&
    value[1] >= 0 &&
    value[1] <= maxSecond
  )
}

/** Valida la forma del registro (viene del cliente, así que no se confía en nada). */
export function isValidLog(log: unknown): log is InputLog {
  if (typeof log !== 'object' || log === null) return false
  const { moves, picks, casts } = log as Record<string, unknown>
  if (!Array.isArray(moves) || !Array.isArray(picks)) return false
  if (moves.length > MAX_MOVES || picks.length > MAX_PICKS) return false
  if (casts !== undefined) {
    if (!Array.isArray(casts) || casts.length > MAX_CASTS) return false
    if (!casts.every((c) => isPair(c, POWERS.length - 1))) return false
  }
  return moves.every((m) => isPair(m, NO_DIR)) && picks.every((p) => isPair(p, 2))
}

/** Simula la partida completa con las entradas dadas. Devuelve también el estado final. */
export function replay(
  config: GameConfig,
  seed: number,
  log: InputLog,
): ReplayResult & { state: GameState } {
  const state = createGame(config, seed)
  let moveIndex = 0
  let pickIndex = 0
  let castIndex = 0
  const casts = log.casts ?? []
  let dir = NO_DIR
  let valid = true

  while (state.status === 'playing') {
    if (state.pending) {
      const choice = log.picks[pickIndex++]
      if (!choice || !pick(state, choice[1])) {
        valid = false
        break
      }
      continue
    }
    while (moveIndex < log.moves.length && log.moves[moveIndex]![0] <= state.tick) {
      dir = log.moves[moveIndex]![1]
      moveIndex++
    }
    // Un poder por tick: si hay varios en el mismo tick, los demás esperan al siguiente.
    let cast = -1
    const next = casts[castIndex]
    if (next && next[0] <= state.tick) {
      cast = next[1]
      castIndex++
    }
    step(state, dir, cast)
  }

  return {
    valid,
    status: valid ? state.status : 'lost',
    ticks: state.tick,
    kills: state.kills,
    level: state.level,
    hp: state.player.hp,
    score: scoreOf(state),
    endReason: state.endReason,
    state,
  }
}

/** Anota la entrada de una partida en vivo con el mismo formato que `replay` espera. */
export class InputRecorder {
  readonly log: InputLog & { casts: [number, number][] } = { moves: [], picks: [], casts: [] }
  private lastDir = NO_DIR

  move(tick: number, dir: number) {
    if (dir === this.lastDir) return
    this.lastDir = dir
    this.log.moves.push([tick, dir])
  }

  pick(tick: number, index: number) {
    this.log.picks.push([tick, index])
  }

  /** `tick` es el del paso en el que se suelta el poder (el valor de `state.tick` antes de `step`). */
  cast(tick: number, power: number) {
    this.log.casts.push([tick, power])
  }
}
