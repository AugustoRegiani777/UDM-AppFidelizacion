// Simulación determinista de "Sobreviví a las migas".
//
// Reglas para que dé el mismo resultado en cualquier dispositivo y en el servidor:
//  - paso de tiempo fijo (1/60 s), sin leer relojes;
//  - azar solo vía `rng` con semilla;
//  - sin sin/cos/pow/hypot (solo + - * / y sqrt, exactos según IEEE 754);
//  - la entrada es un índice de dirección (0..15, 16 = quieto), no un ángulo libre.

import {
  ANT,
  ARENA_H,
  ARENA_W,
  DIRS,
  ENEMIES,
  FAN,
  FLY,
  PIGEON,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  QUEEN,
  TICKS_PER_SECOND,
  UPGRADES,
  type EnemyKind,
  type GameConfig,
  type UpgradeId,
} from './config.ts'
import { createRng, nextFloat, nextInt, type Rng } from './rng.ts'

export const MAX_ENEMIES = 160
export const MAX_PROJECTILES = 96
export const MAX_GEMS = 200

const GRID_CELL = 32
const GRID_COLS = Math.ceil(ARENA_W / GRID_CELL)
const GRID_ROWS = Math.ceil(ARENA_H / GRID_CELL)

const FIRE_INTERVALS = [20, 17, 14, 12, 10]
const FIRE_RANGE = 240
const PROJECTILE_SPEED = 270
const PROJECTILE_LIFE = 80
const INVULN_TICKS = 60
const ORBIT_RADIUS = 40
export const ORBITER_RADIUS = 9
const ORBIT_ROTATION = [0.99820054, 0.05996401] as const
const ORBIT_LAYOUT: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 0]],
  2: [
    [1, 0],
    [-1, 0],
  ],
  3: [
    [1, 0],
    [-0.5, 0.8660254],
    [-0.5, -0.8660254],
  ],
}
const BASE_MAGNET = 46
const PICKUP_RADIUS = PLAYER_RADIUS + 6
const BOSS_AT = 0.6
const WAVE_SECONDS = [18, 34]

export interface Enemy {
  alive: boolean
  kind: EnemyKind
  x: number
  y: number
  px: number
  py: number
  hp: number
  maxHp: number
  r: number
  speed: number
  dmg: number
  flash: number
  phase: number
  timer: number
  cx: number
  cy: number
  orbCd: number
}

export interface Projectile {
  alive: boolean
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  dmg: number
  hits: number
  life: number
  lastHit: number
}

export interface Gem {
  alive: boolean
  x: number
  y: number
  px: number
  py: number
  value: number
  magnet: boolean
  vel: number
}

export type GameEvent =
  | { t: 'shoot' | 'hurt' | 'levelup' | 'boss' | 'wave' | 'win' | 'lose' }
  | { t: 'hit' | 'kill' | 'gem' | 'charge' | 'spawn'; x: number; y: number; kind?: number }

export type GameStatus = 'playing' | 'won' | 'lost'

export interface GameState {
  config: GameConfig
  rng: Rng
  tick: number
  totalTicks: number
  status: GameStatus
  player: {
    x: number
    y: number
    px: number
    py: number
    hp: number
    maxHp: number
    invuln: number
    faceX: number
    faceY: number
  }
  enemies: Enemy[]
  projectiles: Projectile[]
  gems: Gem[]
  upgrades: Record<UpgradeId, number>
  xp: number
  level: number
  /** Opciones de mejora ofrecidas; mientras no sea null, la simulación está en pausa. */
  pending: UpgradeId[] | null
  fireCooldown: number
  spawnBudget: number
  bossSpawned: boolean
  kills: number
  orbitX: number
  orbitY: number
  /** Eventos del último paso (sonidos, partículas). Se vacía en cada `step`. */
  events: GameEvent[]
  grid: Int32Array
  gridNext: Int32Array
}

function makeEnemySlot(): Enemy {
  return {
    alive: false,
    kind: ANT,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    hp: 0,
    maxHp: 0,
    r: 0,
    speed: 0,
    dmg: 0,
    flash: 0,
    phase: 0,
    timer: 0,
    cx: 0,
    cy: 0,
    orbCd: 0,
  }
}

export function totalTicksOf(config: GameConfig): number {
  return Math.round(config.durationSeconds * TICKS_PER_SECOND)
}

export function createGame(config: GameConfig, seed: number): GameState {
  const upgrades = {} as Record<UpgradeId, number>
  for (const def of UPGRADES) upgrades[def.id] = 0
  return {
    config,
    rng: createRng(seed),
    tick: 0,
    totalTicks: totalTicksOf(config),
    status: 'playing',
    player: {
      x: ARENA_W / 2,
      y: ARENA_H * 0.62,
      px: ARENA_W / 2,
      py: ARENA_H * 0.62,
      hp: config.playerHp,
      maxHp: config.playerHp,
      invuln: 0,
      faceX: 0,
      faceY: -1,
    },
    enemies: Array.from({ length: MAX_ENEMIES }, makeEnemySlot),
    projectiles: Array.from({ length: MAX_PROJECTILES }, () => ({
      alive: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      dmg: 0,
      hits: 0,
      life: 0,
      lastHit: -1,
    })),
    gems: Array.from({ length: MAX_GEMS }, () => ({
      alive: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      value: 1,
      magnet: false,
      vel: 0,
    })),
    upgrades,
    xp: 0,
    level: 1,
    pending: null,
    fireCooldown: 40,
    spawnBudget: 2,
    bossSpawned: false,
    kills: 0,
    orbitX: 1,
    orbitY: 0,
    events: [],
    grid: new Int32Array(GRID_COLS * GRID_ROWS),
    gridNext: new Int32Array(MAX_ENEMIES),
  }
}

export interface PlayerStats {
  fireInterval: number
  damage: number
  shots: number
  magnet: number
  speed: number
  hits: number
  orbiters: number
}

export function statsOf(state: GameState): PlayerStats {
  const u = state.upgrades
  return {
    fireInterval: FIRE_INTERVALS[Math.min(u.fireRate, FIRE_INTERVALS.length - 1)] ?? 10,
    damage: 3 + u.damage,
    shots: 1 + u.multishot,
    magnet: BASE_MAGNET * (1 + 0.5 * u.magnet),
    speed: PLAYER_SPEED * (1 + 0.1 * u.speed),
    hits: 1 + u.pierce,
    orbiters: u.orbit,
  }
}

export function xpNeeded(level: number): number {
  return 2 + 3 * level
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

// --- Spawns -------------------------------------------------------------------------------------

function spawnEnemy(state: GameState, kind: EnemyKind, x: number, y: number): Enemy | null {
  const slot = state.enemies.find((e) => !e.alive)
  if (!slot) return null
  const def = ENEMIES[kind]
  const seconds = state.tick / TICKS_PER_SECOND
  const growth = kind === QUEEN ? 1 : 1 + 0.012 * seconds
  const hp = Math.max(1, Math.round(def.hp * state.config.enemyHpMul * growth))
  slot.alive = true
  slot.kind = kind
  slot.x = slot.px = x
  slot.y = slot.py = y
  slot.hp = slot.maxHp = hp
  slot.r = def.radius
  slot.speed = (def.speed * state.config.enemySpeedMul) / TICKS_PER_SECOND
  slot.dmg = def.contactDamage
  slot.flash = 0
  slot.phase = nextInt(state.rng, 80)
  slot.timer = kind === PIGEON ? 90 + nextInt(state.rng, 60) : kind === QUEEN ? 120 : 0
  slot.cx = 0
  slot.cy = 0
  slot.orbCd = 0
  return slot
}

function edgePoint(edge: number, along: number): [number, number] {
  const margin = 16
  switch (edge) {
    case 0:
      return [along * ARENA_W, -margin]
    case 1:
      return [ARENA_W + margin, along * ARENA_H]
    case 2:
      return [along * ARENA_W, ARENA_H + margin]
    default:
      return [-margin, along * ARENA_H]
  }
}

function pickKind(state: GameState, seconds: number): EnemyKind {
  const roll = nextFloat(state.rng)
  if (seconds < 10) return ANT
  const pigeons = state.enemies.filter((e) => e.alive && e.kind === PIGEON).length
  if (seconds >= 24 && pigeons < 6 && roll > 0.86) return PIGEON
  if (roll > 0.72) return FLY
  return ANT
}

function runDirector(state: GameState) {
  const seconds = state.tick / TICKS_PER_SECOND
  state.spawnBudget += ((1.0 + 0.055 * seconds) * state.config.spawnMul) / TICKS_PER_SECOND

  while (state.spawnBudget >= 1) {
    state.spawnBudget -= 1
    const [x, y] = edgePoint(nextInt(state.rng, 4), nextFloat(state.rng))
    spawnEnemy(state, pickKind(state, seconds), x, y)
  }

  // Oleadas: un grupo de hormigas entra todo junto por un mismo borde.
  for (const wave of WAVE_SECONDS) {
    if (state.tick === wave * TICKS_PER_SECOND && state.config.spawnMul > 0) {
      state.events.push({ t: 'wave' })
      const edge = nextInt(state.rng, 4)
      const count = Math.round(10 * state.config.spawnMul)
      for (let i = 0; i < count; i++) {
        const [x, y] = edgePoint(edge, 0.1 + (0.8 * i) / Math.max(count - 1, 1))
        spawnEnemy(state, ANT, x, y)
      }
    }
  }

  if (
    state.config.boss &&
    !state.bossSpawned &&
    state.tick >= Math.round(state.totalTicks * BOSS_AT)
  ) {
    state.bossSpawned = true
    spawnEnemy(state, QUEEN, ARENA_W / 2, -30)
    state.events.push({ t: 'boss' })
  }
}

// --- Enemigos -----------------------------------------------------------------------------------

/** Onda triangular entera entre -1 y 1 (sin usar sin()). */
function triangle(n: number): number {
  return Math.abs((n % 80) / 40 - 1) * 2 - 1
}

function moveEnemies(state: GameState) {
  const p = state.player
  for (const e of state.enemies) {
    if (!e.alive) continue
    e.px = e.x
    e.py = e.y
    if (e.flash > 0) e.flash--
    if (e.orbCd > 0) e.orbCd--
    e.phase++

    const dx = p.x - e.x
    const dy = p.y - e.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / d
    const uy = dy / d

    switch (e.kind) {
      case FLY: {
        const sway = triangle(e.phase) * 0.9
        e.x += (ux - uy * sway) * e.speed
        e.y += (uy + ux * sway) * e.speed
        break
      }
      case PIGEON: {
        e.timer--
        if (e.timer > 0) {
          e.x += ux * e.speed
          e.y += uy * e.speed
        } else if (e.timer === 0) {
          e.cx = ux
          e.cy = uy
          state.events.push({ t: 'charge', x: e.x, y: e.y })
        }
        if (e.timer <= 0) {
          e.x += e.cx * e.speed * 4.2
          e.y += e.cy * e.speed * 4.2
          if (e.timer < -22) e.timer = 150
        }
        break
      }
      case QUEEN: {
        e.x += ux * e.speed
        e.y += uy * e.speed
        e.timer--
        if (e.timer <= 0) {
          e.timer = 150
          const a = spawnEnemy(state, ANT, e.x - 22, e.y + 10)
          const b = spawnEnemy(state, ANT, e.x + 22, e.y + 10)
          if (a || b) state.events.push({ t: 'spawn', x: e.x, y: e.y, kind: QUEEN })
        }
        break
      }
      default:
        e.x += ux * e.speed
        e.y += uy * e.speed
    }
  }
}

function buildGrid(state: GameState) {
  state.grid.fill(-1)
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i]!
    if (!e.alive) continue
    const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(e.x / GRID_CELL)))
    const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(e.y / GRID_CELL)))
    const cell = cy * GRID_COLS + cx
    state.gridNext[i] = state.grid[cell] ?? -1
    state.grid[cell] = i
  }
}

/** Itera enemigos vivos cercanos a (x, y) usando la grilla. */
function forNearby(state: GameState, x: number, y: number, fn: (e: Enemy, index: number) => void) {
  const cx = Math.floor(x / GRID_CELL)
  const cy = Math.floor(y / GRID_CELL)
  for (let gy = Math.max(0, cy - 1); gy <= Math.min(GRID_ROWS - 1, cy + 1); gy++) {
    for (let gx = Math.max(0, cx - 1); gx <= Math.min(GRID_COLS - 1, cx + 1); gx++) {
      let i = state.grid[gy * GRID_COLS + gx] ?? -1
      while (i !== -1) {
        const e = state.enemies[i]!
        if (e.alive) fn(e, i)
        i = state.gridNext[i] ?? -1
      }
    }
  }
}

/** Empuja a los enemigos para que no se amontonen en un solo punto. */
function separateEnemies(state: GameState) {
  for (let i = 0; i < state.enemies.length; i++) {
    const a = state.enemies[i]!
    if (!a.alive || a.kind === QUEEN) continue
    forNearby(state, a.x, a.y, (b, j) => {
      if (j <= i) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const min = (a.r + b.r) * 0.85
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 === 0) return
      const d = Math.sqrt(d2)
      const push = ((min - d) / d) * 0.25
      const bMoves = b.kind !== QUEEN
      a.x -= dx * push * (bMoves ? 1 : 2)
      a.y -= dy * push * (bMoves ? 1 : 2)
      if (bMoves) {
        b.x += dx * push
        b.y += dy * push
      }
    })
  }
}

function dropGems(state: GameState, e: Enemy) {
  const total = ENEMIES[e.kind].gems
  const pieces = Math.min(total, e.kind === QUEEN ? 5 : 4)
  const value = total / pieces
  for (let i = 0; i < pieces; i++) {
    const gem = state.gems.find((g) => !g.alive)
    if (!gem) return
    gem.alive = true
    gem.x = gem.px = e.x + (nextFloat(state.rng) - 0.5) * 14
    gem.y = gem.py = e.y + (nextFloat(state.rng) - 0.5) * 14
    gem.value = value
    gem.magnet = false
    gem.vel = 0
  }
}

function damageEnemy(state: GameState, e: Enemy, amount: number, fromX: number, fromY: number) {
  e.hp -= amount
  e.flash = 4
  const dx = e.x - fromX
  const dy = e.y - fromY
  const d = Math.sqrt(dx * dx + dy * dy) || 1
  const knock = e.kind === QUEEN ? 0.3 : e.kind === PIGEON ? 1 : 2.2
  e.x += (dx / d) * knock
  e.y += (dy / d) * knock
  if (e.hp <= 0) {
    e.alive = false
    state.kills++
    dropGems(state, e)
    state.events.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind })
  } else {
    state.events.push({ t: 'hit', x: e.x, y: e.y, kind: e.kind })
  }
}

// --- Armas --------------------------------------------------------------------------------------

function fireWeapon(state: GameState) {
  const stats = statsOf(state)
  state.fireCooldown--
  if (state.fireCooldown > 0) return

  const p = state.player
  let best: Enemy | null = null
  let bestD = FIRE_RANGE * FIRE_RANGE
  for (const e of state.enemies) {
    if (!e.alive) continue
    const d = dist2(p.x, p.y, e.x, e.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  if (!best) {
    state.fireCooldown = 4
    return
  }

  state.fireCooldown = stats.fireInterval
  const d = Math.sqrt(bestD) || 1
  const ux = (best.x - p.x) / d
  const uy = (best.y - p.y) / d
  const fan = FAN[Math.min(stats.shots, 4)] ?? FAN[1]!
  for (const [c, s] of fan) {
    const slot = state.projectiles.find((q) => !q.alive)
    if (!slot) break
    const vx = ux * c - uy * s
    const vy = ux * s + uy * c
    slot.alive = true
    slot.x = slot.px = p.x + vx * 14
    slot.y = slot.py = p.y + vy * 14
    slot.vx = (vx * PROJECTILE_SPEED) / TICKS_PER_SECOND
    slot.vy = (vy * PROJECTILE_SPEED) / TICKS_PER_SECOND
    slot.dmg = stats.damage
    slot.hits = stats.hits
    slot.life = PROJECTILE_LIFE
    slot.lastHit = -1
  }
  state.events.push({ t: 'shoot' })
}

function moveProjectiles(state: GameState) {
  for (const q of state.projectiles) {
    if (!q.alive) continue
    q.px = q.x
    q.py = q.y
    q.x += q.vx
    q.y += q.vy
    q.life--
    if (q.life <= 0 || q.x < -20 || q.x > ARENA_W + 20 || q.y < -20 || q.y > ARENA_H + 20) {
      q.alive = false
      continue
    }
    forNearby(state, q.x, q.y, (e, index) => {
      if (!q.alive || index === q.lastHit) return
      const reach = e.r + 4
      if (dist2(q.x, q.y, e.x, e.y) > reach * reach) return
      damageEnemy(state, e, q.dmg, q.x - q.vx * 4, q.y - q.vy * 4)
      q.lastHit = index
      q.hits--
      if (q.hits <= 0) q.alive = false
    })
  }
}

/** Posiciones actuales de las tostadas giratorias (las usa también el dibujo). */
export function orbiterPositions(state: GameState): [number, number][] {
  const n = Math.min(state.upgrades.orbit, 3)
  const layout = ORBIT_LAYOUT[n]
  if (!layout) return []
  return layout.map(([c, s]) => {
    const ox = state.orbitX * c - state.orbitY * s
    const oy = state.orbitX * s + state.orbitY * c
    return [state.player.x + ox * ORBIT_RADIUS, state.player.y + oy * ORBIT_RADIUS]
  })
}

function runOrbiters(state: GameState) {
  const [c, s] = ORBIT_ROTATION
  const nx = state.orbitX * c - state.orbitY * s
  const ny = state.orbitX * s + state.orbitY * c
  state.orbitX = nx
  state.orbitY = ny
  if (state.tick % 30 === 0) {
    const len = Math.sqrt(nx * nx + ny * ny) || 1
    state.orbitX = nx / len
    state.orbitY = ny / len
  }
  for (const [ox, oy] of orbiterPositions(state)) {
    forNearby(state, ox, oy, (e) => {
      if (e.orbCd > 0) return
      const reach = e.r + ORBITER_RADIUS
      if (dist2(ox, oy, e.x, e.y) > reach * reach) return
      e.orbCd = 18
      damageEnemy(state, e, 2, ox, oy)
    })
  }
}

// --- Jugador, gemas y progreso ------------------------------------------------------------------

function movePlayer(state: GameState, dir: number) {
  const p = state.player
  p.px = p.x
  p.py = p.y
  const vector = DIRS[dir]
  if (!vector) return
  const step = statsOf(state).speed / TICKS_PER_SECOND
  p.x = Math.min(ARENA_W - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, p.x + vector[0] * step))
  p.y = Math.min(ARENA_H - PLAYER_RADIUS, Math.max(PLAYER_RADIUS, p.y + vector[1] * step))
  p.faceX = vector[0]
  p.faceY = vector[1]
}

function contactDamage(state: GameState) {
  const p = state.player
  if (p.invuln > 0) {
    p.invuln--
    return
  }
  for (const e of state.enemies) {
    if (!e.alive) continue
    const reach = e.r + PLAYER_RADIUS - 3
    if (dist2(p.x, p.y, e.x, e.y) > reach * reach) continue
    p.hp -= e.dmg
    p.invuln = INVULN_TICKS
    const dx = e.x - p.x
    const dy = e.y - p.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    if (e.kind !== QUEEN) {
      e.x += (dx / d) * 10
      e.y += (dy / d) * 10
    }
    state.events.push({ t: 'hurt' })
    return
  }
}

function collectGems(state: GameState) {
  const p = state.player
  const magnet = statsOf(state).magnet
  for (const g of state.gems) {
    if (!g.alive) continue
    g.px = g.x
    g.py = g.y
    const d2 = dist2(p.x, p.y, g.x, g.y)
    if (!g.magnet && d2 < magnet * magnet) g.magnet = true
    if (g.magnet) {
      g.vel = Math.min(g.vel + 0.16, 9)
      const d = Math.sqrt(d2) || 1
      g.x += ((p.x - g.x) / d) * g.vel
      g.y += ((p.y - g.y) / d) * g.vel
    }
    if (d2 < PICKUP_RADIUS * PICKUP_RADIUS) {
      g.alive = false
      state.xp += g.value
      state.events.push({ t: 'gem', x: g.x, y: g.y })
    }
  }
}

function offerUpgrades(state: GameState) {
  const pool = UPGRADES.filter((u) => state.upgrades[u.id] < u.maxLevel).map((u) => u.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = nextInt(state.rng, i + 1)
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
  }
  const options = pool.slice(0, 3)
  if (options.length === 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1)
    return
  }
  state.pending = options
  state.events.push({ t: 'levelup' })
}

function checkLevelUp(state: GameState) {
  const needed = xpNeeded(state.level)
  if (state.xp < needed) return
  state.xp -= needed
  state.level++
  offerUpgrades(state)
}

// --- API pública --------------------------------------------------------------------------------

/** Avanza un tick con la dirección pedida (0..15, o 16 = quieto). No hace nada en pausa o al terminar. */
export function step(state: GameState, dir: number): void {
  if (state.status !== 'playing' || state.pending) return
  state.events.length = 0
  state.tick++

  movePlayer(state, dir)
  runDirector(state)
  moveEnemies(state)
  buildGrid(state)
  separateEnemies(state)
  buildGrid(state)
  fireWeapon(state)
  moveProjectiles(state)
  runOrbiters(state)
  contactDamage(state)
  collectGems(state)
  checkLevelUp(state)

  const p = state.player
  for (const q of state.projectiles) if (!q.alive) q.lastHit = -1
  if (p.hp <= 0) {
    state.status = 'lost'
    state.events.push({ t: 'lose' })
  } else if (state.tick >= state.totalTicks) {
    state.status = 'won'
    state.events.push({ t: 'win' })
  }
}

/** Elige una de las mejoras ofrecidas. Devuelve false si no había nada pendiente o el índice no existe. */
export function pick(state: GameState, index: number): boolean {
  const choice = state.pending?.[index]
  if (!choice) return false
  state.upgrades[choice]++
  if (choice === 'heart') {
    state.player.maxHp++
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 2)
  }
  state.pending = null
  return true
}

/** Huella de la partida para comparar dos ejecuciones (tests y depuración). */
export function checksum(state: GameState): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= Math.round(n * 100) | 0
    h = Math.imul(h, 16777619)
  }
  mix(state.tick)
  mix(state.player.x)
  mix(state.player.y)
  mix(state.player.hp)
  mix(state.kills)
  mix(state.xp)
  mix(state.level)
  for (const e of state.enemies) if (e.alive) (mix(e.x), mix(e.y), mix(e.hp))
  for (const q of state.projectiles) if (q.alive) (mix(q.x), mix(q.y))
  for (const g of state.gems) if (g.alive) (mix(g.x), mix(g.y))
  return h >>> 0
}
