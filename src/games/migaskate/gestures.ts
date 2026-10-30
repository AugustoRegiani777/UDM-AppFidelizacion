// Reconocedor de gestos de "Miga Skate". TypeScript puro: recibe dedos (id, posicion y tiempo) y
// devuelve gestos ya clasificados. Las coordenadas son las del "pad": el centro de la tabla es (0, 0),
// u crece hacia la derecha y v hacia arriba, y 1 equivale a la mitad del lado corto del pad.
//
// La tabla se dibuja en vertical (nariz arriba, cola abajo). Donde apoyás el dedo decide el truco:
//   cola  + deslizar arriba            -> ollie
//   cola  + deslizar arriba y al costado -> pop shove-it
//   nariz + deslizar abajo             -> nollie
//   costado de la tabla + diagonal     -> kickflip / heelflip (segun hacia donde tires)
//   costado + deslizar de lado         -> shove-it
//   centro + deslizar abajo            -> empujar; mantener y arrastrar de lado -> doblar
//   centro (en el aire) + de lado      -> giro del cuerpo; mantener -> agarre
//   cola o nariz mantenidas en el suelo -> manual

export type GrabName = 'indy' | 'melon' | 'nose' | 'tail'

export type Gesture =
  | { k: 'ollie'; power: number; nollie: boolean }
  | { k: 'popShuvit'; power: number; dir: 1 | -1; nollie: boolean }
  | { k: 'flip'; power: number; dir: 1 | -1 }
  | { k: 'shuvit'; power: number; dir: 1 | -1 }
  | { k: 'spin'; power: number; dir: 1 | -1 }
  | { k: 'push'; power: number }
  | { k: 'grab'; name: GrabName }
  | { k: 'grabEnd' }
  | { k: 'manual'; nose: boolean }
  | { k: 'manualEnd' }

export type Zone = 'tail' | 'nose' | 'side' | 'middle'

export const BOARD_HALF_LENGTH = 0.82
export const BOARD_HALF_WIDTH = 0.2

/** Cola y nariz: el tercio de cada punta de la tabla (y un poco mas, para dedos gordos). */
const END_V = 0.3
/** Mitad del ancho donde se considera "sobre la tabla". */
const ON_BOARD_U = 0.3

const SWIPE_MIN = 0.3
const SWIPE_FAST = 0.5
const SWIPE_WINDOW_MS = 650
const HOLD_MS = 160
const HOLD_MOVE = 0.14
const MANUAL_HOLD_MS = 220

export function zoneOf(u: number, v: number): Zone {
  if (Math.abs(u) <= ON_BOARD_U) {
    if (v <= -END_V) return 'tail'
    if (v >= END_V) return 'nose'
    return 'middle'
  }
  return 'side'
}

interface Finger {
  id: number
  zone: Zone
  u0: number
  v0: number
  t0: number
  /** Cuando empezo a moverse (el tiempo de apoyo quieto no cuenta para el latigazo). */
  tm: number
  moving: boolean
  u: number
  v: number
  /** Posiciones recientes para medir la velocidad del latigazo. */
  trail: { u: number; v: number; t: number }[]
  /** Ya dispara un gesto de deslizamiento (no vuelve a disparar). */
  swiped: boolean
  held: boolean
  manual: boolean
}

export interface GestureContext {
  airborne: boolean
}

/** Convierte la velocidad del latigazo (unidades de pad por segundo) en potencia 0..1. */
export function powerOf(speed: number): number {
  return Math.max(0, Math.min(1, (speed - 1.2) / 3.2))
}

export class GestureRecognizer {
  private readonly fingers = new Map<number, Finger>()
  private pending: Gesture[] = []
  /** Doblar: desplazamiento lateral del dedo que esta sobre el centro (-1..1). */
  steer = 0
  /** Equilibrio del manual: desplazamiento vertical del dedo que mantiene la punta (-1..1). */
  balance = 0

  constructor(private readonly context: () => GestureContext = () => ({ airborne: false })) {}

  down(id: number, u: number, v: number, t: number) {
    const zone = zoneOf(u, v)
    this.fingers.set(id, {
      id,
      zone,
      u0: u,
      v0: v,
      t0: t,
      tm: t,
      moving: false,
      u,
      v,
      trail: [{ u, v, t }],
      swiped: false,
      held: false,
      manual: false,
    })
  }

  move(id: number, u: number, v: number, t: number) {
    const f = this.fingers.get(id)
    if (!f) return
    f.u = u
    f.v = v
    f.trail.push({ u, v, t })
    while (f.trail.length > 2 && t - f.trail[0]!.t > 120) f.trail.shift()
    this.refresh()
    if (!f.moving && Math.hypot(u - f.u0, v - f.v0) > HOLD_MOVE) {
      f.moving = true
      f.tm = t
    }
    if (f.swiped) return
    const du = u - f.u0
    const dv = v - f.v0
    // Un deslizamiento largo y rapido se dispara sin esperar a que levantes el dedo.
    if (Math.hypot(du, dv) >= 0.85 && t - f.tm <= SWIPE_WINDOW_MS) this.classify(f, t)
  }

  up(id: number, u: number, v: number, t: number) {
    const f = this.fingers.get(id)
    if (!f) return
    f.u = u
    f.v = v
    f.trail.push({ u, v, t })
    if (!f.swiped) this.classify(f, t)
    if (f.held && !f.swiped && this.context().airborne) this.pending.push({ k: 'grabEnd' })
    if (f.manual) this.pending.push({ k: 'manualEnd' })
    this.fingers.delete(id)
    this.refresh()
  }

  cancel(id: number) {
    const f = this.fingers.get(id)
    if (!f) return
    if (f.held && this.context().airborne) this.pending.push({ k: 'grabEnd' })
    if (f.manual) this.pending.push({ k: 'manualEnd' })
    this.fingers.delete(id)
    this.refresh()
  }

  clear() {
    for (const id of [...this.fingers.keys()]) this.cancel(id)
    this.steer = 0
    this.balance = 0
  }

  /** Se llama en cada cuadro: detecta los "mantener apretado" (agarres y manuales) y devuelve los gestos listos. */
  update(t: number): Gesture[] {
    const air = this.context().airborne
    for (const f of this.fingers.values()) {
      if (f.swiped) continue
      const moved = Math.hypot(f.u - f.u0, f.v - f.v0)
      const held = t - f.t0
      if (!f.held && moved <= HOLD_MOVE) {
        if (air && held >= HOLD_MS) {
          f.held = true
          this.pending.push({ k: 'grab', name: grabFor(f) })
        } else if (!air && (f.zone === 'tail' || f.zone === 'nose') && held >= MANUAL_HOLD_MS) {
          f.held = true
          f.manual = true
          this.pending.push({ k: 'manual', nose: f.zone === 'nose' })
        }
      }
    }
    this.refresh()
    const out = this.pending
    this.pending = []
    return out
  }

  /** Dedos apoyados ahora (para dibujar los puntos de contacto). */
  get active(): readonly { id: number; u: number; v: number }[] {
    return [...this.fingers.values()].map(({ id, u, v }) => ({ id, u, v }))
  }

  private refresh() {
    let steer = 0
    let balance = 0
    for (const f of this.fingers.values()) {
      if (f.zone === 'middle' && !f.swiped) {
        steer = Math.max(-1, Math.min(1, (f.u - f.u0) / 0.4))
      }
      if (f.manual) balance = Math.max(-1, Math.min(1, (f.v - f.v0) / 0.35))
    }
    this.steer = steer
    this.balance = balance
  }

  private classify(f: Finger, t: number) {
    const du = f.u - f.u0
    const dv = f.v - f.v0
    const dist = Math.hypot(du, dv)
    const air = this.context().airborne
    // Velocidad del latigazo: el tramo reciente del recorrido, no el promedio de todo el toque.
    const first = f.trail[0]!
    const dt = Math.max(0.016, (t - first.t) / 1000)
    const speed = Math.hypot(f.u - first.u, f.v - first.v) / dt
    if (dist < SWIPE_MIN || t - f.tm > SWIPE_WINDOW_MS * 1.6) return
    if (dist < SWIPE_FAST && speed < 1.2) return
    f.swiped = true
    const power = Math.max(powerOf(speed), Math.min(0.55, dist / 1.4))
    const side: 1 | -1 = du >= 0 ? 1 : -1
    const lateral = Math.abs(du)
    const up = dv

    switch (f.zone) {
      case 'tail':
        if (up > 0) {
          if (lateral >= 0.45 * up) {
            this.pending.push({ k: 'popShuvit', power, dir: side, nollie: false })
          } else this.pending.push({ k: 'ollie', power, nollie: false })
        } else if (lateral > 0.3) {
          this.pending.push({ k: 'shuvit', power, dir: side })
        }
        break
      case 'nose':
        if (up < 0) {
          if (lateral >= 0.45 * -up) {
            this.pending.push({ k: 'popShuvit', power, dir: side, nollie: true })
          } else this.pending.push({ k: 'ollie', power, nollie: true })
        } else if (lateral > 0.3) {
          this.pending.push({ k: 'shuvit', power, dir: side })
        }
        break
      case 'side':
        if (up > 0.4 * lateral && up > 0.15) {
          // Diagonal hacia la izquierda = kickflip, hacia la derecha = heelflip.
          this.pending.push({ k: 'flip', power, dir: du <= 0 ? 1 : -1 })
        } else if (lateral > 0.25) {
          this.pending.push({ k: 'shuvit', power, dir: side })
        }
        break
      case 'middle':
        if (air || this.grindingHint) {
          if (lateral > 0.25 && lateral >= Math.abs(dv)) {
            this.pending.push({ k: 'spin', power, dir: side })
          }
        } else if (dv < -0.3 && lateral < 0.6 * -dv) {
          this.pending.push({ k: 'push', power })
        } else {
          // Arrastrar de lado sobre el centro es doblar: el dedo sigue valiendo.
          f.swiped = false
        }
        break
    }
  }

  /** El controlador lo prende mientras patina sobre un riel: ahi un latigazo lateral gira la tabla. */
  grindingHint = false
}

function grabFor(f: Finger): GrabName {
  if (f.zone === 'nose') return 'nose'
  if (f.zone === 'tail') return 'tail'
  return f.u0 < 0 ? 'indy' : 'melon'
}
