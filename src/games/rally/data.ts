// Rally de Cocina: constantes, datos de los autos, ítems e utilidades sin dependencias de three ni del DOM.

/** Mitad del ancho de la pista original (cada pista trae el suyo en `TrackDef.halfWidth`). */
export const HW = 5.2
export const DEFAULT_TRACK_ID = 'cocina'
export const CAR_R = 0.62
export const GRAV = 38
export const N = 700
export const FLIP_T = 0.55
export const PULSE_R = 9
export const ROOM = { x0: -112, x1: 112, z0: -88, z1: 88, h: 56 }

export type CarStyle = 'sport' | 'buggy' | 'truck'

export interface CarDef {
  id: string
  name: string
  color: number
  accent: number
  style: CarStyle
  motor: string
  maxSpeed: number
  accel: number
  grip: number
  steer: number
  mass: number
}

export const CARS: CarDef[] = [
  {
    id: 'chispa',
    name: 'Chispa',
    color: 0xe8392b,
    accent: 0xffd23f,
    style: 'sport',
    motor: 'Motor 280 · 7,2 V',
    maxSpeed: 31,
    accel: 23,
    grip: 8.0,
    steer: 2.7,
    mass: 1.0,
  },
  {
    id: 'rayo',
    name: 'Rayo Azul',
    color: 0x2f6df0,
    accent: 0xffffff,
    style: 'sport',
    motor: 'Motor 380 · 8,4 V',
    maxSpeed: 34,
    accel: 19,
    grip: 6.7,
    steer: 2.5,
    mass: 1.0,
  },
  {
    id: 'grillo',
    name: 'Grillo',
    color: 0x46c24c,
    accent: 0x1d1f24,
    style: 'buggy',
    motor: 'Motor 130 · 6 V',
    maxSpeed: 28.5,
    accel: 27,
    grip: 9.3,
    steer: 3.0,
    mass: 0.85,
  },
  {
    id: 'tanque',
    name: 'Tanque',
    color: 0xf29a1c,
    accent: 0x3b2a1a,
    style: 'truck',
    motor: 'Motor 540 · 9,6 V',
    maxSpeed: 32,
    accel: 20,
    grip: 7.4,
    steer: 2.4,
    mass: 1.5,
  },
  {
    id: 'mora',
    name: 'Mora',
    color: 0x8b3fd9,
    accent: 0x7ef0ff,
    style: 'buggy',
    motor: 'Motor 280 · 7,2 V',
    maxSpeed: 30,
    accel: 24.5,
    grip: 8.5,
    steer: 2.8,
    mass: 0.95,
  },
  {
    id: 'pomelo',
    name: 'Pomelo',
    color: 0xff6f9c,
    accent: 0xffffff,
    style: 'truck',
    motor: 'Motor 380 · 8,4 V',
    maxSpeed: 31.5,
    accel: 21,
    grip: 7.8,
    steer: 2.6,
    mass: 1.25,
  },
]

export type ItemKey = 'turbo' | 'rocket' | 'oil' | 'pulse'
export const ITEM_KEYS: ItemKey[] = ['turbo', 'rocket', 'oil', 'pulse']
export const ITEM_NAMES: Record<ItemKey, string> = {
  turbo: 'TURBO',
  rocket: 'COHETE',
  oil: 'ACEITE',
  pulse: 'PULSO',
}
export const ITEM_DESC: Record<ItemKey, string> = {
  turbo: 'Velocidad extra por unos segundos.',
  rocket: 'Sale disparado y persigue al auto de adelante.',
  oil: 'Deja una mancha atrás que hace patinar.',
  pulse: 'Descarga eléctrica que frena a los que están cerca.',
}
export const ICONS: Record<ItemKey, string> = {
  turbo:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6l-1.5 8.5 9.5-12h-6z" fill="#ffd23f" stroke="#0d1330" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  rocket:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 13 4 17v2.2l3.5-1.6M16.5 13 20 17v2.2l-3.5-1.6" fill="#fff" stroke="#0d1330" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 2c3 2 4.5 5.5 4.5 9.5V17h-9v-5.5C7.5 7.5 9 4 12 2z" fill="#ff4a3d" stroke="#0d1330" stroke-width="1.6"/><circle cx="12" cy="9.5" r="1.9" fill="#7ec8ff" stroke="#0d1330" stroke-width="1.2"/><path d="M10 18.3h4l-2 4z" fill="#ffd23f"/></svg>',
  oil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" fill="#2a2633" stroke="#0d1330" stroke-width="1.6"/><path d="M8.8 14.3a3.2 3.2 0 0 0 2.2 3" stroke="#a99cff" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  pulse:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.3" fill="none" stroke="#7ef0ff" stroke-width="1.6" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#7ef0ff" stroke-width="2.2"/><circle cx="12" cy="12" r="3.3" fill="#7ef0ff" stroke="#0d1330" stroke-width="1.5"/></svg>',
}

/** Lo que pide el conductor en cada paso de la física. `steer` > 0 dobla a la izquierda. */
export interface Control {
  throttle: number
  brake: number
  steer: number
  handbrake: boolean
}
export const ZERO: Control = { throttle: 0, brake: 0, steer: 0, handbrake: false }

export type Difficulty = 'easy' | 'normal' | 'hard'
export interface RallySettings {
  car: string
  laps: number
  rivals: number
  diff: Difficulty
  /** Id de la pista (si falta, la Cocina). */
  track?: string
}
/** Cantidades de vueltas que se pueden elegir en el menú (por defecto 5). */
export const LAP_OPTIONS: readonly number[] = [3, 5, 7]
export const DEFAULT_SETTINGS: RallySettings = {
  car: 'chispa',
  laps: 5,
  rivals: 3,
  diff: 'normal',
  track: DEFAULT_TRACK_ID,
}

/* ============ utilidades ============ */

let randomFn: () => number = Math.random
/** Permite fijar el azar en los tests. */
export function setRandom(fn: (() => number) | null) {
  randomFn = fn ?? Math.random
}
export const random = () => randomFn()
export const rand = (a: number, b: number) => a + random() * (b - a)
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const wrapA = (angle: number) => {
  let a = (angle + Math.PI) % (2 * Math.PI)
  if (a < 0) a += 2 * Math.PI
  return a - Math.PI
}
export const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '--:--.--'
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return m + ':' + r.toFixed(2).padStart(5, '0')
}
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

/** Progreso guardado en el celular (claves `rdc:`), siempre con try/catch. */
export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem('rdc:' + k)
      return v == null ? d : (JSON.parse(v) as T)
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem('rdc:' + k, JSON.stringify(v))
    } catch {
      // Sin almacenamiento el ajuste vale solo para esta sesión.
    }
  },
}

export function loadSettings(): RallySettings {
  const car = store.get<string>('car', DEFAULT_SETTINGS.car)
  const laps = store.get<number>('laps', DEFAULT_SETTINGS.laps)
  const rivals = store.get<number>('rivals', DEFAULT_SETTINGS.rivals)
  const diff = store.get<string>('diff', DEFAULT_SETTINGS.diff)
  return {
    car: CARS.some((c) => c.id === car) ? car : DEFAULT_SETTINGS.car,
    laps: LAP_OPTIONS.includes(laps) ? laps : DEFAULT_SETTINGS.laps,
    rivals: rivals >= 1 && rivals <= 5 ? Math.round(rivals) : DEFAULT_SETTINGS.rivals,
    diff: diff === 'easy' || diff === 'hard' ? diff : 'normal',
    track: store.get<string>('track', DEFAULT_TRACK_ID),
  }
}
