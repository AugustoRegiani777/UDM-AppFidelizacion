// Reproducción de una partida a partir de la semilla y las entradas grabadas.
// El servidor la usa para decidir si la partida realmente se ganó (el celular solo manda las entradas).

import { NO_DIR, UPGRADES, type GameConfig } from './config.ts'
import { createGame, pick, step, type GameState, type GameStatus } from './sim.ts'

export interface InputLog {
  /** Cambios de dirección: [tick, dirección 0..16]. */
  moves: [number, number][]
  /** Mejoras elegidas al subir de nivel: [tick, índice 0..2]. */
  picks: [number, number][]
}

export interface ReplayResult {
  valid: boolean
  status: GameStatus
  ticks: number
  kills: number
  level: number
  hp: number
}

const MAX_MOVES = 6000
const MAX_PICKS = UPGRADES.reduce((sum, u) => sum + u.maxLevel, 0)

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
  const { moves, picks } = log as Record<string, unknown>
  if (!Array.isArray(moves) || !Array.isArray(picks)) return false
  if (moves.length > MAX_MOVES || picks.length > MAX_PICKS) return false
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
    step(state, dir)
  }

  return {
    valid,
    status: valid ? state.status : 'lost',
    ticks: state.tick,
    kills: state.kills,
    level: state.level,
    hp: state.player.hp,
    state,
  }
}

/** Anota la entrada de una partida en vivo con el mismo formato que `replay` espera. */
export class InputRecorder {
  readonly log: InputLog = { moves: [], picks: [] }
  private lastDir = NO_DIR

  move(tick: number, dir: number) {
    if (dir === this.lastDir) return
    this.lastDir = dir
    this.log.moves.push([tick, dir])
  }

  pick(tick: number, index: number) {
    this.log.picks.push([tick, index])
  }
}
