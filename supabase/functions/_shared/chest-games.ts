// Registro de los juegos del cofre: cada uno sabe armar su configuración, validar el registro de
// entradas que manda el cliente y reproducir la partida para decidir si se ganó.

import { resolveConfig, type GameConfig } from './survivors/config.ts'
import { isValidLog, replay } from './survivors/replay.ts'
import { MAX_SPEED, resolveSkateConfig, type SkateConfig } from './skate/config.ts'
import { isValidSkateLog, replaySkate } from './skate/replay.ts'
import { buildTerrain } from './skate/terrain.ts'

export type ChestGame = 'survivors' | 'skate'

export const isChestGame = (value: unknown): value is ChestGame =>
  value === 'survivors' || value === 'skate'

/** Un cliente no puede ganar más rápido que este porcentaje del tiempo mínimo real de la partida. */
const MIN_TIME_RATIO = 0.85

export interface ReplayOutcome {
  won: boolean
  summary: Record<string, unknown>
  minSeconds: number
}

/** Configuración final (reglas del juego + modo relajado), la misma que recibe el cliente. */
export function gameConfig(
  game: ChestGame,
  overrides: Record<string, unknown>,
  relaxed: boolean,
): GameConfig | SkateConfig {
  return game === 'skate'
    ? resolveSkateConfig(overrides as Partial<SkateConfig>, relaxed)
    : resolveConfig(overrides as Partial<GameConfig>, relaxed)
}

export function isValidGameLog(game: ChestGame, log: unknown): boolean {
  return game === 'skate' ? isValidSkateLog(log) : isValidLog(log)
}

/** Reproduce la partida con la semilla y las reglas que el servidor guardó al abrir la sesión. */
export function replayGame(
  game: ChestGame,
  overrides: Record<string, unknown>,
  relaxed: boolean,
  seed: number,
  log: unknown,
): ReplayOutcome {
  if (game === 'skate') {
    const config = gameConfig('skate', overrides, relaxed) as SkateConfig
    const result = replaySkate(config, seed, log as Parameters<typeof replaySkate>[2])
    const length = buildTerrain(undefined, config.courseLimit).length
    return {
      won: result.status === 'won',
      minSeconds: (length / MAX_SPEED) * MIN_TIME_RATIO,
      summary: {
        status: result.status,
        ticks: result.ticks,
        clean: result.clean,
        bails: result.bails,
        lives: result.lives,
      },
    }
  }
  const config = gameConfig('survivors', overrides, relaxed) as GameConfig
  const result = replay(config, seed, log as Parameters<typeof replay>[2])
  return {
    won: result.valid && result.status === 'won',
    minSeconds: config.durationSeconds * MIN_TIME_RATIO,
    summary: {
      valid: result.valid,
      status: result.status,
      ticks: result.ticks,
      kills: result.kills,
      level: result.level,
      hp: result.hp,
    },
  }
}
