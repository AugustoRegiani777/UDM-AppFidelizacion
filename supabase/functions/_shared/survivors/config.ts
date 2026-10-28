// "Sobreviví a las migas": configuración y datos del juego.
// Este módulo y toda la carpeta son TypeScript puro (sin APIs del navegador ni de Deno) porque
// la MISMA simulación corre en el celular y en el servidor, que reproduce cada partida para validarla.

export const TICKS_PER_SECOND = 60
export const ARENA_W = 360
export const ARENA_H = 640

/** Mejoras de la tienda que lleva el jugador al arrancar (niveles acumulados, ver shop_items). */
export interface Perks {
  /** Vidas extra. */
  hp: number
  /** +6 % de velocidad por nivel. */
  speed: number
  /** +25 % de alcance del imán por nivel. */
  magnet: number
}

export const NO_PERKS: Perks = { hp: 0, speed: 0, magnet: 0 }
const MAX_PERK = 6

/** Los valores vienen de la base, pero igual se acotan: nadie arranca con mejoras inventadas. */
export function sanitizePerks(value: unknown): Perks {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const clean = (n: unknown) => {
    const v = Math.floor(Number(n))
    return Number.isFinite(v) ? Math.min(MAX_PERK, Math.max(0, v)) : 0
  }
  return { hp: clean(source.hp), speed: clean(source.speed), magnet: clean(source.magnet) }
}

export interface GameConfig {
  /** Segundos de supervivencia: el minuto en el que entran las hormigas. Después viene la Reina. */
  durationSeconds: number
  /** Tiempo máximo para vencer a la Reina una vez que aparece. */
  bossSeconds: number
  playerHp: number
  enemySpeedMul: number
  enemyHpMul: number
  spawnMul: number
  /** Hay Reina: aparece al terminar el minuto y la partida se gana matándola. */
  boss: boolean
  /** Nivel del juego (1..STAGE_COUNT): más duro y con enemigos nuevos antes. */
  stage: number
  /** Mejoras de la tienda con las que arranca la partida. */
  perks: Perks
}

export const NORMAL_CONFIG: GameConfig = {
  durationSeconds: 60,
  bossSeconds: 90,
  playerHp: 5,
  enemySpeedMul: 1,
  enemyHpMul: 1,
  spawnMul: 1,
  boss: true,
  stage: 1,
  perks: NO_PERKS,
}

export const STAGE_COUNT = 6

/** Ajustes por nivel sobre la configuración base. Todos duran un minuto; lo que sube es la presión. */
export const STAGES: readonly Partial<GameConfig>[] = [
  {},
  { spawnMul: 1.04, enemySpeedMul: 1.01 },
  { spawnMul: 1.08, enemySpeedMul: 1.03, enemyHpMul: 1.04 },
  { spawnMul: 1.12, enemySpeedMul: 1.05, enemyHpMul: 1.08 },
  { spawnMul: 1.17, enemySpeedMul: 1.07, enemyHpMul: 1.12 },
  { spawnMul: 1.22, enemySpeedMul: 1.09, enemyHpMul: 1.18 },
]

export function clampStage(stage: number): number {
  return Math.min(STAGE_COUNT, Math.max(1, Math.floor(stage) || 1))
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
  const base = relaxed ? RELAXED_CONFIG : NORMAL_CONFIG
  const stage = clampStage(overrides.stage ?? 1)
  const staged = STAGES[stage - 1] ?? {}
  // El modo relajado suaviza el nivel (mismas multiplicaciones sobre su base más mansa).
  const scaled: Partial<GameConfig> = {
    spawnMul: base.spawnMul * (staged.spawnMul ?? 1),
    enemySpeedMul: base.enemySpeedMul * (staged.enemySpeedMul ?? 1),
    enemyHpMul: base.enemyHpMul * (staged.enemyHpMul ?? 1),
  }
  return { ...base, ...scaled, ...overrides, stage, perks: sanitizePerks(overrides.perks) }
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
  | 'fireRate'
  | 'damage'
  | 'multishot'
  | 'magnet'
  | 'speed'
  | 'heart'
  | 'orbit'
  | 'pierce'
  | 'soldiers'
  | 'chipas'
  | 'bait'

/** Poderes que se cargan solos y se sueltan a mano (índice = orden en la pantalla y en el registro). */
export type PowerId = 'soldiers' | 'chipas' | 'bait'
export const POWERS: readonly PowerId[] = ['soldiers', 'chipas', 'bait']

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
  { id: 'soldiers', maxLevel: 3 },
  { id: 'chipas', maxLevel: 3 },
  { id: 'bait', maxLevel: 3 },
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
