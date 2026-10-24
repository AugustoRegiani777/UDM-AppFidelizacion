// Reproducción de una partida de skate a partir de las entradas grabadas (la usa el servidor para validar).

import { STICK_NONE, type SkateConfig } from './config.ts'
import { createSkate, stepSkate, type SkateState, type SkateStatus } from './sim.ts'

export interface SkateLog {
  /** Cambios de entrada: [tick, pulgar izquierdo 0..8, pulgar derecho 0|1]. */
  moves: [number, number, number][]
}

export interface SkateReplayResult {
  valid: boolean
  status: SkateStatus
  ticks: number
  clean: number
  bails: number
  lives: number
}

const MAX_MOVES = 12000

/** Valida la forma del registro (viene del cliente, así que no se confía en nada). */
export function isValidSkateLog(log: unknown): log is SkateLog {
  if (typeof log !== 'object' || log === null) return false
  const { moves } = log as Record<string, unknown>
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return false
  let last = 0
  for (const move of moves) {
    if (!Array.isArray(move) || move.length !== 3) return false
    const [tick, stick, right] = move as unknown[]
    if (!Number.isInteger(tick) || (tick as number) < last) return false
    if (!Number.isInteger(stick) || (stick as number) < 0 || (stick as number) > 8) return false
    if (right !== 0 && right !== 1) return false
    last = tick as number
  }
  return true
}

export function replaySkate(
  config: SkateConfig,
  seed: number,
  log: SkateLog,
): SkateReplayResult & { state: SkateState } {
  const state = createSkate(config, seed)
  let index = 0
  let stick = STICK_NONE
  let right = 0
  while (state.status === 'playing') {
    while (index < log.moves.length && log.moves[index]![0] <= state.tick) {
      stick = log.moves[index]![1]
      right = log.moves[index]![2]
      index++
    }
    stepSkate(state, stick, right === 1)
  }
  return {
    valid: true,
    status: state.status,
    ticks: state.tick,
    clean: state.clean,
    bails: state.bails,
    lives: state.lives,
    state,
  }
}

/** Anota la entrada de una partida en vivo con el formato que `replaySkate` espera. */
export class SkateRecorder {
  readonly log: SkateLog = { moves: [] }
  private last = `${STICK_NONE},0`

  input(tick: number, stick: number, right: boolean) {
    const key = `${stick},${right ? 1 : 0}`
    if (key === this.last) return
    this.last = key
    this.log.moves.push([tick, stick, right ? 1 : 0])
  }
}
