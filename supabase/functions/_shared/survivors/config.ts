// "Sobreviví a las migas": configuración y datos del juego.
// Este módulo y toda la carpeta son TypeScript puro (sin APIs del navegador ni de Deno) porque
// la MISMA simulación corre en el celular y en el servidor, que reproduce cada partida para validarla.

export const TICKS_PER_SECOND = 60
export const ARENA_W = 360
export const ARENA_H = 640

export interface GameConfig {
  durationSeconds: number
  playerHp: number
  enemySpeedMul: number
  enemyHpMul: number
  spawnMul: number
  /** La Reina hormiga aparece al 60 % de la partida. */
  boss: boolean
}

export const NORMAL_CONFIG: GameConfig = {
  durationSeconds: 50,
  playerHp: 5,
  enemySpeedMul: 1,
  enemyHpMul: 1,
  spawnMul: 1,
  boss: true,
}

/** Modo relajado: se ofrece tras dos derrotas seguidas. Mismas reglas, enemigos más mansos. */
export const RELAXED_CONFIG: GameConfig = {
  ...NORMAL_CONFIG,
  playerHp: 7,
  enemySpeedMul: 0.8,
  enemyHpMul: 0.8,
  spawnMul: 0.7,
}

export function resolveConfig(overrides: Partial<GameConfig> = {}, relaxed = false): GameConfig {
  return { ...(relaxed ? RELAXED_CONFIG : NORMAL_CONFIG), ...overrides }
}

/** 16 direcciones (22,5° cada una; 0 = derecha, sentido horario en pantalla). Literales: nada de sin/cos en la simulación. */
export const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.92388, 0.382683],
  [0.707107, 0.707107],
  [0.382683, 0.92388],
  [0, 1],
  [-0.382683, 0.92388],
  [-0.707107, 0.707107],
  [-0.92388, 0.382683],
  [-1, 0],
  [-0.92388, -0.382683],
  [-0.707107, -0.707107],
  [-0.382683, -0.92388],
  [0, -1],
  [0.382683, -0.92388],
  [0.707107, -0.707107],
  [0.92388, -0.382683],
]
/** Índice de "sin movimiento". */
export const NO_DIR = 16

/** Rotaciones fijas (cos, sin) para abrir el abanico de migas: ±8°, ±12°, ±18°, ±24°. */
export const FAN: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 0]],
  2: [
    [0.990268, -0.139173],
    [0.990268, 0.139173],
  ],
  3: [
    [0.978148, -0.207912],
    [1, 0],
    [0.978148, 0.207912],
  ],
  4: [
    [0.951057, -0.309017],
    [0.990268, -0.139173],
    [0.990268, 0.139173],
    [0.951057, 0.309017],
  ],
}

export type UpgradeId =
  'fireRate' | 'damage' | 'multishot' | 'magnet' | 'speed' | 'heart' | 'orbit' | 'pierce'

export interface UpgradeDef {
  id: UpgradeId
  maxLevel: number
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'fireRate', maxLevel: 4 },
  { id: 'damage', maxLevel: 4 },
  { id: 'multishot', maxLevel: 3 },
  { id: 'magnet', maxLevel: 3 },
  { id: 'speed', maxLevel: 3 },
  { id: 'heart', maxLevel: 3 },
  { id: 'orbit', maxLevel: 3 },
  { id: 'pierce', maxLevel: 2 },
]

export type EnemyKind = 0 | 1 | 2 | 3
export const ANT: EnemyKind = 0
export const FLY: EnemyKind = 1
export const PIGEON: EnemyKind = 2
export const QUEEN: EnemyKind = 3

export interface EnemyDef {
  hp: number
  /** px por segundo */
  speed: number
  radius: number
  contactDamage: number
  gems: number
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  [ANT]: { hp: 3, speed: 52, radius: 8, contactDamage: 1, gems: 1 },
  [FLY]: { hp: 2, speed: 84, radius: 7, contactDamage: 1, gems: 1 },
  [PIGEON]: { hp: 16, speed: 30, radius: 15, contactDamage: 2, gems: 4 },
  [QUEEN]: { hp: 240, speed: 17, radius: 24, contactDamage: 2, gems: 25 },
}

export const PLAYER_RADIUS = 11
export const PLAYER_SPEED = 118
