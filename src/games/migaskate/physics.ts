// Fisica de "Miga Skate". TypeScript puro, sin three.js: el mundo es un mapa de alturas (rampas, cajones,
// escaleras, cuartos de pipa) mas rieles. El skater rueda, se despega de los labios de las rampas con la
// velocidad que traia (trayectoria balistica), y los giros de la tabla y del cuerpo dependen de la fuerza
// y la direccion con que se toco la pantalla (ver gestures.ts). Cada truco se juzga al aterrizar.

import type { Gesture, GrabName } from './gestures.ts'

export const GRAVITY = 17
export const STEP = 1 / 120
export const MAX_SPEED = 10
export const CRUISE_SPEED = 3.2

const TAU = Math.PI * 2
const STEP_UP = 0.14
/** Cuanto puede faltar para completar un giro y aun asi aterrizar limpio (radianes). */
export const LAND_TOLERANCE = 0.9
const ROLL_RATE = 18
const YAW_RATE = 11
const SPIN_RATE = 9

export type Dir = 'px' | 'nx' | 'pz' | 'nz'

export interface Surface {
  type: 'box' | 'ramp' | 'quarter' | 'stairs'
  /** Centro y tamano (w a lo largo de x, d a lo largo de z). */
  x: number
  z: number
  w: number
  d: number
  height: number
  /** Hacia donde sube (rampas, cuartos y escaleras). */
  dir: Dir
  steps?: number
}

export interface Rail {
  ax: number
  az: number
  ay: number
  bx: number
  bz: number
  by: number
  /** Cornisa: se dibuja como un bloque y no como un cano. */
  ledge?: boolean
}

export interface WorldDef {
  halfX: number
  halfZ: number
  surfaces: Surface[]
  rails: Rail[]
  start: { x: number; z: number; heading: number }
}

// --- Mapa de alturas ---------------------------------------------------------------------------

const QUARTER_ALPHA = (65 * Math.PI) / 180

export const quarterRadius = (height: number) => height / (1 - Math.cos(QUARTER_ALPHA))
/** Largo horizontal de la curva de un cuarto de pipa de esa altura. */
export const quarterRun = (height: number) => quarterRadius(height) * Math.sin(QUARTER_ALPHA)

export function surfaceLength(s: Surface): number {
  return s.dir === 'px' || s.dir === 'nx' ? s.w : s.d
}

/** Altura de la superficie a una distancia `along` desde su borde bajo. */
export function profileHeight(s: Surface, along: number): number {
  const len = surfaceLength(s)
  const a = Math.max(0, Math.min(len, along))
  switch (s.type) {
    case 'box':
      return s.height
    case 'ramp':
      return (s.height * a) / len
    case 'quarter': {
      const run = quarterRun(s.height)
      if (a >= run) return s.height
      const r = quarterRadius(s.height)
      return r * (1 - Math.cos(Math.asin(a / r)))
    }
    case 'stairs': {
      const n = s.steps ?? 6
      const k = Math.min(n, Math.floor((a / len) * n) + 1)
      return (s.height * k) / n
    }
  }
}

function along(s: Surface, x: number, z: number): number | null {
  const hx = s.w / 2
  const hz = s.d / 2
  if (Math.abs(x - s.x) > hx || Math.abs(z - s.z) > hz) return null
  switch (s.dir) {
    case 'px':
      return x - (s.x - hx)
    case 'nx':
      return s.x + hx - x
    case 'pz':
      return z - (s.z - hz)
    case 'nz':
      return s.z + hz - z
  }
}

export function heightAt(world: WorldDef, x: number, z: number): number {
  let h = 0
  for (const s of world.surfaces) {
    const a = along(s, x, z)
    if (a === null) continue
    const v = profileHeight(s, a)
    if (v > h) h = v
  }
  return h
}

/** Pendiente del suelo en la direccion (dx, dz). */
function slopeAlong(world: WorldDef, x: number, z: number, dx: number, dz: number): number {
  const e = 0.12
  return (
    (heightAt(world, x + dx * e, z + dz * e) - heightAt(world, x - dx * e, z - dz * e)) / (2 * e)
  )
}

// --- Estado del skater --------------------------------------------------------------------------

export type Mode = 'ground' | 'air' | 'grind' | 'bail'
export type GrindKind = '50-50' | 'boardslide'

export interface Skater {
  x: number
  y: number
  z: number
  /** 0 = hacia +z. Aumentar el rumbo gira a la izquierda. */
  heading: number
  /** Velocidad horizontal con signo a lo largo del rumbo (negativa = rueda de espaldas). */
  speed: number
  vy: number
  /** Velocidad vertical del suelo en el cuadro anterior (para despegar del labio de una rampa). */
  gvy: number
  mode: Mode
  time: number
  /** Segundos desde que dejo el suelo (para el salto tolerante). */
  coyote: number
  airTime: number
  maxHeight: number
  /** Giros actuales y objetivos: roll = flip de la tabla, yaw = shove-it, spin = giro del cuerpo. */
  roll: number
  rollTarget: number
  yaw: number
  yawTarget: number
  spin: number
  spinTarget: number
  nollie: boolean
  /** Esta tirada empezo con un salto (ollie) y no solo con una rampa. */
  popped: boolean
  popAge: number
  pendingFlip: { kind: 'flip' | 'shuvit'; dir: 1 | -1; power: number; age: number } | null
  buffered: { g: Gesture; age: number } | null
  grab: { name: GrabName; t: number } | null
  /** Agarre que se hizo en esta tirada (queda para nombrar el truco al aterrizar). */
  grabbed: GrabName | null
  manual: { nose: boolean; bal: number; t: number } | null
  grind: {
    rail: number
    t: number
    sign: 1 | -1
    kind: GrindKind
    bal: number
    time: number
    turn: number
  } | null
  bailT: number
  /** Parpadeo del equilibrio (semilla simple, deterministica). */
  wobble: number
}

export interface SimInput {
  steer: number
  balance: number
}

export interface LandedTrick {
  roll: number
  yaw: number
  spin: number
  nollie: boolean
  grab: GrabName | null
  popped: boolean
  airTime: number
  height: number
}

export type SimEvent =
  | { t: 'pop'; nollie: boolean; power: number }
  | { t: 'land'; trick: LandedTrick | null; hard: boolean }
  | { t: 'bail'; reason: 'trick' | 'grind' | 'manual' }
  | { t: 'grindStart'; kind: GrindKind }
  | { t: 'grindEnd'; seconds: number; kind: GrindKind }
  | { t: 'manualStart' }
  | { t: 'manualEnd'; seconds: number; nose: boolean }
  | { t: 'grabStart'; name: GrabName }
  | { t: 'bump'; speed: number }
  | { t: 'push' }
  | { t: 'flip' }

export function createSkater(world: WorldDef): Skater {
  const { x, z, heading } = world.start
  return {
    x,
    y: heightAt(world, x, z),
    z,
    heading,
    speed: CRUISE_SPEED,
    vy: 0,
    gvy: 0,
    mode: 'ground',
    time: 0,
    coyote: 0,
    airTime: 0,
    maxHeight: 0,
    roll: 0,
    rollTarget: 0,
    yaw: 0,
    yawTarget: 0,
    spin: 0,
    spinTarget: 0,
    nollie: false,
    popped: false,
    popAge: 0,
    pendingFlip: null,
    buffered: null,
    grab: null,
    grabbed: null,
    manual: null,
    grind: null,
    bailT: 0,
    wobble: 0.37,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Puede arrancar un salto: en el suelo, un instante despues de salir de un labio, o saliendo de un riel. */
function canPop(sk: Skater): boolean {
  if (sk.mode === 'ground' || sk.mode === 'grind') return true
  return sk.mode === 'air' && !sk.popped && sk.coyote < 0.1
}

function pop(sk: Skater, power: number, nollie: boolean, events: SimEvent[]) {
  const fromGrind = sk.mode === 'grind'
  if (sk.manual) {
    events.push({ t: 'manualEnd', seconds: sk.manual.t, nose: sk.manual.nose })
    sk.manual = null
  }
  if (fromGrind && sk.grind) {
    events.push({ t: 'grindEnd', seconds: sk.grind.time, kind: sk.grind.kind })
    sk.grind = null
  }
  sk.vy = 3.8 + 2.6 * clamp(power, 0, 1)
  sk.gvy = 0
  sk.mode = 'air'
  sk.coyote = 1
  sk.popped = true
  sk.popAge = 0
  sk.nollie = nollie
  sk.airTime = 0
  sk.maxHeight = 0
  events.push({ t: 'pop', nollie, power })
  const pending = sk.pendingFlip
  sk.pendingFlip = null
  if (pending && pending.age < 0.35)
    addRotation(sk, pending.kind, pending.dir, pending.power, events)
}

function addRotation(
  sk: Skater,
  kind: 'flip' | 'shuvit',
  dir: 1 | -1,
  power: number,
  events: SimEvent[],
) {
  if (kind === 'flip') {
    if (sk.rollTarget !== 0) return
    sk.rollTarget = dir * TAU * (power > 0.8 ? 2 : 1)
    events.push({ t: 'flip' })
  } else {
    if (sk.yawTarget !== 0) return
    sk.yawTarget = dir * Math.PI * (power > 0.85 ? 2 : 1)
    events.push({ t: 'flip' })
  }
}

/** Aplica un gesto del dedo. Devuelve eventos de sonido/animacion. */
export function applyGesture(sk: Skater, g: Gesture): SimEvent[] {
  const events: SimEvent[] = []
  if (sk.mode === 'bail') return events

  switch (g.k) {
    case 'ollie':
    case 'popShuvit': {
      if (canPop(sk)) {
        pop(sk, g.k === 'popShuvit' ? Math.max(0.35, g.power * 0.85) : g.power, g.nollie, events)
        if (g.k === 'popShuvit') addRotation(sk, 'shuvit', g.dir, 0.2, events)
      } else if (sk.mode === 'air' && sk.vy < 0) {
        // Un salto pedido justo antes de aterrizar se guarda un instante.
        sk.buffered = { g, age: 0 }
      }
      break
    }
    case 'flip':
    case 'shuvit': {
      if (sk.mode === 'air' || sk.mode === 'grind') {
        if (sk.mode === 'air') addRotation(sk, g.k, g.dir, g.power, events)
      } else {
        sk.pendingFlip = { kind: g.k, dir: g.dir, power: g.power, age: 0 }
      }
      break
    }
    case 'spin': {
      if (sk.mode === 'air' && sk.spinTarget === 0) {
        sk.spinTarget = g.dir * Math.PI * (g.power > 0.8 ? 2 : 1)
        events.push({ t: 'flip' })
      } else if (sk.mode === 'grind' && sk.grind) {
        // Un latigazo sobre el riel gira la tabla a boardslide (y otro la vuelve a 50-50).
        sk.grind.kind = sk.grind.kind === '50-50' ? 'boardslide' : '50-50'
        events.push({ t: 'grindStart', kind: sk.grind.kind })
      }
      break
    }
    case 'push': {
      if (sk.mode === 'ground') {
        sk.speed = Math.min(MAX_SPEED, Math.max(sk.speed, 0) + 1.3 + 2.4 * g.power)
        events.push({ t: 'push' })
      }
      break
    }
    case 'grab': {
      if (sk.mode === 'air' && !sk.grab) {
        sk.grab = { name: g.name, t: 0 }
        sk.grabbed = g.name
        events.push({ t: 'grabStart', name: g.name })
      }
      break
    }
    case 'grabEnd':
      sk.grab = null
      break
    case 'manual': {
      if (sk.mode === 'ground' && sk.speed > 1.5 && !sk.manual) {
        sk.manual = { nose: g.nose, bal: 0.15 * (sk.wobble > 0.5 ? 1 : -1), t: 0 }
        events.push({ t: 'manualStart' })
      }
      break
    }
    case 'manualEnd':
      if (sk.manual) {
        events.push({ t: 'manualEnd', seconds: sk.manual.t, nose: sk.manual.nose })
        sk.manual = null
      }
      break
  }
  return events
}

// --- Paso de simulacion --------------------------------------------------------------------------

const wobbleAt = (t: number, seed: number) =>
  0.5 * Math.sin(t * 2.3 + seed * 7) + 0.35 * Math.sin(t * 5.1 + seed * 3) + 0.2 * Math.sin(t * 9.7)

function easeToward(value: number, target: number, rate: number, dt: number): number {
  const d = target - value
  const s = rate * dt
  return Math.abs(d) <= s ? target : value + Math.sign(d) * s
}

function bail(sk: Skater, reason: 'trick' | 'grind' | 'manual', events: SimEvent[]) {
  sk.mode = 'bail'
  sk.bailT = 1.15
  sk.speed *= 0.5
  sk.manual = null
  sk.grab = null
  sk.grind = null
  sk.pendingFlip = null
  sk.buffered = null
  events.push({ t: 'bail', reason })
}

function tryCatchRail(world: WorldDef, sk: Skater, events: SimEvent[]): boolean {
  if (sk.vy > 3.2 || Math.abs(sk.speed) < 1.5) return false
  const hx = Math.sin(sk.heading)
  const hz = Math.cos(sk.heading)
  for (let i = 0; i < world.rails.length; i++) {
    const r = world.rails[i]!
    const dx = r.bx - r.ax
    const dz = r.bz - r.az
    const len = Math.hypot(dx, dz)
    const ux = dx / len
    const uz = dz / len
    const relx = sk.x - r.ax
    const relz = sk.z - r.az
    const t = (relx * ux + relz * uz) / len
    if (t < 0.02 || t > 0.98) continue
    const lat = Math.abs(relx * uz - relz * ux)
    if (lat > (r.ledge ? 0.5 : 0.42)) continue
    const ry = r.ay + (r.by - r.ay) * t
    const dy = sk.y - ry
    if (dy < -0.15 || dy > 0.5) continue
    const alignment = hx * ux + hz * uz
    // Hay que ir en la direccion del riel (en cualquiera de los dos sentidos).
    if (Math.abs(alignment) < 0.55) continue
    const sign: 1 | -1 = alignment * (sk.speed >= 0 ? 1 : -1) >= 0 ? 1 : -1
    sk.mode = 'grind'
    sk.grind = { rail: i, t, sign, kind: '50-50', bal: 0, time: 0, turn: 0 }
    sk.speed = Math.max(2, Math.abs(sk.speed) * Math.abs(alignment))
    sk.heading = Math.atan2(ux * sign, uz * sign)
    sk.y = ry
    sk.vy = 0
    sk.grab = null
    events.push({ t: 'grindStart', kind: '50-50' })
    return true
  }
  return false
}

/** Aterrizaje: juzga el truco. Devuelve false si fue una caida (el skater queda en 'bail'). */
function land(sk: Skater, hn: number, events: SimEvent[]) {
  const hard = sk.vy < -9
  const rollRem = Math.abs(sk.rollTarget - sk.roll)
  const yawRem = Math.abs(sk.yawTarget - sk.yaw)
  const spinRem = Math.abs(sk.spinTarget - sk.spin)
  sk.y = hn
  sk.vy = 0
  sk.gvy = 0
  if (rollRem > LAND_TOLERANCE || yawRem > LAND_TOLERANCE || spinRem > LAND_TOLERANCE) {
    bail(sk, 'trick', events)
    return
  }
  const meaningful = sk.airTime > 0.14
  const trick: LandedTrick | null = meaningful
    ? {
        roll: Math.round(sk.rollTarget / TAU),
        yaw: Math.round(sk.yawTarget / Math.PI),
        spin: Math.round(sk.spinTarget / Math.PI),
        nollie: sk.nollie,
        grab: sk.grabbed,
        popped: sk.popped,
        airTime: sk.airTime,
        height: sk.maxHeight,
      }
    : null
  // Lo que queda de giro se va suavizando solo hasta dejar la tabla plana.
  sk.roll -= sk.rollTarget
  sk.yaw -= sk.yawTarget
  sk.spin -= sk.spinTarget
  sk.rollTarget = 0
  sk.yawTarget = 0
  sk.spinTarget = 0
  sk.grab = null
  sk.grabbed = null
  sk.popped = false
  sk.nollie = false
  sk.mode = 'ground'
  if (hard) sk.speed *= 0.92
  events.push({ t: 'land', trick, hard })
  const buffered = sk.buffered
  sk.buffered = null
  if (buffered && buffered.age < 0.14) events.push(...applyGesture(sk, buffered.g))
}

function leaveGround(sk: Skater, vy: number) {
  sk.mode = 'air'
  sk.vy = vy
  sk.coyote = 0
  sk.airTime = 0
  sk.maxHeight = 0
  sk.popped = false
  sk.grabbed = null
}

export function stepSkater(world: WorldDef, sk: Skater, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = []
  sk.time += dt
  if (sk.pendingFlip) {
    sk.pendingFlip.age += dt
    if (sk.pendingFlip.age > 0.4) sk.pendingFlip = null
  }
  if (sk.buffered) {
    sk.buffered.age += dt
    if (sk.buffered.age > 0.2) sk.buffered = null
  }

  switch (sk.mode) {
    case 'bail': {
      sk.bailT -= dt
      sk.speed *= Math.pow(0.15, dt)
      moveFlat(world, sk, dt, events)
      sk.y = Math.max(heightAt(world, sk.x, sk.z), sk.y - 6 * dt)
      if (sk.bailT <= 0) {
        sk.mode = 'ground'
        sk.speed = CRUISE_SPEED * 0.6
        sk.roll = sk.yaw = sk.spin = 0
        sk.rollTarget = sk.yawTarget = sk.spinTarget = 0
        sk.y = heightAt(world, sk.x, sk.z)
      }
      return events
    }
    case 'grind':
      stepGrind(world, sk, input, dt, events)
      return events
    case 'ground':
      stepGround(world, sk, input, dt, events)
      break
    case 'air':
      stepAir(world, sk, input, dt, events)
      break
  }

  // Los giros se acercan a su objetivo (en el aire) o se aplanan (en el suelo).
  if (sk.mode === 'air') {
    sk.roll = easeToward(sk.roll, sk.rollTarget, ROLL_RATE, dt)
    sk.yaw = easeToward(sk.yaw, sk.yawTarget, YAW_RATE, dt)
    sk.spin = easeToward(sk.spin, sk.spinTarget, SPIN_RATE, dt)
  } else if (sk.mode === 'ground') {
    sk.roll = easeToward(sk.roll, 0, 14, dt)
    sk.yaw = easeToward(sk.yaw, 0, 14, dt)
    sk.spin = easeToward(sk.spin, 0, 10, dt)
  }
  return events
}

/** Mueve en plano sin mirar alturas (para la caida). Respeta los limites del mapa. */
function moveFlat(world: WorldDef, sk: Skater, dt: number, events: SimEvent[]) {
  const nx = sk.x + Math.sin(sk.heading) * sk.speed * dt
  const nz = sk.z + Math.cos(sk.heading) * sk.speed * dt
  if (heightAt(world, nx, nz) - sk.y <= STEP_UP) {
    sk.x = nx
    sk.z = nz
  }
  keepInside(world, sk, events)
}

function keepInside(world: WorldDef, sk: Skater, events: SimEvent[]) {
  let hit = false
  if (Math.abs(sk.x) > world.halfX) {
    sk.x = clamp(sk.x, -world.halfX, world.halfX)
    hit = true
  }
  if (Math.abs(sk.z) > world.halfZ) {
    sk.z = clamp(sk.z, -world.halfZ, world.halfZ)
    hit = true
  }
  if (hit) {
    if (Math.abs(sk.speed) > 2) events.push({ t: 'bump', speed: Math.abs(sk.speed) })
    // Se da vuelta hacia adentro en vez de frenarse de golpe.
    sk.heading += Math.PI * 0.5
    sk.speed *= 0.55
  }
}

function stepGround(world: WorldDef, sk: Skater, input: SimInput, dt: number, events: SimEvent[]) {
  const fast = clamp((Math.abs(sk.speed) + 1) / 4, 0.3, 1)
  const turnRate = sk.manual ? 0.7 : 1.9
  sk.heading -= input.steer * turnRate * fast * dt * (sk.speed < 0 ? -1 : 1)

  const dx = Math.sin(sk.heading)
  const dz = Math.cos(sk.heading)
  const slope = slopeAlong(world, sk.x, sk.z, dx, dz)
  // La gravedad acelera cuesta abajo y frena cuesta arriba.
  sk.speed += ((-GRAVITY * slope) / (1 + slope * slope)) * dt
  if (Math.abs(slope) < 0.06 && !sk.manual) {
    // Sobre plano, la velocidad se acerca sola a la de crucero (el patinaje es relajado).
    const target = sk.speed < 0 ? 0 : CRUISE_SPEED
    sk.speed += (target - sk.speed) * (sk.speed > target ? 0.35 : 0.6) * dt
  } else {
    sk.speed *= 1 - 0.06 * dt
  }
  if (sk.manual) sk.speed *= 1 - 0.18 * dt
  sk.speed = clamp(sk.speed, -4, MAX_SPEED + 3)

  const nx = sk.x + dx * sk.speed * dt
  const nz = sk.z + dz * sk.speed * dt
  const hn = heightAt(world, nx, nz)

  // Una rampa empinada sube mas por cuadro cuanto mas rapido vas; un escalon o una pared no se sube rodando.
  if (hn - sk.y > STEP_UP + Math.min(Math.abs(sk.speed), 6.5) * dt * 2.6) {
    // Choque de frente con un escalon o una pared: rebota sin caerse.
    if (Math.abs(sk.speed) > 1.5) events.push({ t: 'bump', speed: Math.abs(sk.speed) })
    sk.speed = -sk.speed * 0.25
    if (sk.manual) {
      events.push({ t: 'manualEnd', seconds: sk.manual.t, nose: sk.manual.nose })
      sk.manual = null
    }
  } else {
    // Trayectoria balistica: si el suelo se aleja mas rapido de lo que cae el skater, despega.
    const ballistic = sk.y + sk.gvy * dt - 0.5 * GRAVITY * dt * dt
    sk.x = nx
    sk.z = nz
    if (ballistic > hn + 0.02) {
      sk.y = ballistic
      leaveGround(sk, sk.gvy - GRAVITY * dt)
      if (sk.manual) {
        events.push({ t: 'manualEnd', seconds: sk.manual.t, nose: sk.manual.nose })
        sk.manual = null
      }
    } else {
      const vyNow = (hn - sk.y) / dt
      sk.gvy = sk.gvy * 0.5 + vyNow * 0.5
      sk.y = hn
    }
  }
  keepInside(world, sk, events)

  if (sk.manual) stepManual(sk, input, dt, events)
}

function stepManual(sk: Skater, input: SimInput, dt: number, events: SimEvent[]) {
  const m = sk.manual!
  m.t += dt
  const drift = 0.9 * m.bal + 0.32 * wobbleAt(sk.time, sk.wobble)
  m.bal += (drift - 2.8 * input.balance) * dt
  if (Math.abs(sk.speed) < 1.2) {
    events.push({ t: 'manualEnd', seconds: m.t, nose: m.nose })
    sk.manual = null
  } else if (Math.abs(m.bal) > 1) {
    events.push({ t: 'manualEnd', seconds: m.t, nose: m.nose })
    sk.manual = null
    bail(sk, 'manual', events)
  }
}

function stepAir(world: WorldDef, sk: Skater, input: SimInput, dt: number, events: SimEvent[]) {
  sk.coyote += dt
  sk.airTime += dt
  if (sk.popped) sk.popAge += dt
  sk.heading -= input.steer * 0.35 * dt
  sk.vy -= GRAVITY * dt
  const prevY = sk.y
  sk.y += sk.vy * dt
  const dx = Math.sin(sk.heading)
  const dz = Math.cos(sk.heading)
  sk.speed *= 1 - 0.03 * dt
  const nx = sk.x + dx * sk.speed * dt
  const nz = sk.z + dz * sk.speed * dt
  const hn = heightAt(world, nx, nz)
  if (hn > prevY + 0.3) {
    // Pegaste de costado contra un obstaculo mas alto que tus pies: rebota.
    events.push({ t: 'bump', speed: Math.abs(sk.speed) })
    sk.speed = -sk.speed * 0.25
  } else {
    sk.x = nx
    sk.z = nz
  }
  keepInside(world, sk, events)
  const ground = heightAt(world, sk.x, sk.z)
  if (sk.y - ground > sk.maxHeight) sk.maxHeight = sk.y - ground

  // El agarre se suelta solo un instante antes de caer.
  if (sk.grab) {
    sk.grab.t += dt
    if (sk.vy < 0 && sk.y - ground < 0.45) sk.grab = null
  }

  if (sk.vy <= 0 && tryCatchRail(world, sk, events)) return
  if (sk.vy <= 0 && sk.y <= ground) land(sk, ground, events)
}

function stepGrind(world: WorldDef, sk: Skater, input: SimInput, dt: number, events: SimEvent[]) {
  const g = sk.grind!
  const r = world.rails[g.rail]!
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az)
  g.time += dt
  sk.speed = Math.max(0, sk.speed * (1 - 0.1 * dt))
  const slopeY = (r.by - r.ay) / len
  // Sobre un riel en bajada se gana un poco de velocidad.
  sk.speed = clamp(sk.speed - slopeY * g.sign * 1.2 * dt, 0, MAX_SPEED)
  g.t += (g.sign * sk.speed * dt) / len
  const t = clamp(g.t, 0, 1)
  sk.x = r.ax + (r.bx - r.ax) * t
  sk.z = r.az + (r.bz - r.az) * t
  sk.y = r.ay + (r.by - r.ay) * t

  g.bal += (0.7 * g.bal + 0.3 * wobbleAt(g.time, sk.wobble) + 2.4 * input.steer) * dt
  if (Math.abs(g.bal) > 1) {
    events.push({ t: 'grindEnd', seconds: g.time, kind: g.kind })
    sk.grind = null
    sk.vy = 0
    sk.mode = 'air'
    bail(sk, 'grind', events)
    return
  }
  if (g.t <= 0 || g.t >= 1 || sk.speed < 1.2) {
    // Salida del riel: sigue con la velocidad que traia, en el aire.
    events.push({ t: 'grindEnd', seconds: g.time, kind: g.kind })
    sk.grind = null
    leaveGround(sk, g.sign * slopeY * sk.speed * 0.6)
    sk.popped = false
    sk.coyote = 0.05
  }
}

/** Recorre los cuadros fijos que correspondan a `elapsed` segundos. */
export function advance(
  world: WorldDef,
  sk: Skater,
  input: SimInput,
  elapsed: number,
  onEvents: (events: SimEvent[]) => void,
): void {
  let left = elapsed
  while (left > 1e-6) {
    const dt = Math.min(STEP, left)
    const events = stepSkater(world, sk, input, dt)
    if (events.length) onEvents(events)
    left -= dt
  }
}
