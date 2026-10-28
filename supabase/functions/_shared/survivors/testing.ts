// Jugador automático para pruebas y balance: sirve para comprobar que el juego se puede ganar
// jugando bien y que no se gana sin jugar. No se usa en producción.

import {
  ARENA_H,
  ARENA_W,
  DIRS,
  NO_DIR,
  POWERS,
  QUEEN,
  type GameConfig,
  type UpgradeId,
} from './config.ts'
import { InputRecorder, replay, type InputLog } from './replay.ts'
import { createGame, pick, scoreOf, step, type GameState } from './sim.ts'

const PICK_ORDER: UpgradeId[] = [
  'multishot',
  'fireRate',
  'soldiers',
  'damage',
  'chipas',
  'orbit',
  'bait',
  'heart',
  'magnet',
  'pierce',
  'speed',
]

function choosePick(options: UpgradeId[]): number {
  for (const wanted of PICK_ORDER) {
    const index = options.indexOf(wanted)
    if (index !== -1) return index
  }
  return 0
}

/** Elige la dirección que más aleja de los enemigos cercanos, con un imán suave hacia las gemas. */
function chooseDirection(state: GameState, skill: number): number {
  const p = state.player
  let bestDir = NO_DIR
  let bestScore = -Infinity
  for (let d = 0; d <= NO_DIR; d++) {
    const v = d === NO_DIR ? [0, 0] : DIRS[d]!
    const nx = Math.min(ARENA_W - 12, Math.max(12, p.x + v[0]! * 26))
    const ny = Math.min(ARENA_H - 12, Math.max(12, p.y + v[1]! * 26))
    let score = 0
    for (const e of state.enemies) {
      if (!e.alive) continue
      const dx = e.x - nx
      const dy = e.y - ny
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 130) score -= (130 - dist) * (130 - dist) * (e.r / 8)
    }
    let nearestGem = Infinity
    for (const g of state.gems) {
      if (!g.alive) continue
      const dx = g.x - nx
      const dy = g.y - ny
      nearestGem = Math.min(nearestGem, Math.sqrt(dx * dx + dy * dy))
    }
    if (nearestGem < 140) score -= nearestGem * 4 * skill
    // Evitar quedar acorralado contra los bordes.
    const wall = Math.min(nx, ARENA_W - nx, ny, ARENA_H - ny)
    if (wall < 50) score -= (50 - wall) * (50 - wall) * 2
    if (score > bestScore) {
      bestScore = score
      bestDir = d
    }
  }
  return bestDir
}

/** Decide si conviene soltar una burbuja ahora: cuando hay bichos encima o la Reina está cerca. */
function chooseCast(state: GameState): number {
  const p = state.player
  let near = 0
  let queen = false
  for (const e of state.enemies) {
    if (!e.alive) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    if (dx * dx + dy * dy < 150 * 150) near++
    if (e.kind === QUEEN) queen = true
  }
  if (near < 4 && !queen) return -1
  for (let i = 0; i < POWERS.length; i++) {
    const id = POWERS[i]!
    if (state.charges[id] > 0 && state.upgrades[id] > 0) {
      if (id === 'bait' && state.bait.alive) continue
      return i
    }
  }
  return -1
}

export interface BotRun {
  won: boolean
  score: number
  /** Tick en el que terminó la partida. */
  ticks: number
  hp: number
  level: number
  kills: number
  log: InputLog
}

/** Juega una partida completa. `skill` 0 = quieto, 1 = juega bien. */
export function playWithBot(config: GameConfig, seed: number, skill = 1): BotRun {
  const state = createGame(config, seed)
  const recorder = new InputRecorder()
  let dir = NO_DIR
  while (state.status === 'playing') {
    if (state.pending) {
      const index = choosePick(state.pending)
      recorder.pick(state.tick, index)
      pick(state, index)
      continue
    }
    if (skill > 0 && state.tick % 4 === 0) dir = chooseDirection(state, skill)
    if (skill === 0) dir = NO_DIR
    recorder.move(state.tick, dir)
    const cast = skill > 0 ? chooseCast(state) : -1
    if (cast >= 0) recorder.cast(state.tick, cast)
    step(state, dir, cast)
  }
  const check = replay(config, seed, recorder.log)
  if (check.status !== state.status) throw new Error('el replay no coincide con la partida en vivo')
  return {
    won: state.status === 'won',
    score: scoreOf(state),
    ticks: state.tick,
    hp: state.player.hp,
    level: state.level,
    kills: state.kills,
    log: recorder.log,
  }
}
