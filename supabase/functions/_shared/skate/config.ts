// "Skate de Miga": configuración y datos del juego (circuito, constantes de física, trucos).
// TypeScript puro y determinista: la MISMA simulación corre en el celular y en el servidor, que reproduce
// cada partida para validarla (sin sin/cos/pow: solo + − × ÷ y sqrt, exactos según IEEE 754).

export const TICKS_PER_SECOND = 60
export const DT = 1 / TICKS_PER_SECOND

export interface SkateConfig {
  lives: number
  /** Modo relajado: aterrizajes más permisivos y empuje más fuerte. */
  assist: boolean
  /** Recorta el circuito a esta longitud (solo para pruebas). */
  courseLimit: number | null
}

export const NORMAL_SKATE: SkateConfig = { lives: 3, assist: false, courseLimit: null }
export const RELAXED_SKATE: SkateConfig = { lives: 5, assist: true, courseLimit: null }

export function resolveSkateConfig(
  overrides: Partial<SkateConfig> = {},
  relaxed = false,
): SkateConfig {
  return { ...(relaxed ? RELAXED_SKATE : NORMAL_SKATE), ...overrides }
}

// --- Física ---------------------------------------------------------------------------------------

export const GRAVITY = 1250
/** Qué parte de la gravedad empuja a lo largo de la pendiente (una patineta rueda libre). */
export const SLOPE_FACTOR = 0.62
export const FRICTION = 0.22
export const CRUISE_SPEED = 120
export const PUSH_ACCEL = 140
export const ASSIST_PUSH_ACCEL = 210
export const MAX_SPEED = 760
export const MAX_BACKWARDS = 160
export const BOOST_ACCEL = 520
export const BOOST_DRAIN = 55 // por segundo
export const STICK_TOLERANCE = 0.9
export const CLIFF_TOLERANCE = 30
export const PIT_DEPTH = 420

export const JUMP_BASE = 270
export const JUMP_PER_CHARGE = 7
export const MAX_CHARGE_TICKS = 24

/** Giro en el aire por tick (0,115 rad) y ticks de una vuelta completa. */
export const SPIN_COS = 0.99339478
export const SPIN_SIN = 0.11474669
export const FLIP_TICKS = 55

export const TAP_TICKS = 12
export const GRAB_TICKS = 14

export const SPAWN_SPEED = 100
export const MAX_RUN_SECONDS = 110

// --- Aterrizajes --------------------------------------------------------------------------------------

export interface LandingRules {
  clean: number
  sketchy: number
}
export const NORMAL_LANDING: LandingRules = { clean: 0.8, sketchy: 0.45 }
export const ASSIST_LANDING: LandingRules = { clean: 0.66, sketchy: 0.22 }

// --- Control: pulgar izquierdo (8 direcciones + nada) ----------------------------------------------------

/** 0 = nada; 1 → derecha, 2 ↘, 3 ↓, 4 ↙, 5 ←, 6 ↖, 7 ↑, 8 ↗ (sentido horario desde la derecha). */
export const STICK_NONE = 0
export const STICK_X: readonly number[] = [0, 1, 1, 0, -1, -1, -1, 0, 1]
export const STICK_Y: readonly number[] = [0, 0, 1, 1, 1, 0, -1, -1, -1] // + = abajo

export type TrickName =
  'kickflip' | 'heelflip' | 'shuvit' | 'indy' | 'superman' | 'japan' | 'frontflip' | 'backflip'

/** Puntos de turbo que carga cada truco al aterrizar bien. */
export const TRICK_BOOST: Record<TrickName, number> = {
  kickflip: 12,
  heelflip: 14,
  shuvit: 12,
  indy: 16,
  superman: 22,
  japan: 18,
  frontflip: 30,
  backflip: 30,
}

// --- Circuito ---------------------------------------------------------------------------------------------

export type Section =
  | { t: 'flat'; len: number; checkpoint?: boolean }
  | { t: 'slope'; len: number; dy: number }
  | { t: 'quarterUp'; len: number; h: number }
  | { t: 'quarterDown'; len: number; h: number }
  | { t: 'bump'; len: number; h: number }
  | { t: 'gap'; len: number; dy: number }

/**
 * Circuito del cofre. Cada "acto" baja para tomar velocidad y termina en una rampa y un salto:
 * el primero se salva rodando, los siguientes piden turbo (que se carga haciendo trucos).
 */
const ACT_1: Section[] = [
  // Bajada, baches para practicar saltos y un primer salto chico que se salva rodando.
  { t: 'flat', len: 260 },
  { t: 'slope', len: 380, dy: 150 },
  { t: 'flat', len: 200 },
  { t: 'bump', len: 140, h: 26 },
  { t: 'flat', len: 100 },
  { t: 'bump', len: 140, h: 30 },
  { t: 'flat', len: 120 },
  { t: 'slope', len: 260, dy: 90 },
  { t: 'quarterUp', len: 120, h: 34 },
  { t: 'gap', len: 100, dy: 6 },
  { t: 'flat', len: 160, checkpoint: true },
]

const ACT_2: Section[] = [
  // Medio caño: ir y venir da aire y velocidad.
  { t: 'slope', len: 300, dy: 120 },
  { t: 'quarterDown', len: 100, h: 60 },
  { t: 'flat', len: 220 },
  { t: 'quarterUp', len: 110, h: 60 },
  { t: 'flat', len: 140 },
  { t: 'slope', len: 280, dy: 140 },
  { t: 'flat', len: 160, checkpoint: true },
]

const ACT_3: Section[] = [
  // Primeros saltos grandes: hace falta turbo (se carga haciendo trucos).
  { t: 'slope', len: 340, dy: 170 },
  { t: 'quarterUp', len: 130, h: 46 },
  { t: 'gap', len: 210, dy: 30 },
  { t: 'flat', len: 120 },
  { t: 'slope', len: 400, dy: 140 },
  { t: 'quarterUp', len: 140, h: 52 },
  { t: 'gap', len: 280, dy: 50 },
  { t: 'flat', len: 140, checkpoint: true },
]

const ACT_4: Section[] = [
  // Plaza: tres baches seguidos para encadenar trucos y un salto corto.
  { t: 'slope', len: 360, dy: 150 },
  { t: 'bump', len: 150, h: 30 },
  { t: 'flat', len: 90 },
  { t: 'bump', len: 150, h: 34 },
  { t: 'flat', len: 90 },
  { t: 'bump', len: 150, h: 38 },
  { t: 'flat', len: 120 },
  { t: 'slope', len: 280, dy: 120 },
  { t: 'quarterUp', len: 120, h: 40 },
  { t: 'gap', len: 150, dy: 10 },
  { t: 'flat', len: 140, checkpoint: true },
]

const ACT_5: Section[] = [
  // Medio caño grande, dos veces.
  { t: 'slope', len: 320, dy: 170 },
  { t: 'quarterDown', len: 120, h: 80 },
  { t: 'flat', len: 260 },
  { t: 'quarterUp', len: 130, h: 80 },
  { t: 'flat', len: 120 },
  { t: 'quarterDown', len: 120, h: 80 },
  { t: 'flat', len: 260 },
  { t: 'quarterUp', len: 130, h: 80 },
  { t: 'flat', len: 120 },
  { t: 'slope', len: 300, dy: 150 },
  { t: 'flat', len: 140, checkpoint: true },
]

const ACT_6: Section[] = [
  // Final: dos saltos enormes y la meta.
  { t: 'slope', len: 380, dy: 180 },
  { t: 'quarterUp', len: 150, h: 56 },
  { t: 'gap', len: 240, dy: 40 },
  { t: 'flat', len: 100 },
  { t: 'slope', len: 420, dy: 160 },
  { t: 'quarterUp', len: 160, h: 60 },
  { t: 'gap', len: 320, dy: 60 },
  { t: 'flat', len: 140 },
  { t: 'slope', len: 440, dy: 90 },
  { t: 'flat', len: 600 },
]

export const COURSE: readonly Section[] = [
  ...ACT_1,
  ...ACT_2,
  ...ACT_3,
  ...ACT_4,
  ...ACT_5,
  ...ACT_6,
]
