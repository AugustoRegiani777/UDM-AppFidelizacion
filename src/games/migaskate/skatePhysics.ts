// SkatePhysics: el nucleo fisico de "Miga Skate". TypeScript puro (sin three.js ni DOM), determinista y
// testeable en Vitest. Traduce la especificacion pensada para Unity:
//
//   Rigidbody + interpolacion        -> RigidBody propio (rigidbody.ts), paso fijo de 120 Hz con
//                                       acumulador y pose interpolada para dibujar (`view(alpha)`)
//   Continuous Dynamic               -> subpasos adaptativos: ningun subpaso mueve la tabla mas de
//                                       ~5 cm, menos que su ancho, asi no atraviesa rampas ni rieles
//   centerOfMass (0, -0.05, 0)       -> `comLocal` del cuerpo: las fuerzas fuera del centro generan torque
//   4 Raycast de suspension          -> `raycastDown` (world.ts) en las 4 esquinas de los trucks, con
//                                       resorte de Hooke y amortiguacion asimetrica
//   InverseTransformDirection        -> `body.toLocalDirection` (conjugado del cuaternion)
//   AddRelativeTorque                -> `body.addRelativeTorque` / `addRelativeAngularImpulse`
//   angularDrag                      -> `body.angularDrag` (aire 0.4, suelo 2.5, catch 20)
//   OnPop/OnLand/OnGrindStart/Stay   -> `on('pop'|'land'|'grindStart'|'grindStay', fn)` y alias onPop...
//
// El cliente nunca decide puntos: esto solo simula y avisa; la sesion (session.ts) puntua.

import type { Gesture, GrabName } from './gestures.ts'
import { RigidBody } from './rigidbody.ts'
import { SkateStateMachine, type SkateState } from './stateMachine.ts'
import {
  clamp,
  qLookUp,
  qSlerp,
  TAU,
  v3,
  vAdd,
  vCross,
  vDot,
  vLen,
  vNorm,
  vScale,
  vSub,
  wrapPi,
  type Q,
  type V3,
} from './vec.ts'
import {
  closestOnRail,
  groundNormal,
  heightAt,
  raycastDown,
  wallPush,
  type WorldDef,
} from './world.ts'

export const STEP = 1 / 120
export const MAX_SPEED = 10
export const CRUISE_SPEED = 3.2
/** Cuanto puede faltar del giro del cuerpo para aterrizar sin caerse (radianes). */
export const LAND_TOLERANCE = 0.9

export type GrindKind = '50-50' | 'boardslide'
export type LandQuality = 'clean' | 'sloppy'

export interface PhysicsParams {
  gravity: number
  mass: number
  inertia: V3
  comLocal: V3
  linearDrag: number
  angularDragGround: number
  angularDragAir: number
  angularDragCatch: number
  /** Puntos de las ruedas (centro de cada truck, local). */
  wheelX: number
  wheelZ: number
  wheelY: number
  suspension: {
    /** Largo maximo del rayo: sin contacto mas lejos que esto. */
    rayLength: number
    stiffness: number
    dampCompress: number
    dampRebound: number
    /** Amortiguacion cuadratica: frena los impactos muy rapidos dentro del recorrido. */
    dampQuadratic: number
    bumpStart: number
    bumpStiffness: number
    /** Cuanto sube el origen del rayo para no perder una rueda que se hundio. */
    skin: number
    /** Minimo de (arriba de la tabla . normal) para que una rueda cuente. */
    minUp: number
  }
  friction: {
    lateral: number
    maxLateralAccel: number
    longitudinal: number
  }
  steer: { maxAngle: number; rearFactor: number; speedFade: number }
  ollie: {
    velocity: number
    velocityRange: number
    pitch: number
    pitchRange: number
    popTime: number
  }
  flip: { omega: number; omegaRange: number; doubleOmega: number }
  shuvit: { omega: number; omegaRange: number; doubleOmega: number }
  settle: { kp: number; kd: number; rollZone: number; yawZone: number }
  air: { pitchKp: number; pitchKd: number; rollKp: number; rollKd: number }
  autoLevel: { distance: number; kp: number; kd: number; minUp: number }
  catchLevel: { kp: number }
  /** Aterrizaje: cosenos de los umbrales (arriba de la tabla vs normal; alineacion con la velocidad). */
  land: { cleanUp: number; sloppyUp: number; cleanAlign: number; sloppyAlign: number }
  /** Pedaleo del jinete: velocidad de crucero sobre plano (m/s). */
  cruise: number
  bailTime: number
  coyoteTime: number
}

export const DEFAULT_PARAMS: PhysicsParams = {
  gravity: 17,
  mass: 4,
  inertia: v3(0.28, 0.3, 0.05),
  comLocal: v3(0, -0.05, 0),
  linearDrag: 0.05,
  angularDragGround: 2.5,
  angularDragAir: 0.4,
  angularDragCatch: 20,
  wheelX: 0.1,
  wheelZ: 0.27,
  wheelY: -0.045,
  suspension: {
    rayLength: 0.07,
    stiffness: 850,
    dampCompress: 120,
    dampRebound: 40,
    dampQuadratic: 40,
    bumpStart: 0.015,
    bumpStiffness: 5000,
    skin: 0.2,
    minUp: 0.2,
  },
  friction: { lateral: 30, maxLateralAccel: 45, longitudinal: 0.05 },
  steer: { maxAngle: 0.34, rearFactor: -0.35, speedFade: 0.06 },
  ollie: { velocity: 3.8, velocityRange: 2.6, pitch: 5, pitchRange: 3, popTime: 0.1 },
  flip: { omega: 13, omegaRange: 7, doubleOmega: 24 },
  shuvit: { omega: 9, omegaRange: 5, doubleOmega: 18 },
  settle: { kp: 196, kd: 28, rollZone: 0.9, yawZone: 0.8 },
  air: { pitchKp: 100, pitchKd: 14, rollKp: 60, rollKd: 11 },
  autoLevel: { distance: 0.4, kp: 90, kd: 14, minUp: 0.35 },
  catchLevel: { kp: 160 },
  land: { cleanUp: 0.9, sloppyUp: 0.62, cleanAlign: 0.85, sloppyAlign: 0.45 },
  cruise: CRUISE_SPEED,
  bailTime: 0.9,
  coyoteTime: 0.1,
}

// --- Eventos / hooks --------------------------------------------------------------------------------

export interface LandedTrick {
  roll: number
  yaw: number
  spin: number
  nollie: boolean
  grab: GrabName | null
  popped: boolean
  airTime: number
  height: number
  quality: LandQuality
}

export type SkateEvent =
  | { t: 'pop'; nollie: boolean; power: number; fromGrind: boolean }
  | {
      t: 'land'
      trick: LandedTrick | null
      hard: boolean
      quality: LandQuality
      /** Velocidad con que entro al suelo (m/s). */
      impact: number
      x: number
      y: number
      z: number
    }
  | { t: 'bail'; reason: 'trick' | 'grind' | 'manual' }
  | { t: 'grindStart'; kind: GrindKind; x: number; y: number; z: number }
  | { t: 'grindStay'; kind: GrindKind; speed: number; x: number; y: number; z: number }
  | { t: 'grindEnd'; seconds: number; kind: GrindKind }
  | { t: 'manualStart' }
  | { t: 'manualEnd'; seconds: number; nose: boolean }
  | { t: 'grabStart'; name: GrabName }
  | { t: 'bump'; speed: number }
  | { t: 'push' }
  | { t: 'flip' }
  | { t: 'catch' }

export type SkateEventType = SkateEvent['t']
export type EventOf<K extends SkateEventType> = Extract<SkateEvent, { t: K }>

/** Vista de solo lectura para dibujar (el renderer nunca toca el estado). */
export interface SkaterView {
  position: V3
  rotation: Q
  velocity: V3
  state: SkateState
  riderYaw: number
  /** Velocidad horizontal (m/s, sin signo). */
  speed: number
  spin: number
  popped: boolean
  popAge: number
  nollie: boolean
  grab: GrabName | null
  manual: { nose: boolean; bal: number } | null
  grindKind: GrindKind | null
  grindBal: number
  bailProgress: number
  /** Normal del suelo suavizada (el jinete se para sobre ella). */
  rideUp: V3
  catching: boolean
  airborne: boolean
}

export interface SimInput {
  steer: number
  balance: number
}

interface GrindState {
  rail: number
  t: number
  sign: 1 | -1
  kind: GrindKind
  bal: number
  time: number
}

const UP = v3(0, 1, 0)

/** Base (vertical, eje del cabeceo, eje largo) de los angulos tipo Euler para un eje largo dado. */
function eulerBasis(z: V3): [V3, V3, V3] | null {
  const h = Math.hypot(z.x, z.z)
  if (h < 0.3) return null // la tabla casi vertical: la base se degenera
  return [v3(0, 1, 0), v3(z.z / h, 0, -z.x / h), z]
}

/** Resuelve M r = w con M de columnas c0, c1, c2 (regla de Cramer). */
function solve3(c: [V3, V3, V3], w: V3): V3 | null {
  const det = vDot(c[0], vCross(c[1], c[2]))
  if (Math.abs(det) < 0.05) return null
  return v3(
    vDot(w, vCross(c[1], c[2])) / det,
    vDot(c[0], vCross(w, c[2])) / det,
    vDot(c[0], vCross(c[1], w)) / det,
  )
}
/** Puntas y esquinas de la tabla (local): debajo y arriba de la cubierta. */
const HULL: V3[] = [-1, 1].flatMap((sx) =>
  [-1, 1].flatMap((sz) => [v3(0.11 * sx, -0.015, 0.41 * sz), v3(0.11 * sx, 0.025, 0.41 * sz)]),
)
const BOARD_Y = 0.095
const RAIL_OFFSET = 0.075

const easeToward = (value: number, target: number, rate: number, dt: number) => {
  const d = target - value
  const s = rate * dt
  return Math.abs(d) <= s ? target : value + Math.sign(d) * s
}

const wobbleAt = (t: number, seed: number) =>
  0.5 * Math.sin(t * 2.3 + seed * 7) + 0.35 * Math.sin(t * 5.1 + seed * 3) + 0.2 * Math.sin(t * 9.7)

type Listener = (e: SkateEvent) => void

export class SkatePhysics {
  readonly body: RigidBody
  readonly machine = new SkateStateMachine()
  readonly params: PhysicsParams
  readonly world: WorldDef

  // Entradas continuas.
  steer = 0
  balance = 0
  catching = false

  time = 0
  /** Contactos de suspension del ultimo subpaso (0..4). */
  contacts = 0
  contactNormal: V3 = v3(0, 1, 0)
  airTime = 0
  /** Segundos desde que las ruedas dejaron el suelo. */
  sinceGround = 0
  popped = false
  nollie = false
  popAge = 0
  popTimer = 0
  maxHeight = 0
  /** Giros acumulados (rad): roll = alrededor de Z local (flip), yaw = alrededor de Y local (shuvit). */
  rollAcc = 0
  yawAcc = 0
  private prevRoll = 0
  private prevYaw = 0
  /** Eje largo de la tabla en el subpaso anterior (para que el volteo lo siga mientras gira). */
  private lastLong: V3 = v3(0, 0, 1)
  rollTarget = 0
  yawTarget = 0
  /** Giro del cuerpo del jinete (se juzga al aterrizar). */
  spin = 0
  spinTarget = 0
  riderYaw: number
  grab: { name: GrabName; t: number } | null = null
  grabbed: GrabName | null = null
  manual: { nose: boolean; bal: number; t: number } | null = null
  grind: GrindState | null = null
  bailT = 0
  /** Mayor velocidad de entrada al suelo durante la caida actual. */
  private approach = 0
  private noContact = 0
  /** Giro de flip/shuvit (rad/s) antes del contacto. */
  private airSpin = 0
  /** Medidas del ultimo aterrizaje (para pruebas y para afinar). */
  lastLanding = { upDot: 1, align: 1, spin: 0, spinRem: 0, impact: 0 }
  /** Algun punto del casco toco el suelo en el ultimo subpaso. */
  private hullContact = false
  private pending: { kind: 'flip' | 'shuvit'; dir: 1 | -1; power: number; age: number } | null =
    null
  private buffered: { g: Gesture; age: number } | null = null
  private rideUp: V3 = v3(0, 1, 0)
  private acc = 0
  private bumpCooldown = 0
  private readonly wobbleSeed: number
  private readonly listeners = new Map<SkateEventType, Set<Listener>>()
  private frameEvents: SkateEvent[] = []

  constructor(world: WorldDef, params: PhysicsParams = DEFAULT_PARAMS, seed = 0.37) {
    this.world = world
    this.params = params
    this.wobbleSeed = seed
    this.body = new RigidBody({
      mass: params.mass,
      inertia: params.inertia,
      comLocal: params.comLocal,
      linearDrag: params.linearDrag,
      angularDrag: params.angularDragGround,
    })
    this.riderYaw = world.start.heading
    this.reset()
  }

  /** Pone la tabla en el punto de salida, apoyada en el suelo y rodando a velocidad de crucero. */
  reset() {
    const { x, z, heading } = this.world.start
    const h = heightAt(this.world, x, z)
    const n = groundNormal(this.world, x, z)
    const fwd = v3(Math.sin(heading), 0, Math.cos(heading))
    this.body.setPose(v3(x, h + BOARD_Y, z), qLookUp(fwd, n))
    this.body.velocity = vScale(fwd, CRUISE_SPEED)
    this.body.angularVelocity = v3()
    this.machine.reset('grounded')
    this.riderYaw = heading
    this.rideUp = n
    this.contacts = 4
    this.clearAir()
    this.grab = null
    this.manual = null
    this.grind = null
    this.bailT = 0
  }

  // --- Eventos ----------------------------------------------------------------------------------------

  /** Se suscribe a un evento. Devuelve la funcion que lo cancela. */
  on<K extends SkateEventType>(type: K, fn: (e: EventOf<K>) => void): () => void {
    let set = this.listeners.get(type)
    if (!set) this.listeners.set(type, (set = new Set()))
    set.add(fn as Listener)
    return () => set.delete(fn as Listener)
  }

  onPop = (fn: (e: EventOf<'pop'>) => void) => this.on('pop', fn)
  onLand = (fn: (e: EventOf<'land'>) => void) => this.on('land', fn)
  onGrindStart = (fn: (e: EventOf<'grindStart'>) => void) => this.on('grindStart', fn)
  onGrindStay = (fn: (e: EventOf<'grindStay'>) => void) => this.on('grindStay', fn)

  private emit(e: SkateEvent, out?: SkateEvent[]) {
    ;(out ?? this.frameEvents).push(e)
    const set = this.listeners.get(e.t)
    if (set) for (const l of set) l(e)
  }

  // --- Lecturas -------------------------------------------------------------------------------------------

  get state(): SkateState {
    return this.machine.state
  }

  get horizontalSpeed(): number {
    const v = this.body.velocity
    return Math.hypot(v.x, v.z)
  }

  /** Arriba de la tabla en el mundo. */
  get boardUp(): V3 {
    return this.body.toWorldDirection(UP)
  }

  get boardForward(): V3 {
    return this.body.toWorldDirection(v3(0, 0, 1))
  }

  /** Giro de la tabla (yaw) en radianes: 0 = hacia +Z, crece hacia la izquierda. */
  get boardYaw(): number {
    const f = this.boardForward
    return Math.atan2(f.x, f.z)
  }

  /** Angulo de volteo alrededor del eje Z local: 0 = ruedas abajo, PI = ruedas arriba. */
  get rollAngle(): number {
    const x = this.body.toWorldDirection(v3(1, 0, 0))
    return Math.atan2(x.y, this.boardUp.y)
  }

  /** Inclinacion de la nariz: positivo = nariz arriba. */
  get pitchAngle(): number {
    return Math.asin(clamp(this.boardForward.y, -1, 1))
  }

  get airborne(): boolean {
    return this.state === 'airborne' || this.state === 'popping'
  }

  /** Pose interpolada para dibujar. `alpha` es la fraccion del paso pendiente (0..1). */
  view(alpha = 1): SkaterView {
    const pose = this.body.interpolated(alpha)
    return {
      position: pose.position,
      rotation: pose.rotation,
      velocity: this.body.velocity,
      state: this.state,
      riderYaw: this.riderYaw,
      speed: this.horizontalSpeed,
      spin: this.spin,
      popped: this.popped,
      popAge: this.popAge,
      nollie: this.nollie,
      grab: this.grab?.name ?? null,
      manual: this.manual ? { nose: this.manual.nose, bal: this.manual.bal } : null,
      grindKind: this.grind?.kind ?? null,
      grindBal: this.grind?.bal ?? 0,
      bailProgress:
        this.state === 'bailed' ? 1 - clamp(this.bailT / this.params.bailTime, 0, 1) : 0,
      rideUp: this.rideUp,
      catching: this.catching && this.airborne,
      airborne: this.airborne,
    }
  }

  // --- Gestos ---------------------------------------------------------------------------------------------

  private canPop(): boolean {
    const s = this.state
    if (s === 'grounded' || s === 'grinding') return true
    return s === 'airborne' && !this.popped && this.sinceGround < this.params.coyoteTime
  }

  /** Aplica un gesto del dedo. Devuelve los eventos que provoco. */
  applyGesture(g: Gesture): SkateEvent[] {
    const out: SkateEvent[] = []
    if (this.state === 'bailed') return out
    switch (g.k) {
      case 'ollie':
      case 'popShuvit': {
        if (this.canPop()) {
          const power = g.k === 'popShuvit' ? Math.max(0.35, g.power * 0.85) : g.power
          this.pop(power, g.nollie, out)
          if (g.k === 'popShuvit') this.addRotation('shuvit', g.dir, 0.2, out)
        } else if (this.state === 'airborne' && this.body.velocity.y < 0) {
          this.buffered = { g, age: 0 } // un salto pedido justo antes de aterrizar se guarda un instante
        }
        break
      }
      case 'flip':
      case 'shuvit': {
        if (this.state === 'airborne' || this.state === 'popping') {
          this.addRotation(g.k, g.dir, g.power, out)
        } else if (this.state === 'grounded') {
          this.pending = { kind: g.k, dir: g.dir, power: g.power, age: 0 }
        }
        break
      }
      case 'spin': {
        if (this.state === 'airborne' && this.spinTarget === 0) {
          this.spinTarget = g.dir * Math.PI * (g.power > 0.8 ? 2 : 1)
          this.emit({ t: 'flip' }, out)
        } else if (this.state === 'grinding' && this.grind) {
          // Un latigazo sobre el riel gira la tabla a boardslide (y otro la vuelve a 50-50).
          this.grind.kind = this.grind.kind === '50-50' ? 'boardslide' : '50-50'
          const b = this.body.origin
          this.emit({ t: 'grindStart', kind: this.grind.kind, x: b.x, y: b.y, z: b.z }, out)
        }
        break
      }
      case 'push': {
        if (this.state === 'grounded') {
          const f = this.groundForward()
          const vLong = vDot(this.body.velocity, f)
          const target = Math.min(MAX_SPEED, Math.max(vLong, 0) + 1.3 + 2.4 * g.power)
          this.body.addVelocityChange(vScale(f, target - vLong))
          this.emit({ t: 'push' }, out)
        }
        break
      }
      case 'grab': {
        if (this.airborne && !this.grab) {
          this.grab = { name: g.name, t: 0 }
          this.grabbed = g.name
          this.emit({ t: 'grabStart', name: g.name }, out)
        }
        break
      }
      case 'grabEnd':
        this.grab = null
        break
      case 'manual': {
        if (this.state === 'grounded' && this.horizontalSpeed > 1.5 && !this.manual) {
          const side = wobbleAt(this.time, this.wobbleSeed) > 0 ? 1 : -1
          this.manual = { nose: g.nose, bal: 0.15 * side, t: 0 }
          this.emit({ t: 'manualStart' }, out)
        }
        break
      }
      case 'manualEnd':
        this.endManual(out)
        break
      case 'catch': {
        if (!this.catching) {
          this.catching = true
          if (this.airborne) this.emit({ t: 'catch' }, out)
        }
        break
      }
      case 'catchEnd':
        this.catching = false
        break
    }
    return out
  }

  private endManual(out: SkateEvent[]) {
    if (!this.manual) return
    this.emit({ t: 'manualEnd', seconds: this.manual.t, nose: this.manual.nose }, out)
    this.manual = null
  }

  private pop(power: number, nollie: boolean, out: SkateEvent[]) {
    const p = this.params
    const fromGrind = this.state === 'grinding'
    this.endManual(out)
    if (fromGrind && this.grind) {
      this.emit({ t: 'grindEnd', seconds: this.grind.time, kind: this.grind.kind }, out)
      this.grind = null
    }
    if (!this.machine.transition('popping')) return
    const b = this.body
    const vy0 = p.ollie.velocity + p.ollie.velocityRange * clamp(power, 0, 1)
    const v = b.velocity
    // Un ollie suma salto sobre lo que ya subia; si ibas cayendo, se frena la caida.
    b.velocity = v3(v.x, (v.y < 0 ? 0.35 * v.y : v.y) + vy0, v.z)
    // Torque de cabeceo: la cola golpea (nariz arriba) o la nariz golpea (nollie: cola arriba).
    const pitch = (p.ollie.pitch + p.ollie.pitchRange * clamp(power, 0, 1)) * (nollie ? 1 : -1)
    b.addRelativeAngularImpulse(v3(p.inertia.x * pitch, 0, 0))
    this.popTimer = p.ollie.popTime
    this.popped = true
    this.nollie = nollie
    this.popAge = 0
    this.clearAirCounters()
    this.emit({ t: 'pop', nollie, power, fromGrind }, out)
    const pend = this.pending
    this.pending = null
    if (pend && pend.age < 0.35) this.addRotation(pend.kind, pend.dir, pend.power, out)
  }

  /** Flip (eje Z local) o shove-it (eje Y local): un impulso angular y un objetivo de giros. */
  private addRotation(kind: 'flip' | 'shuvit', dir: 1 | -1, power: number, out: SkateEvent[]) {
    const p = this.params
    if (kind === 'flip') {
      if (this.rollTarget !== 0) return
      const revs = power > 0.8 ? 2 : 1
      this.rollTarget = dir * TAU * revs
      const omega = revs === 2 ? p.flip.doubleOmega : p.flip.omega + p.flip.omegaRange * power
      this.body.addRelativeAngularImpulse(v3(0, 0, p.inertia.z * dir * omega))
    } else {
      if (this.yawTarget !== 0) return
      const halves = power > 0.85 ? 2 : 1
      this.yawTarget = dir * Math.PI * halves
      const omega =
        halves === 2 ? p.shuvit.doubleOmega : p.shuvit.omega + p.shuvit.omegaRange * power
      // El shove-it gira alrededor de la vertical del mundo (= el Y local con la tabla de pie): asi no
      // se mezcla con el flip y un 360 flip (flip + shuvit) vuelve a quedar plano.
      this.body.addAngularVelocityChange(v3(0, dir * omega, 0))
    }
    this.emit({ t: 'flip' }, out)
  }

  private clearAirCounters() {
    this.airTime = 0
    this.maxHeight = 0
    this.rollAcc = 0
    this.yawAcc = 0
    this.prevRoll = this.rollAngle
    this.prevYaw = this.boardYaw
    this.lastLong = this.boardForward
    this.rollTarget = 0
    this.yawTarget = 0
    this.spin = 0
    this.spinTarget = 0
    this.grabbed = null
    this.approach = 0
  }

  private clearAir() {
    this.clearAirCounters()
    this.popped = false
    this.nollie = false
    this.popAge = 0
    this.popTimer = 0
    this.sinceGround = 0
    this.noContact = 0
    this.pending = null
    this.buffered = null
  }

  // --- Avance -----------------------------------------------------------------------------------------------

  /** Recorre los pasos fijos que correspondan a `elapsed` segundos. Devuelve alpha para interpolar. */
  advance(elapsed: number, onEvents?: (events: SkateEvent[]) => void): number {
    this.acc += Math.min(elapsed, 0.25)
    while (this.acc >= STEP) {
      const events = this.step(STEP)
      if (events.length && onEvents) onEvents(events)
      this.acc -= STEP
    }
    return this.acc / STEP
  }

  /** Un paso fijo de `dt` segundos con los subpasos que haga falta. */
  step(dt: number = STEP): SkateEvent[] {
    this.frameEvents = []
    const events = this.frameEvents
    this.time += dt
    this.machine.tick(dt)
    this.body.snapshot()
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt)
    if (this.pending && (this.pending.age += dt) > 0.4) this.pending = null
    if (this.buffered && (this.buffered.age += dt) > 0.2) this.buffered = null

    if (this.state === 'grinding') {
      this.stepGrind(dt, events)
    } else {
      // Subpasos "tipo Continuous": ningun subpaso mueve la tabla mas de ~5 cm.
      const reach = vLen(this.body.velocity) * dt + vLen(this.body.angularVelocity) * dt * 0.3
      const n = clamp(Math.ceil(reach / 0.05), 1, 8)
      for (let i = 0; i < n; i++) this.subStep(dt / n, events)
      this.afterStep(dt, events)
    }
    this.updateRider(dt)
    return events
  }

  private subStep(h: number, events: SkateEvent[]) {
    this.applyForces(h)
    if (this.airborne) {
      // En el aire la orientacion se integra en tramos finos y se re-expresa en la base de los giros.
      const w = vLen(this.body.angularVelocity)
      const steps = clamp(Math.ceil((w * h) / 0.03), 1, 12)
      this.body.integrate(h, steps, () => this.followEulerAxes())
    } else this.body.integrate(h)
    this.resolveWalls(events)
    this.keepInside(events)
    this.transitions(h, events)
  }

  // --- Fuerzas ----------------------------------------------------------------------------------------------

  private wheels(): { local: V3; front: boolean }[] {
    const p = this.params
    const all = [
      { local: v3(p.wheelX, p.wheelY, p.wheelZ), front: true },
      { local: v3(-p.wheelX, p.wheelY, p.wheelZ), front: true },
      { local: v3(p.wheelX, p.wheelY, -p.wheelZ), front: false },
      { local: v3(-p.wheelX, p.wheelY, -p.wheelZ), front: false },
    ]
    return all
  }

  /** Angulo de giro de los trucks segun el dedo (negativo = derecha) y la velocidad. */
  private steerAngle(): number {
    const p = this.params.steer
    const speed = this.horizontalSpeed
    const fade = 1 / (1 + p.speedFade * speed * speed)
    const dirSign = this.body.toLocalDirection(this.body.velocity).z < -0.3 ? -1 : 1
    const inManual = this.manual ? 0.5 : 1
    return -this.steer * p.maxAngle * fade * dirSign * inManual
  }

  private groundForward(): V3 {
    const n = this.contacts > 0 ? this.contactNormal : UP
    const fwd = this.boardForward
    const f = vSub(fwd, vScale(n, vDot(fwd, n)))
    return vLen(f) < 1e-6 ? v3(Math.sin(this.riderYaw), 0, Math.cos(this.riderYaw)) : vNorm(f)
  }

  private applyForces(h: number) {
    const b = this.body
    const p = this.params
    const sp = p.suspension
    const state = this.state
    b.addForce(v3(0, -p.gravity * p.mass, 0))

    // Drag angular segun el estado (catch = 20).
    b.angularDrag =
      state === 'bailed'
        ? p.angularDragGround
        : this.airborne
          ? this.catching
            ? p.angularDragCatch
            : p.angularDragAir
          : p.angularDragGround

    // --- Suspension por raycast + friccion anisotropica en cada rueda ---
    let contacts = 0
    let nSum = v3()
    const up = this.boardUp
    const meff = p.mass / 4
    const delta = this.steerAngle()
    if (state !== 'popping') {
      for (const w of this.wheels()) {
        const pw = b.toWorld(w.local)
        const hit = raycastDown(this.world, pw.x, pw.y + sp.skin, pw.z, sp.skin + sp.rayLength)
        if (!hit) continue
        const n = v3(hit.nx, hit.ny, hit.nz)
        const d = (pw.y - hit.y) * hit.ny
        if (d >= sp.rayLength || vDot(up, n) < sp.minUp) continue
        contacts++
        nSum = vAdd(nSum, n)
        const vp = b.pointVelocity(pw)
        const vn = vDot(vp, n)
        if (state === 'airborne' && -vn > this.approach) this.approach = -vn
        // Ley de Hooke (solo empuja) + amortiguacion asimetrica que nunca invierte la velocidad.
        let f = sp.stiffness * (sp.rayLength - d)
        if (d < sp.bumpStart) f += sp.bumpStiffness * (sp.bumpStart - d)
        const c = vn < 0 ? sp.dampCompress + sp.dampQuadratic * -vn : sp.dampRebound
        const maxDamp = (meff * Math.abs(vn)) / h
        const fd = clamp(-c * vn, -maxDamp, maxDamp)
        b.addForceAtPoint(vScale(n, Math.max(0, f + fd)), pw)

        // Friccion anisotropica en ejes locales de la tabla (transformada inversa de la orientacion).
        const vl = b.toLocalDirection(vp)
        const ang = w.front ? delta : delta * p.steer.rearFactor
        const cs = Math.cos(ang)
        const sn = Math.sin(ang)
        // Ejes del truck girado: lateral (cos, 0, -sin) y avance (sin, 0, cos).
        const vLat = vl.x * cs - vl.z * sn
        const vLon = vl.x * sn + vl.z * cs
        const aLat = clamp(
          -p.friction.lateral * vLat,
          -p.friction.maxLateralAccel,
          p.friction.maxLateralAccel,
        )
        const aLon = -p.friction.longitudinal * vLon
        const local = v3((aLat * cs + aLon * sn) * meff, 0, (-aLat * sn + aLon * cs) * meff)
        b.addForceAtPoint(b.toWorldDirection(local), pw)
      }
    }
    this.contacts = contacts
    if (contacts > 0) this.contactNormal = vNorm(nSum)
    this.hullContact = this.hullForces(h, contacts > 0)

    if (state === 'grounded' && contacts > 0) this.rideForces()
    if (this.airborne) this.airTorques()
    if (this.manual && state === 'grounded') this.manualTorque()
  }

  /**
   * Casco de la tabla (puntas y esquinas de la cubierta): si algun punto se mete en el suelo actua un
   * resorte rigido. Asi una tabla que cae de canto o boca abajo se apoya en vez de atravesar el piso.
   * Devuelve true si hubo contacto (la fisica lo usa para juzgar el aterrizaje).
   */
  private hullForces(h: number, wheelsOn: boolean): boolean {
    const b = this.body
    const sp = this.params.suspension
    let touched = false
    let nSum = v3()
    for (const q of HULL) {
      const pw = b.toWorld(q)
      const hit = raycastDown(this.world, pw.x, pw.y + sp.skin, pw.z, sp.skin + 0.3)
      if (!hit) continue
      const nrm = v3(hit.nx, hit.ny, hit.nz)
      const d = (pw.y - hit.y) * hit.ny
      if (d >= 0) continue
      touched = true
      nSum = vAdd(nSum, nrm)
      const vn = vDot(b.pointVelocity(pw), nrm)
      const maxDamp = ((this.params.mass / 4) * Math.abs(vn)) / h
      const fd = clamp(-60 * vn, -maxDamp, maxDamp)
      b.addForceAtPoint(vScale(nrm, Math.max(0, 4000 * -d + fd)), pw)
      if (-vn > this.approach && this.state === 'airborne') this.approach = -vn
    }
    if (touched && !wheelsOn) this.contactNormal = vNorm(nSum)
    return touched
  }

  /** El "pedaleo" del jinete: la velocidad se acerca sola a la de crucero sobre plano; bajando se acelera sola. */
  private rideForces() {
    const b = this.body
    const n = this.contactNormal
    const f = this.groundForward()
    const vLong = vDot(b.velocity, f)
    if (n.y > 0.985 && !this.manual) {
      // Rodando de espaldas (rebote): frena rapido y vuelve a empujar hacia adelante.
      const accel =
        vLong < -0.15
          ? -vLong * 8
          : (this.params.cruise - vLong) * (vLong > this.params.cruise ? 0.35 : 1)
      b.addForce(vScale(f, this.params.mass * accel))
    }
    const over = Math.hypot(b.velocity.x, b.velocity.z) - (MAX_SPEED + 3)
    if (over > 0)
      b.addForce(vScale(vNorm(v3(b.velocity.x, 0, b.velocity.z)), -this.params.mass * over * 8))
  }

  private manualTorque() {
    const m = this.manual!
    const p = this.params
    const target = (m.nose ? -1 : 1) * (0.3 + 0.25 * clamp(m.bal, -1, 1))
    const wl = this.body.localAngularVelocity
    this.body.addRelativeTorque(
      v3(p.inertia.x * (1200 * (this.pitchAngle - target) - 45 * wl.x), 0, 0),
    )
  }

  /** Controles en el aire: estabilizador de cabeceo, objetivos de flip/shuvit, catch y auto-leveling. */
  /**
   * Un flip gira alrededor del eje largo de la tabla y un shove-it alrededor de la vertical: son los giros
   * de un cuerpo con angulos tipo Euler (rumbo -> cabeceo -> volteo). Si la velocidad angular quedara
   * fija en el mundo, un shove-it simultaneo desarmaria el volteo y un 360 flip no volveria a quedar
   * plano. Por eso, en cada subpaso, la velocidad angular se expresa en esa base (vertical, eje del
   * cabeceo, eje largo) con la orientacion del subpaso anterior y se vuelve a armar con la actual.
   */
  private followEulerAxes() {
    const b = this.body
    const zOld = this.lastLong
    const zNew = this.boardForward
    const m0 = eulerBasis(zOld)
    const m1 = eulerBasis(zNew)
    if (m0 && m1) {
      const r = solve3(m0, b.angularVelocity)
      if (r)
        b.angularVelocity = v3(
          m1[0].x * r.x + m1[1].x * r.y + m1[2].x * r.z,
          m1[0].y * r.x + m1[1].y * r.y + m1[2].y * r.z,
          m1[0].z * r.x + m1[1].z * r.y + m1[2].z * r.z,
        )
    }
    this.lastLong = zNew
  }

  private airTorques() {
    const b = this.body
    const p = this.params
    const wl = b.localAngularVelocity
    const upY = this.boardUp.y
    // Giros acumulados medidos sobre la orientacion real (volteo alrededor del eje largo, rumbo
    // alrededor de la vertical): no dependen del orden en que se combinaron los giros.
    const roll = this.rollAngle
    const yaw = this.boardYaw
    this.rollAcc += wrapPi(roll - this.prevRoll)
    this.yawAcc += wrapPi(yaw - this.prevYaw)
    this.prevRoll = roll
    this.prevYaw = yaw
    const wyWorld = b.angularVelocity.y
    if (this.contacts === 0 && !this.hullContact) this.airSpin = Math.hypot(wyWorld, wl.z)

    // Auto-leveling (solo en Airborne): cerca del suelo la tabla alinea su Up con la normal de la
    // superficie. Cuanto mas cerca, mas manda sobre el estabilizador de horizonte.
    const level = this.state === 'airborne' && b.velocity.y < 0.5 ? this.autoLevel() : 0

    // Estabilizador de cabeceo (el jinete nivela la nariz): actua sobre el angulo de cabeceo (eje horizontal
    // perpendicular al avance), asi sigue funcionando aunque la tabla este volteada en pleno flip.
    const basis = eulerBasis(b.toWorldDirection(v3(0, 0, 1)))
    if (basis) {
      const rates = solve3(basis, b.angularVelocity)
      if (rates) {
        const tau =
          p.inertia.x * (1 - level) * (p.air.pitchKp * this.pitchAngle - p.air.pitchKd * rates.y)
        b.addTorque(vScale(basis[1], tau))
      }
    }

    if (this.catching) {
      // Catch: nivela el volteo (Z) hacia 0 o 180 grados; el angularDrag de 20 ya frena el resto.
      const target = Math.round(roll / Math.PI) * Math.PI
      b.addRelativeTorque(
        v3(0, 0, p.inertia.z * (p.catchLevel.kp * wrapPi(target - roll) - 20 * wl.z)),
      )
      this.rollTarget = 0
      this.yawTarget = 0
    } else {
      // El pie "ataja" el flip/shuvit cuando se acerca al objetivo: lo frena justo ahi.
      if (this.rollTarget !== 0) {
        const err = this.rollTarget - this.rollAcc
        if (Math.abs(err) < p.settle.rollZone)
          b.addRelativeTorque(v3(0, 0, p.inertia.z * (p.settle.kp * err - p.settle.kd * wl.z)))
      } else if (upY > 0.6 && Math.abs(wl.z) < 4) {
        b.addRelativeTorque(
          v3(0, 0, p.inertia.z * (1 - level) * (-p.air.rollKp * roll - p.air.rollKd * wl.z)),
        )
      }
      if (this.yawTarget !== 0) {
        const err = this.yawTarget - this.yawAcc
        if (Math.abs(err) < p.settle.yawZone)
          b.addTorque(v3(0, p.inertia.y * (p.settle.kp * err - p.settle.kd * wyWorld), 0))
      }
    }
  }

  /** Alinea el Up de la tabla con la normal del suelo si esta a menos de 0.4. Devuelve el peso 0..1 aplicado. */
  private autoLevel(): number {
    const b = this.body
    const al = this.params.autoLevel
    const o = b.origin
    const hit = raycastDown(this.world, o.x, o.y, o.z, al.distance)
    if (!hit) return 0
    const dist = o.y - hit.y
    if (dist >= al.distance) return 0
    const up = this.boardUp
    const n = v3(hit.nx, hit.ny, hit.nz)
    if (vDot(up, n) < al.minUp) return 0
    const w = Math.sqrt(clamp(1 - dist / al.distance, 0, 1))
    const err = vCross(up, n)
    const wv = b.angularVelocity
    const wPerp = vSub(wv, vScale(up, vDot(wv, up)))
    const inertia = 0.2
    b.addTorque(vScale(vSub(vScale(err, al.kp * w), vScale(wPerp, al.kd * w)), inertia))
    return w
  }

  // --- Colisiones ---------------------------------------------------------------------------------------------

  /** Choques de frente con paredes (cajones, escalones): saca la tabla y rebota sin caerse. */
  private resolveWalls(events: SkateEvent[]) {
    const b = this.body
    const p = this.params
    const v = b.velocity
    const probes: { local: V3; tolerance: number }[] = [
      { local: v3(0, -0.015, 0.41), tolerance: 0 },
      { local: v3(0, -0.015, -0.41), tolerance: 0 },
      { local: v3(p.wheelX, p.wheelY - 0.05, p.wheelZ), tolerance: 0.06 },
      { local: v3(-p.wheelX, p.wheelY - 0.05, p.wheelZ), tolerance: 0.06 },
      { local: v3(p.wheelX, p.wheelY - 0.05, -p.wheelZ), tolerance: 0.06 },
      { local: v3(-p.wheelX, p.wheelY - 0.05, -p.wheelZ), tolerance: 0.06 },
    ]
    for (const probe of probes) {
      const pw = b.toWorld(probe.local)
      const push = wallPush(this.world, pw.x, pw.z, pw.y, probe.tolerance, { x: v.x, z: v.z })
      if (!push) continue
      b.com = vAdd(b.com, v3(push.nx * push.depth, 0, push.nz * push.depth))
      const vn = b.velocity.x * push.nx + b.velocity.z * push.nz
      if (vn < 0) {
        b.velocity = vSub(b.velocity, v3(push.nx * vn * 1.2, 0, push.nz * vn * 1.2))
        if (-vn > 1.5 && this.bumpCooldown <= 0) {
          this.bumpCooldown = 0.2
          this.emit({ t: 'bump', speed: -vn }, events)
        }
      }
    }
  }

  private keepInside(events: SkateEvent[]) {
    const b = this.body
    const { halfX, halfZ } = this.world
    const c = b.com
    const nx = clamp(c.x, -halfX, halfX)
    const nz = clamp(c.z, -halfZ, halfZ)
    if (nx !== c.x || nz !== c.z) {
      const n = vNorm(v3(nx - c.x, 0, nz - c.z))
      b.com = v3(nx, c.y, nz)
      const vn = b.velocity.x * n.x + b.velocity.z * n.z
      if (vn < 0) b.velocity = vSub(b.velocity, v3(n.x * vn * 1.55, 0, n.z * vn * 1.55))
      if (-vn > 2 && this.bumpCooldown <= 0) {
        this.bumpCooldown = 0.2
        this.emit({ t: 'bump', speed: -vn }, events)
      }
    }
  }

  // --- Transiciones ---------------------------------------------------------------------------------------------

  private transitions(h: number, events: SkateEvent[]) {
    const state = this.state
    if (state === 'popping') {
      this.popTimer -= h
      this.popAge += h
      this.airTime += h
      this.sinceGround += h
      this.trackHeight()
      if (this.popTimer <= 0) this.machine.transition('airborne')
      return
    }
    if (state === 'airborne') {
      this.airTime += h
      this.sinceGround += h
      if (this.popped) this.popAge += h
      this.trackHeight()
      this.updateGrab(h)
      if (this.tryCatchRail(events)) return
      if ((this.contacts >= 2 || this.hullContact) && this.airTime > 0.04) this.land(events)
      return
    }
    if (state === 'grounded') {
      if (this.contacts < 1) {
        if (++this.noContact >= 3) this.leaveGround(events)
      } else this.noContact = 0
    }
  }

  private trackHeight() {
    const o = this.body.origin
    const g = heightAt(this.world, o.x, o.z)
    if (o.y - g > this.maxHeight) this.maxHeight = o.y - g
  }

  private updateGrab(h: number) {
    if (!this.grab) return
    this.grab.t += h
    const o = this.body.origin
    const g = heightAt(this.world, o.x, o.z)
    // El agarre se suelta solo un instante antes de caer.
    if (this.body.velocity.y < 0 && o.y - g < 0.45) this.grab = null
  }

  private leaveGround(events: SkateEvent[]) {
    this.endManual(events)
    if (!this.machine.transition('airborne')) return
    this.clearAirCounters()
    this.popped = false
    this.nollie = false
    this.sinceGround = 0
  }

  private land(events: SkateEvent[]) {
    const p = this.params
    const b = this.body
    const n = this.contactNormal
    const up = this.boardUp
    const upDot = vDot(up, n)
    const vh = v3(b.velocity.x, 0, b.velocity.z)
    const sp = vLen(vh)
    const fwd = this.boardForward
    const fh = vNorm(v3(fwd.x, 0, fwd.z))
    const align = sp > 1.5 ? Math.abs(vDot(fh, vScale(vh, 1 / sp))) : 1
    // Giro residual de flip/shuvit justo antes de tocar (el golpe del propio aterrizaje no cuenta).
    const wlen = this.airSpin
    const spinRem = Math.abs(this.spinTarget - this.spin)
    const o = b.origin
    const impact = this.approach
    const hard = impact > 9
    this.lastLanding = { upDot, align, spin: wlen, spinRem, impact }

    const rollRem = Math.abs(this.rollTarget - this.rollAcc)
    const yawRem = Math.abs(this.yawTarget - this.yawAcc)
    if (
      upDot < p.land.sloppyUp ||
      align < p.land.sloppyAlign ||
      spinRem > LAND_TOLERANCE ||
      rollRem > 1 ||
      yawRem > 1.1
    ) {
      this.bail('trick', events)
      return
    }
    const clean =
      upDot >= p.land.cleanUp &&
      align >= p.land.cleanAlign &&
      spinRem <= 0.35 &&
      wlen < 6 &&
      rollRem < 0.6 &&
      yawRem < 0.7
    const quality: LandQuality = clean ? 'clean' : 'sloppy'
    const meaningful = this.airTime > 0.14
    const trick: LandedTrick | null = meaningful
      ? {
          roll: Math.round(this.rollAcc / TAU),
          yaw: Math.round(this.yawAcc / Math.PI),
          spin: Math.round(this.spinTarget / Math.PI),
          nollie: this.nollie,
          grab: this.grabbed,
          popped: this.popped,
          airTime: this.airTime,
          height: this.maxHeight,
          quality,
        }
      : null
    this.machine.transition('grounded')
    if (!clean) b.velocity = v3(b.velocity.x * 0.8, b.velocity.y, b.velocity.z * 0.8)
    else if (hard) b.velocity = v3(b.velocity.x * 0.92, b.velocity.y, b.velocity.z * 0.92)
    this.emit(
      {
        t: 'land',
        trick,
        hard,
        quality,
        impact,
        x: o.x,
        y: heightAt(this.world, o.x, o.z),
        z: o.z,
      },
      events,
    )
    const buffered = this.buffered
    this.clearAir()
    this.grab = null
    if (buffered && buffered.age < 0.14) {
      for (const e of this.applyGesture(buffered.g)) events.push(e)
    }
  }

  private bail(reason: 'trick' | 'grind' | 'manual', events: SkateEvent[]) {
    if (!this.machine.transition('bailed')) return
    this.bailT = this.params.bailTime
    this.manual = null
    this.grab = null
    this.grind = null
    this.pending = null
    this.buffered = null
    this.catching = false
    this.body.velocity = vScale(this.body.velocity, 0.5)
    this.emit({ t: 'bail', reason }, events)
  }

  /** Despues de los subpasos: manual, caida amable y recuperacion. */
  private afterStep(dt: number, events: SkateEvent[]) {
    const state = this.state
    if (this.spinTarget !== 0 || this.spin !== 0) {
      if (state === 'airborne' || state === 'popping')
        this.spin = easeToward(this.spin, this.spinTarget, 9, dt)
      else if (state === 'grounded') this.spin = easeToward(this.spin, 0, 10, dt)
    }
    if (state === 'grounded' && this.manual) this.stepManual(dt, events)
    if (state === 'bailed') {
      this.bailT -= dt
      if (this.bailT <= 0) this.recover()
    }
  }

  private stepManual(dt: number, events: SkateEvent[]) {
    const m = this.manual!
    m.t += dt
    const drift = 0.9 * m.bal + 0.32 * wobbleAt(this.time, this.wobbleSeed)
    m.bal += (drift - 2.8 * this.balance) * dt
    if (this.horizontalSpeed < 1.2) {
      this.endManual(events)
    } else if (Math.abs(m.bal) > 1) {
      this.endManual(events)
      this.bail('manual', events)
    }
  }

  /** Despues de la caida: de pie otra vez, apoyado en el suelo y rodando suave. */
  private recover() {
    const b = this.body
    const o = b.origin
    const yaw = this.riderYaw
    const fwd = v3(Math.sin(yaw), 0, Math.cos(yaw))
    const n = groundNormal(this.world, o.x, o.z)
    const h = heightAt(this.world, o.x, o.z)
    b.setPose(v3(o.x, h + BOARD_Y, o.z), qLookUp(fwd, n))
    b.angularVelocity = v3()
    b.velocity = vScale(fwd, CRUISE_SPEED * 0.6)
    this.machine.transition('grounded')
    this.clearAir()
    this.contacts = 4
    this.contactNormal = n
  }

  // --- Rieles ---------------------------------------------------------------------------------------------------------

  private tryCatchRail(events: SkateEvent[]): boolean {
    const b = this.body
    const v = b.velocity
    const sp = Math.hypot(v.x, v.z)
    if (v.y > 3.2 || sp < 1.5) return false
    const up = this.boardUp
    if (up.y < 0.3) return false
    const o = b.origin
    const under = vSub(o, vScale(up, 0.04))
    const hx = v.x / sp
    const hz = v.z / sp
    const rails = this.world.rails
    for (let i = 0; i < rails.length; i++) {
      const r = rails[i]!
      const c = closestOnRail(r, under.x, under.z)
      // Ni al borde mismo del riel (los primeros y ultimos 25 cm no enganchan).
      if (c.t * c.length < 0.25 || (1 - c.t) * c.length < 0.25) continue
      if (c.lateral > (r.ledge ? 0.5 : 0.42)) continue
      const dy = under.y - c.y
      if (dy < -0.15 || dy > 0.5) continue
      const alignment = hx * c.ux + hz * c.uz
      if (Math.abs(alignment) < 0.55) continue // hay que ir en la direccion del riel (en cualquier sentido)
      const sign: 1 | -1 = alignment >= 0 ? 1 : -1
      // Tabla en paralelo = 50-50 (los trucks); de costado = boardslide.
      const f = this.boardForward
      const par = Math.abs(f.x * c.ux + f.z * c.uz) / Math.max(1e-6, Math.hypot(f.x, f.z))
      const kind: GrindKind = par >= 0.6 ? '50-50' : 'boardslide'
      // La desalineacion con el riel arranca con el equilibrio torcido: alinearse importa.
      const mis = kind === '50-50' ? 1 - par : par
      const bal = clamp(0.5 * mis, 0, 0.45) * (wobbleAt(this.time, this.wobbleSeed) > 0 ? 1 : -1)
      this.grind = { rail: i, t: c.t, sign, kind, bal, time: 0 }
      this.machine.transition('grinding')
      this.grab = null
      this.manual = null
      this.catching = false
      b.velocity = v3(
        c.ux * sign * Math.max(2, sp * Math.abs(alignment)),
        0,
        c.uz * sign * Math.max(2, sp * Math.abs(alignment)),
      )
      b.angularVelocity = v3()
      this.emit({ t: 'grindStart', kind, x: c.x, y: c.y, z: c.z }, events)
      return true
    }
    return false
  }

  private stepGrind(dt: number, events: SkateEvent[]) {
    const g = this.grind!
    const r = this.world.rails[g.rail]!
    const b = this.body
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az)
    g.time += dt
    // La velocidad horizontal del riel se conserva en el cuerpo (lo que dibuja la camara y la juice).
    let speed = Math.max(0, Math.hypot(b.velocity.x, b.velocity.z) * (1 - 0.1 * dt))
    const slopeY = (r.by - r.ay) / len
    // Sobre un riel en bajada se gana un poco de velocidad.
    speed = clamp(speed - slopeY * g.sign * 1.2 * dt, 0, MAX_SPEED)
    g.t += (g.sign * speed * dt) / len
    const t = clamp(g.t, 0, 1)
    const px = r.ax + (r.bx - r.ax) * t
    const pz = r.az + (r.bz - r.az) * t
    const py = r.ay + (r.by - r.ay) * t
    const ux = ((r.bx - r.ax) / len) * g.sign
    const uz = ((r.bz - r.az) / len) * g.sign
    b.velocity = v3(ux * speed, slopeY * g.sign * speed, uz * speed)
    b.angularVelocity = v3()

    // Pose cinematica: la tabla se alinea con el riel (50-50) o se cruza (boardslide), con inclinacion por el equilibrio.
    const yaw = Math.atan2(ux, uz) + (g.kind === 'boardslide' ? Math.PI / 2 : 0)
    const upTilt = vNorm(v3(-uz * g.bal * 0.35, 1, ux * g.bal * 0.35))
    const target = qLookUp(v3(Math.sin(yaw), 0, Math.cos(yaw)), upTilt)
    b.moveTo(v3(px, py + RAIL_OFFSET, pz), qSlerp(b.rotation, target, clamp(dt * 16, 0, 1)))

    // Equilibrio.
    g.bal += (0.7 * g.bal + 0.3 * wobbleAt(g.time, this.wobbleSeed) + 2.4 * this.steer) * dt
    this.emit({ t: 'grindStay', kind: g.kind, speed, x: px, y: py, z: pz }, events)
    if (Math.abs(g.bal) > 1) {
      this.emit({ t: 'grindEnd', seconds: g.time, kind: g.kind }, events)
      this.grind = null
      this.machine.transition('airborne')
      this.clearAirCounters()
      this.bail('grind', events)
      return
    }
    if (g.t <= 0 || g.t >= 1 || speed < 1.2) {
      // Salida del riel: sigue con la velocidad que traia, en el aire.
      this.emit({ t: 'grindEnd', seconds: g.time, kind: g.kind }, events)
      this.grind = null
      this.machine.transition('airborne')
      this.clearAirCounters()
      this.popped = false
      this.sinceGround = 0.05
      b.velocity = v3(ux * speed, g.sign * slopeY * speed * 0.6, uz * speed)
    }
  }

  // --- Jinete ------------------------------------------------------------------------------------------------------------

  /** El jinete mira hacia donde va: sigue la tabla (modulo 180 grados) en el suelo y se queda quieto en el aire. */
  private updateRider(dt: number) {
    const state = this.state
    this.rideUp = vNorm(
      vAdd(
        vScale(this.rideUp, 1 - clamp(dt * 12, 0, 1)),
        vScale(this.contacts > 0 && !this.airborne ? this.contactNormal : UP, clamp(dt * 12, 0, 1)),
      ),
    )
    if (state === 'grounded' || state === 'grinding') {
      const v = this.body.velocity
      const sp = Math.hypot(v.x, v.z)
      let ref = this.riderYaw
      if (sp > 1) ref = Math.atan2(v.x, v.z)
      const yb = state === 'grinding' && this.grind ? Math.atan2(v.x, v.z) : this.boardYaw
      const cands = [yb, yb + Math.PI]
      const best =
        Math.abs(wrapPi(cands[0]! - ref)) <= Math.abs(wrapPi(cands[1]! - ref))
          ? cands[0]!
          : cands[1]!
      if (state === 'grinding') this.riderYaw = best
      else this.riderYaw += wrapPi(best - this.riderYaw) * clamp(dt * 10, 0, 1)
    }
  }

  /** Giro del cuerpo hacia la izquierda en radianes (para la mascota) = riderYaw + spin. */
  get riderFacing(): number {
    return this.riderYaw + this.spin
  }

  /** Atajo de pruebas: aplica un yaw y una pose plana sobre el suelo. */
  placeFlat(x: number, z: number, yaw: number, speed = 0) {
    const h = heightAt(this.world, x, z)
    const fwd = v3(Math.sin(yaw), 0, Math.cos(yaw))
    this.body.setPose(v3(x, h + BOARD_Y, z), qLookUp(fwd, groundNormal(this.world, x, z)))
    this.body.velocity = vScale(fwd, speed)
    this.body.angularVelocity = v3()
    this.riderYaw = yaw
    this.machine.reset('grounded')
    this.clearAir()
    this.contacts = 4
  }
}
