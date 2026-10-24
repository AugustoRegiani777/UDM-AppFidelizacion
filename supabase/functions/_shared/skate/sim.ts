// Simulación determinista de "Skate de Miga": física de rampas, trucos con los dos pulgares, turbo y caídas.
//
// Entrada por tick: pulgar izquierdo (0..8: nada + 8 direcciones) y pulgar derecho (apretado o no).
//  - En el suelo: derecho mantenido = agacharse y cargar el salto (al soltar, salta); izquierdo ↓ = encogerse
//    (menos fricción); izquierdo ↑ = turbo si hay carga.
//  - En el aire: izquierdo ←/→ = girar; derecho toque corto = kickflip (con ↑ heelflip, con ↓ shuvit);
//    derecho mantenido = agarre (indy; con ↑ superman; con ↓ japan). Girar una vuelta entera = flip.
//  - Los trucos se cobran al aterrizar bien: cargan el turbo, y el turbo hace falta para los saltos grandes.

import {
  ASSIST_LANDING,
  ASSIST_PUSH_ACCEL,
  BOOST_ACCEL,
  BOOST_DRAIN,
  CLIFF_TOLERANCE,
  CRUISE_SPEED,
  DT,
  FLIP_TICKS,
  FRICTION,
  GRAB_TICKS,
  GRAVITY,
  JUMP_BASE,
  JUMP_PER_CHARGE,
  MAX_BACKWARDS,
  MAX_CHARGE_TICKS,
  MAX_RUN_SECONDS,
  MAX_SPEED,
  NORMAL_LANDING,
  PIT_DEPTH,
  PUSH_ACCEL,
  SLOPE_FACTOR,
  SPAWN_SPEED,
  SPIN_COS,
  SPIN_SIN,
  STICK_TOLERANCE,
  STICK_X,
  STICK_Y,
  TAP_TICKS,
  TICKS_PER_SECOND,
  TRICK_BOOST,
  type LandingRules,
  type SkateConfig,
  type TrickName,
} from './config.ts'
import { buildTerrain, heightAt, slopeAt, type Terrain } from './terrain.ts'

export type SkateStatus = 'playing' | 'won' | 'lost'
export type LandingQuality = 'clean' | 'sketchy'
export type BailReason = 'landing' | 'wall' | 'pit'

export type SkateEvent =
  | { t: 'jump' | 'boost' | 'finish' | 'lose' }
  | { t: 'trick'; name: TrickName }
  | { t: 'land'; quality: LandingQuality; credit: number; tricks: TrickName[] }
  | { t: 'bail'; reason: BailReason }
  | { t: 'checkpoint' | 'stall' }

export interface SkateState {
  config: SkateConfig
  terrain: Terrain
  landing: LandingRules
  pitY: number
  tick: number
  status: SkateStatus
  x: number
  y: number
  px: number
  py: number
  /** Velocidad firmada a lo largo del suelo (solo en el suelo). */
  speed: number
  vx: number
  vy: number
  grounded: boolean
  /** Vector "arriba" del patinador (unitario). */
  upX: number
  upY: number
  rotTicks: number
  charge: number
  heldTicks: number
  pressTick: number
  prevRight: boolean
  airTicks: number
  tricks: TrickName[]
  grabbing: boolean
  boost: number
  lives: number
  bails: number
  checkpointX: number
  clean: number
  stallTicks: number
  events: SkateEvent[]
}

export function createSkate(config: SkateConfig, _seed = 0): SkateState {
  void _seed // el circuito es fijo; la semilla se guarda en la sesión por si más adelante varía
  const terrain = buildTerrain(undefined, config.courseLimit)
  let maxY = 0
  for (const y of terrain.ys) maxY = Math.max(maxY, y)
  const startY = heightAt(terrain, 40)
  return {
    config,
    terrain,
    landing: config.assist ? ASSIST_LANDING : NORMAL_LANDING,
    pitY: maxY + PIT_DEPTH,
    tick: 0,
    status: 'playing',
    x: 40,
    y: startY,
    px: 40,
    py: startY,
    speed: SPAWN_SPEED,
    vx: 0,
    vy: 0,
    grounded: true,
    upX: 0,
    upY: -1,
    rotTicks: 0,
    charge: 0,
    heldTicks: 0,
    pressTick: 0,
    prevRight: false,
    airTicks: 0,
    tricks: [],
    grabbing: false,
    boost: 0,
    lives: config.lives,
    bails: 0,
    checkpointX: 0,
    clean: 0,
    stallTicks: 0,
    events: [],
  }
}

const STALL_TICKS = 150

export const maxTicksOf = () => MAX_RUN_SECONDS * TICKS_PER_SECOND

function faceSurface(state: SkateState, slope: number) {
  const inv = 1 / Math.sqrt(1 + slope * slope)
  state.upX = slope * inv
  state.upY = -inv
}

function resetAirTrackers(state: SkateState) {
  state.rotTicks = 0
  state.airTicks = 0
  state.tricks = []
  state.grabbing = false
}

function register(state: SkateState, name: TrickName) {
  if (state.tricks.includes(name)) return
  state.tricks.push(name)
  state.events.push({ t: 'trick', name })
}

function respawn(state: SkateState) {
  const x = state.checkpointX
  state.x = state.px = x
  state.y = state.py = heightAt(state.terrain, x)
  state.speed = SPAWN_SPEED
  state.grounded = true
  state.charge = 0
  state.grabbing = false
  state.tricks = []
  state.rotTicks = 0
  faceSurface(state, slopeAt(state.terrain, x))
}

function bail(state: SkateState, reason: BailReason) {
  state.lives--
  state.bails++
  state.events.push({ t: 'bail', reason })
  if (state.lives <= 0) {
    state.status = 'lost'
    state.events.push({ t: 'lose' })
    return
  }
  respawn(state)
}

function leaveGround(state: SkateState, vx: number, vy: number) {
  state.grounded = false
  state.vx = vx
  state.vy = vy
  state.charge = 0
  resetAirTrackers(state)
}

function stepGround(state: SkateState, stickY: number, rightDown: boolean, released: boolean) {
  const { terrain } = state
  const slope = slopeAt(terrain, state.x)
  const inv = 1 / Math.sqrt(1 + slope * slope)
  const tx = inv
  const ty = slope * inv

  let v = state.speed
  let a = GRAVITY * SLOPE_FACTOR * ty
  if (v < CRUISE_SPEED) a += state.config.assist ? ASSIST_PUSH_ACCEL : PUSH_ACCEL
  const tucking = stickY > 0
  if (stickY < 0 && state.boost > 0) {
    a += BOOST_ACCEL
    state.boost = Math.max(0, state.boost - BOOST_DRAIN * DT)
    if (state.tick % 12 === 0) state.events.push({ t: 'boost' })
  }
  v += (a - v * FRICTION * (tucking ? 0.35 : 1)) * DT
  v = Math.min(MAX_SPEED, Math.max(-MAX_BACKWARDS, v))

  if (rightDown) state.charge = Math.min(MAX_CHARGE_TICKS, state.charge + 1)

  if (released) {
    const power = JUMP_BASE + JUMP_PER_CHARGE * state.charge
    const nx = slope * inv
    const ny = -inv
    state.events.push({ t: 'jump' })
    leaveGround(state, v * tx + nx * power, v * ty + ny * power)
    state.x += state.vx * DT
    state.y += state.vy * DT
    return
  }
  if (!rightDown) state.charge = 0

  const nextX = state.x + v * tx * DT
  const surface = heightAt(terrain, nextX)
  if (!Number.isFinite(surface)) {
    // Se acabó el suelo: sigue de largo hacia el foso.
    const vy = v * ty
    leaveGround(state, v * tx, vy)
    state.x = nextX
    state.y += vy * DT
    return
  }
  const ballistic = state.y + v * ty * DT + 0.5 * GRAVITY * DT * DT
  if (ballistic < surface - STICK_TOLERANCE) {
    // El suelo se alejó más rápido que la trayectoria: despegue (labio de una rampa).
    leaveGround(state, v * tx, v * ty)
    state.x = nextX
    state.y = ballistic
    return
  }
  state.x = nextX
  state.y = surface
  state.speed = v
  faceSurface(state, slopeAt(terrain, nextX))
}

function land(state: SkateState, surface: number, rightDown: boolean) {
  const slope = slopeAt(state.terrain, state.x)
  const inv = 1 / Math.sqrt(1 + slope * slope)
  const nx = slope * inv
  const ny = -inv
  const alignment = state.upX * nx + state.upY * ny

  // Las vueltas completas cuentan como truco (flip) si se aterriza bien.
  const flips = Math.trunc(Math.abs(state.rotTicks) / FLIP_TICKS)
  const flipName: TrickName = state.rotTicks > 0 ? 'frontflip' : 'backflip'

  let quality: LandingQuality | 'bail' =
    alignment >= state.landing.clean
      ? 'clean'
      : alignment >= state.landing.sketchy
        ? 'sketchy'
        : 'bail'
  // Aterrizar todavía agarrado a la tabla es feo: se baja de categoría.
  if (quality === 'clean' && state.grabbing && rightDown) quality = 'sketchy'
  if (quality === 'bail') {
    bail(state, 'landing')
    return
  }

  const tricks = [...state.tricks]
  let credit = 0
  for (const name of tricks) credit += TRICK_BOOST[name]
  if (flips > 0) {
    credit += TRICK_BOOST[flipName] * flips
    tricks.push(flipName)
  }
  const distinct = tricks.length
  const multiplier = Math.min(2, 1 + 0.25 * Math.max(0, distinct - 1))
  credit = Math.round(credit * multiplier * (quality === 'clean' ? 1 : 0.5))

  const tx = inv
  const ty = slope * inv
  let v = state.vx * tx + state.vy * ty
  if (quality === 'sketchy') v *= 0.72
  state.speed = Math.min(MAX_SPEED, Math.max(-MAX_BACKWARDS, v))
  state.boost = Math.min(100, state.boost + credit)
  state.y = surface
  state.grounded = true
  state.grabbing = false
  state.charge = 0
  faceSurface(state, slope)
  if (quality === 'clean') state.clean++
  state.events.push({ t: 'land', quality, credit, tricks })
  state.tricks = []
  state.rotTicks = 0
}

function stepAir(
  state: SkateState,
  stickX: number,
  stickY: number,
  rightDown: boolean,
  pressed: boolean,
  released: boolean,
) {
  state.airTicks++

  if (stickX !== 0) {
    const s = SPIN_SIN * stickX
    const ux = state.upX * SPIN_COS - state.upY * s
    const uy = state.upX * s + state.upY * SPIN_COS
    state.upX = ux
    state.upY = uy
    state.rotTicks += stickX
    if (state.tick % 30 === 0) {
      const len = Math.sqrt(ux * ux + uy * uy) || 1
      state.upX = ux / len
      state.upY = uy / len
    }
  }

  if (pressed) state.pressTick = state.tick
  if (rightDown && !state.grabbing && state.heldTicks >= GRAB_TICKS) {
    state.grabbing = true
    register(state, stickY < 0 ? 'superman' : stickY > 0 ? 'japan' : 'indy')
  }
  if (released) {
    if (state.grabbing) state.grabbing = false
    else if (state.tick - state.pressTick < TAP_TICKS) {
      register(state, stickY < 0 ? 'heelflip' : stickY > 0 ? 'shuvit' : 'kickflip')
    }
  }

  state.vy += GRAVITY * DT
  state.x += state.vx * DT
  state.y += state.vy * DT

  if (state.y > state.pitY) {
    bail(state, 'pit')
    return
  }
  const surface = heightAt(state.terrain, state.x)
  if (Number.isFinite(surface) && state.y >= surface) {
    if (state.py > surface + CLIFF_TOLERANCE) bail(state, 'wall')
    else land(state, surface, rightDown)
  }
}

/** Avanza un tick. `stick` es el pulgar izquierdo (0..8) y `rightDown` el derecho. */
export function stepSkate(state: SkateState, stick: number, rightDown: boolean): void {
  if (state.status !== 'playing') return
  state.events.length = 0
  state.tick++
  state.px = state.x
  state.py = state.y

  const stickX = STICK_X[stick] ?? 0
  const stickY = STICK_Y[stick] ?? 0
  const pressed = rightDown && !state.prevRight
  const released = !rightDown && state.prevRight
  state.heldTicks = rightDown ? state.heldTicks + 1 : 0

  if (state.grounded) stepGround(state, stickY, rightDown, released)
  else stepAir(state, stickX, stickY, rightDown, pressed, released)
  state.prevRight = rightDown

  // Si se queda trabado rodando de un lado al otro, vuelve al último punto de control sin perder vida.
  state.stallTicks = state.grounded && Math.abs(state.speed) < 35 ? state.stallTicks + 1 : 0
  if (state.stallTicks >= STALL_TICKS) {
    state.stallTicks = 0
    state.events.push({ t: 'stall' })
    respawn(state)
  }

  if (state.status !== 'playing') return
  for (const cp of state.terrain.checkpoints) {
    if (cp > state.checkpointX && state.x >= cp) {
      state.checkpointX = cp
      state.events.push({ t: 'checkpoint' })
    }
  }
  if (state.x >= state.terrain.length) {
    state.status = 'won'
    state.events.push({ t: 'finish' })
  } else if (state.tick >= maxTicksOf()) {
    state.status = 'lost'
    state.events.push({ t: 'lose' })
  }
}

/** Huella de la partida para comparar dos ejecuciones. */
export function checksumSkate(state: SkateState): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= Math.round(n * 100) | 0
    h = Math.imul(h, 16777619)
  }
  mix(state.tick)
  mix(state.x)
  mix(state.y)
  mix(state.speed)
  mix(state.boost)
  mix(state.lives)
  mix(state.clean)
  return h >>> 0
}
