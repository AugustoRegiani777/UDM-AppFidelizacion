// SkateTouchController: el control multi-touch de "Miga Skate". TypeScript puro (recibe dedos y devuelve
// gestos ya clasificados; no toca el DOM). Las coordenadas son las del "pad": el centro de la tabla es
// (0, 0), u crece hacia la derecha y v hacia arriba; 2 unidades de pad equivalen a 1 metro de tabla.
//
// Capa de colision invisible (TouchHitbox): un 40 % mas ancha que la tabla dibujada. Dentro de ella el
// punto tocado se pasa a coordenadas LOCALES de la tabla (x a lo ancho, z a lo largo) y se clasifica:
//   Nose   : z >  0.3
//   Center : -0.3 <= z <= 0.3
//   Tail   : z < -0.3
//
// Roles de los dedos (se asignan al apoyar y no cambian):
//   board  -> dentro del hitbox: trucos con la tabla (ollie, nollie, flips, manual, catch)
//   drive  -> fuera del hitbox con el skater en el suelo: dirige (desplazamiento lateral) y empuja
//             (deslizar hacia arriba). En el aire, si ya estaba apoyado: giro del cuerpo / agarre.
//   flick  -> fuera del hitbox, apoyado ya en el aire: tirada de kickflip / heelflip / shove-it
//
// Gestos principales:
//   ollie      cola + deslizar hacia arriba, o centro + deslizar rapido hacia abajo hasta la cola
//   nollie     nariz + deslizar hacia abajo, o centro + deslizar hacia arriba hasta la nariz
//   pop shove-it  como el ollie pero con la tirada en diagonal
//   flips/shuvit  en el aire, el vector del swipe (pantalla) se proyecta al plano de la camara y de ahi a
//                 los ejes de la tabla: Z (kickflip / heelflip) e Y (shuvit)
//   catch      en el aire, dedo mantenido sobre el hitbox
//   manual     en el suelo, dedo mantenido sobre la cola o la nariz

import { BOARD_HALF_LENGTH, BOARD_HALF_WIDTH, type Gesture, type GrabName } from './gestures.ts'
import type { SkateState } from './stateMachine.ts'

export const PAD_PER_METER = 2
export const HITBOX_SCALE = 1.4
export const NOSE_Z = 0.3

export type Zone = 'nose' | 'center' | 'tail'
export type Role = 'board' | 'drive' | 'flick'

export const hitboxHalfWidth = () => BOARD_HALF_WIDTH * HITBOX_SCALE
/** Largo util del hitbox: la tabla y un poco mas para que la cola y la nariz sean faciles de tocar. */
export const hitboxHalfLength = () => BOARD_HALF_LENGTH * 2.4

/** Punto del pad -> coordenadas locales de la tabla en metros (x a lo ancho, z a lo largo). */
export const padToBoard = (u: number, v: number) => ({ x: u / PAD_PER_METER, z: v / PAD_PER_METER })

export function zoneOfZ(z: number): Zone {
  if (z > NOSE_Z) return 'nose'
  if (z < -NOSE_Z) return 'tail'
  return 'center'
}

export function inHitbox(x: number, z: number): boolean {
  return Math.abs(x) <= hitboxHalfWidth() && Math.abs(z) <= hitboxHalfLength()
}

/** Zona de un punto del pad, o null si cae fuera del hitbox. */
export function zoneAt(u: number, v: number): Zone | null {
  const { x, z } = padToBoard(u, v)
  return inHitbox(x, z) ? zoneOfZ(z) : null
}

/**
 * Lleva un desplazamiento de pantalla (du hacia la derecha, dv hacia arriba) al plano de la camara y de
 * ahi a los ejes de la tabla. `a` > 0 es hacia la derecha de la tabla; `b` > 0 hacia su nariz. Con la
 * camara detras de la tabla (el caso normal) es la identidad.
 */
export function projectToBoard(
  du: number,
  dv: number,
  cameraYaw: number,
  boardYaw: number,
): { a: number; b: number } {
  const cf = { x: Math.sin(cameraYaw), z: Math.cos(cameraYaw) }
  const cr = { x: -cf.z, z: cf.x }
  const wx = cr.x * du + cf.x * dv
  const wz = cr.z * du + cf.z * dv
  const bf = { x: Math.sin(boardYaw), z: Math.cos(boardYaw) }
  const br = { x: -bf.z, z: bf.x }
  return { a: wx * br.x + wz * br.z, b: wx * bf.x + wz * bf.z }
}

/** Convierte la velocidad del latigazo (unidades de pad por segundo) en potencia 0..1. */
export function powerOf(speed: number): number {
  return Math.max(0, Math.min(1, (speed - 1.2) / 3.2))
}

const SWIPE_MIN = 0.3
const SWIPE_FAST = 0.5
const SWIPE_AUTO = 0.85
const SWIPE_WINDOW_MS = 650
const HOLD_MS = 160
const CATCH_MS = 110
const HOLD_MOVE = 0.14
const MANUAL_HOLD_MS = 220
const STEER_RANGE = 0.4

interface Finger {
  id: number
  role: Role
  zone: Zone | 'side'
  u0: number
  v0: number
  t0: number
  /** Cuando empezo a moverse (el tiempo apoyado quieto no cuenta para el latigazo). */
  tm: number
  moving: boolean
  u: number
  v: number
  trail: { u: number; v: number; t: number }[]
  swiped: boolean
  held: boolean
  manual: boolean
  catching: boolean
  grabbing: boolean
  /** Estaba en el aire cuando se apoyo. */
  airAtDown: boolean
}

export interface TouchContext {
  state: SkateState
  /** Rumbo de la tabla (0 = +Z, crece a la izquierda) y de la camara. */
  boardYaw: number
  cameraYaw: number
}

const defaultContext = (): TouchContext => ({ state: 'grounded', boardYaw: 0, cameraYaw: 0 })

export class SkateTouchController {
  private readonly fingers = new Map<number, Finger>()
  private pending: Gesture[] = []
  /** Doblar: desplazamiento lateral del dedo que dirige (-1..1; positivo = derecha). */
  steer = 0
  /** Equilibrio del manual o del riel (-1..1). */
  balance = 0
  /** Hay un dedo atajando la tabla en el aire. */
  catching = false
  /** Zurdos: se invierte el lado de los controles (espejo horizontal del pad). */
  leftHanded = false

  constructor(private readonly context: () => TouchContext = defaultContext) {}

  private get air() {
    const s = this.context().state
    return s === 'airborne' || s === 'popping'
  }

  private mirror(u: number) {
    return this.leftHanded ? -u : u
  }

  down(id: number, u: number, v: number, t: number) {
    u = this.mirror(u)
    const { x, z } = padToBoard(u, v)
    const inBox = inHitbox(x, z)
    const air = this.air
    const role: Role = inBox ? 'board' : air ? 'flick' : 'drive'
    this.fingers.set(id, {
      id,
      role,
      zone: inBox ? zoneOfZ(z) : 'side',
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
      catching: false,
      grabbing: false,
      airAtDown: air,
    })
  }

  move(id: number, u: number, v: number, t: number) {
    const f = this.fingers.get(id)
    if (!f) return
    u = this.mirror(u)
    f.u = u
    f.v = v
    f.trail.push({ u, v, t })
    while (f.trail.length > 2 && t - f.trail[0]!.t > 120) f.trail.shift()
    if (!f.moving && Math.hypot(u - f.u0, v - f.v0) > HOLD_MOVE) {
      f.moving = true
      f.tm = t
    }
    this.refresh()
    if (f.swiped) return
    // Un deslizamiento largo y rapido se dispara sin esperar a que levantes el dedo.
    if (Math.hypot(u - f.u0, v - f.v0) >= SWIPE_AUTO && t - f.tm <= SWIPE_WINDOW_MS)
      this.classify(f, t)
  }

  up(id: number, u: number, v: number, t: number) {
    const f = this.fingers.get(id)
    if (!f) return
    u = this.mirror(u)
    f.u = u
    f.v = v
    f.trail.push({ u, v, t })
    if (!f.swiped) this.classify(f, t)
    this.release(f)
    this.fingers.delete(id)
    this.refresh()
  }

  cancel(id: number) {
    const f = this.fingers.get(id)
    if (!f) return
    this.release(f)
    this.fingers.delete(id)
    this.refresh()
  }

  private release(f: Finger) {
    if (f.grabbing) this.pending.push({ k: 'grabEnd' })
    if (f.manual) this.pending.push({ k: 'manualEnd' })
    if (f.catching) this.pending.push({ k: 'catchEnd' })
  }

  clear() {
    for (const id of [...this.fingers.keys()]) this.cancel(id)
    this.steer = 0
    this.balance = 0
    this.catching = false
  }

  /** Se llama en cada cuadro: detecta los "mantener apretado" (catch, agarres, manuales) y devuelve los gestos listos. */
  update(t: number): Gesture[] {
    const air = this.air
    for (const f of this.fingers.values()) {
      if (f.swiped || f.held) continue
      const moved = Math.hypot(f.u - f.u0, f.v - f.v0)
      if (moved > HOLD_MOVE) continue
      const heldFor = t - f.t0
      if (air) {
        if (f.role === 'board' && heldFor >= CATCH_MS) {
          f.held = true
          f.catching = true
          this.pending.push({ k: 'catch' })
        } else if (f.role !== 'board' && heldFor >= HOLD_MS) {
          f.held = true
          f.grabbing = true
          this.pending.push({ k: 'grab', name: grabFor(f) })
        }
      } else if (f.role === 'board' && f.zone !== 'center' && heldFor >= MANUAL_HOLD_MS) {
        f.held = true
        f.manual = true
        this.pending.push({ k: 'manual', nose: f.zone === 'nose' })
      }
    }
    // Un dedo que ya atajaba la tabla sigue valiendo si el skater cae al suelo: se suelta solo.
    if (!air) {
      for (const f of this.fingers.values()) {
        if (f.catching) {
          f.catching = false
          this.pending.push({ k: 'catchEnd' })
        }
      }
    }
    this.refresh()
    const out = this.pending
    this.pending = []
    return out
  }

  /** Dedos apoyados ahora (para dibujar los puntos de contacto). */
  get active(): readonly { id: number; u: number; v: number; role: Role }[] {
    return [...this.fingers.values()].map(({ id, u, v, role }) => ({
      id,
      u: this.mirror(u),
      v,
      role,
    }))
  }

  private refresh() {
    let steer = 0
    let balance = 0
    let catching = false
    let drive: Finger | null = null
    for (const f of this.fingers.values()) {
      const steers = f.role === 'drive' || (f.role === 'board' && f.zone === 'center' && !f.swiped)
      if (steers && (!drive || f.role === 'drive')) drive = f
      if (f.manual) balance = clamp1((f.v - f.v0) / 0.35)
      if (f.catching) catching = true
    }
    if (drive) {
      steer = clamp1((drive.u - drive.u0) / STEER_RANGE)
      // Sobre un riel el mismo dedo equilibra.
      if (this.context().state === 'grinding') balance = steer
    }
    this.steer = steer
    this.balance = balance
    this.catching = catching
  }

  private classify(f: Finger, t: number) {
    const du = f.u - f.u0
    const dv = f.v - f.v0
    const dist = Math.hypot(du, dv)
    const ctx = this.context()
    const air = this.air
    // Velocidad del latigazo: el tramo reciente del recorrido, no el promedio de todo el toque.
    const first = f.trail[0]!
    const dt = Math.max(0.016, (t - first.t) / 1000)
    const speed = Math.hypot(f.u - first.u, f.v - first.v) / dt
    if (dist < SWIPE_MIN || t - f.tm > SWIPE_WINDOW_MS * 1.6) return
    if (dist < SWIPE_FAST && speed < 1.2) return
    const power = Math.max(powerOf(speed), Math.min(0.55, dist / 1.4))

    if (f.role === 'drive') {
      this.classifyDrive(f, du, dv, power, air, ctx)
      return
    }
    if (air || f.role === 'flick') {
      this.classifyAirTrick(f, du, dv, power, ctx)
      return
    }
    if (ctx.state === 'grinding') {
      // Un latigazo lateral sobre el riel gira la tabla: boardslide <-> 50-50.
      if (Math.abs(du) > 0.25) {
        f.swiped = true
        this.pending.push({ k: 'spin', power, dir: du >= 0 ? 1 : -1 })
      }
      return
    }
    this.classifyGround(f, du, dv, power)
  }

  private classifyDrive(
    f: Finger,
    du: number,
    dv: number,
    power: number,
    air: boolean,
    ctx: TouchContext,
  ) {
    const lateral = Math.abs(du)
    if (air) {
      // El dedo que dirige, en el aire: un latigazo de lado gira el cuerpo.
      if (lateral > 0.25 && lateral >= Math.abs(dv)) {
        f.swiped = true
        this.pending.push({ k: 'spin', power, dir: du >= 0 ? 1 : -1 })
      }
      return
    }
    if (ctx.state === 'grinding') {
      if (lateral > 0.45 && lateral >= Math.abs(dv)) {
        f.swiped = true
        this.pending.push({ k: 'spin', power, dir: du >= 0 ? 1 : -1 })
      }
      return
    }
    // Empuje: deslizar hacia arriba. El dedo sigue valiendo para doblar.
    if (dv > 0.3 && lateral < 0.7 * dv) {
      f.swiped = true
      f.v0 = f.v
      f.u0 = f.u
      this.pending.push({ k: 'push', power })
      // `swiped` solo evita repetir el empuje con este toque; el dedo sigue dirigiendo.
    }
  }

  private classifyGround(f: Finger, du: number, dv: number, power: number) {
    const side: 1 | -1 = du >= 0 ? 1 : -1
    const lateral = Math.abs(du)
    switch (f.zone) {
      case 'tail':
        if (dv > 0) {
          f.swiped = true
          if (lateral >= 0.45 * dv)
            this.pending.push({ k: 'popShuvit', power, dir: side, nollie: false })
          else this.pending.push({ k: 'ollie', power, nollie: false })
        } else if (lateral > 0.3) {
          f.swiped = true
          this.pending.push({ k: 'shuvit', power, dir: side })
        }
        break
      case 'nose':
        if (dv < 0) {
          f.swiped = true
          if (lateral >= 0.45 * -dv)
            this.pending.push({ k: 'popShuvit', power, dir: side, nollie: true })
          else this.pending.push({ k: 'ollie', power, nollie: true })
        } else if (lateral > 0.3) {
          f.swiped = true
          this.pending.push({ k: 'shuvit', power, dir: side })
        }
        break
      case 'center': {
        // Centro + deslizar rapido hasta la cola = ollie; hasta la nariz = nollie. De lado es doblar.
        const endZ = padToBoard(f.u, f.v).z
        if (dv < -0.3 && lateral < 0.6 * -dv && zoneOfZ(endZ) === 'tail') {
          f.swiped = true
          this.pending.push({ k: 'ollie', power, nollie: false })
        } else if (dv > 0.3 && lateral < 0.6 * dv && zoneOfZ(endZ) === 'nose') {
          f.swiped = true
          this.pending.push({ k: 'ollie', power, nollie: true })
        }
        break
      }
      default:
    }
  }

  /** En el aire: el vector del swipe, proyectado al plano de la camara y a los ejes de la tabla. */
  private classifyAirTrick(f: Finger, du: number, dv: number, power: number, ctx: TouchContext) {
    const { a, b } = projectToBoard(du, dv, ctx.cameraYaw, ctx.boardYaw)
    const side: 1 | -1 = a >= 0 ? 1 : -1
    const lateral = Math.abs(a)
    if (f.zone === 'tail') {
      // Cola empujada de lado = shove-it (Y); si ademas tira hacia adelante, tambien flip (360 flip).
      if (lateral > 0.3) {
        f.swiped = true
        this.pending.push({ k: 'shuvit', power, dir: side })
        if (b > 0 && b >= 0.45 * lateral)
          this.pending.push({ k: 'flip', power, dir: a <= 0 ? 1 : -1 })
      }
      return
    }
    if (b > 0.15 && b > 0.4 * lateral) {
      // Diagonal hacia adelante: izquierda = kickflip, derecha = heelflip (torque en Z).
      f.swiped = true
      this.pending.push({ k: 'flip', power, dir: a <= 0 ? 1 : -1 })
    } else if (lateral > 0.25) {
      f.swiped = true
      this.pending.push({ k: 'shuvit', power, dir: side })
    }
  }
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

function grabFor(f: Finger): GrabName {
  const { z } = padToBoard(f.u0, f.v0)
  if (z > 0.6) return 'nose'
  if (z < -0.6) return 'tail'
  return f.u0 < 0 ? 'indy' : 'melon'
}
