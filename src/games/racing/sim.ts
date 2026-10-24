// Simulación de "Miga Racers": autitos vistos desde arriba. Paso fijo de 1/60 s, azar con semilla.
// Es práctica sin premio, así que no se valida en el servidor; igual es pura para poder probarla.

import { SPACING, trackAt, type Track } from './tracks.ts'

export const TICKS_PER_SECOND = 60
const DT = 1 / TICKS_PER_SECOND
export const CAR_RADIUS = 11
export const COUNTDOWN_TICKS = 180
export const CAR_COUNT = 4

const MAX_SPEED = 300
const ACCEL = 250
const BRAKE_DECEL = 420
const DRAG = 0.12
const OFFTRACK_MAX = 0.5
const OFFTRACK_DRAG = 2.4
const GRIP = 8.5
const GRIP_DRIFT = 2.2
const TURN_RATE = 2.7
const STEER_SMOOTH = 11
const BOOST_TICKS = 50
const BOOST_MULT = 1.35
const PAD_RADIUS = 24
const SEARCH_WINDOW = 36
const WALL_FACTOR = 1.85

export interface Controls {
  steer: number
  brake: boolean
}

export interface Car {
  isPlayer: boolean
  x: number
  y: number
  h: number
  vx: number
  vy: number
  /** Distancia total recorrida sobre el eje (negativa antes de la largada). */
  progress: number
  idx: number
  steer: number
  boost: number
  offTrack: boolean
  finished: boolean
  finishTick: number
  /** Qué tan bien maneja un rival (1 = igual que el jugador). */
  skill: number
  lane: number
  color: string
  /** Derrape lateral actual (para humo y sonido). */
  slip: number
  flash: number
}

export type RaceEvent =
  | { t: 'count'; n: number }
  | { t: 'go' | 'lap' | 'finish' }
  | { t: 'boost' | 'bump'; x: number; y: number; own: boolean }

export type RaceStatus = 'countdown' | 'racing' | 'finished'

export interface RaceState {
  track: Track
  tick: number
  raceTick: number
  status: RaceStatus
  cars: Car[]
  /** Posición final del jugador (1 = ganó), recién cuando termina. */
  position: number
  events: RaceEvent[]
  seed: number
}

const COLORS = ['#2f6fb5', '#e9a948', '#4c9a5b', '#c8102e']

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRace(trackIndex: number, seed: number): RaceState {
  const track = trackAt(trackIndex)
  const random = rng(seed)
  const cars: Car[] = []
  // Grilla de 2 columnas detrás de la línea de largada (índice 0 del eje).
  for (let slot = 0; slot < CAR_COUNT; slot++) {
    const row = Math.floor(slot / 2)
    const side = slot % 2 === 0 ? -1 : 1
    const behind = 3 + row * 3
    const idx = (track.count - behind) % track.count
    const nx = -track.ty[idx]!
    const ny = track.tx[idx]!
    const offset = side * track.half * 0.42
    const isPlayer = slot === CAR_COUNT - 1
    cars.push({
      isPlayer,
      x: track.xs[idx]! + nx * offset,
      y: track.ys[idx]! + ny * offset,
      h: Math.atan2(track.ty[idx]!, track.tx[idx]!),
      vx: 0,
      vy: 0,
      progress: -behind * SPACING,
      idx,
      steer: 0,
      boost: 0,
      offTrack: false,
      finished: false,
      finishTick: 0,
      skill: isPlayer ? 1 : 0.94 + random() * 0.08,
      lane: (random() - 0.5) * track.half * 0.9,
      color: COLORS[slot] ?? '#fff',
      slip: 0,
      flash: 0,
    })
  }
  return { track, tick: 0, raceTick: 0, status: 'countdown', cars, position: 0, events: [], seed }
}

export function playerOf(state: RaceState): Car {
  return state.cars.find((c) => c.isPlayer)!
}

export function lapOf(state: RaceState, car: Car): number {
  return Math.min(
    state.track.def.laps,
    Math.max(0, Math.floor(car.progress / state.track.length)) + 1,
  )
}

/** Puesto actual de un auto (1 = adelante). */
export function rankOf(state: RaceState, car: Car): number {
  return 1 + state.cars.filter((o) => o !== car && o.progress > car.progress).length
}

const wrapAngle = (a: number) => {
  let v = a
  while (v > Math.PI) v -= Math.PI * 2
  while (v < -Math.PI) v += Math.PI * 2
  return v
}

/** Ubica al auto en el eje: actualiza el índice más cercano y el progreso total. */
function locate(track: Track, car: Car): number {
  const n = track.count
  let best = car.idx
  let bestD = Infinity
  for (let k = -SEARCH_WINDOW; k <= SEARCH_WINDOW; k++) {
    const i = (car.idx + k + n * 4) % n
    const dx = car.x - track.xs[i]!
    const dy = car.y - track.ys[i]!
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  let delta = best - car.idx
  if (delta > n / 2) delta -= n
  else if (delta < -n / 2) delta += n
  car.progress += delta * SPACING
  car.idx = best
  return Math.sqrt(bestD)
}

type Driving = Controls & { analog: number }

/** El rival "conduce": apunta a un punto adelante en la pista y frena antes de las curvas cerradas. */
function aiControls(state: RaceState, car: Car): Driving {
  const { track } = state
  const n = track.count
  const speed = Math.hypot(car.vx, car.vy)
  const look = 7 + Math.floor(speed / 38)
  const ti = (car.idx + look) % n
  const nx = -track.ty[ti]!
  const ny = track.tx[ti]!
  const tx = track.xs[ti]! + nx * car.lane
  const ty = track.ys[ti]! + ny * car.lane
  const diff = wrapAngle(Math.atan2(ty - car.y, tx - car.x) - car.h)
  const analog = Math.max(-1, Math.min(1, diff * 2.6))

  // Curvatura más adelante: cuanto más cerrada, más despacio.
  const a = (car.idx + 4) % n
  const b = (car.idx + 22) % n
  const dot = track.tx[a]! * track.tx[b]! + track.ty[a]! * track.ty[b]!
  const curve = 1 - Math.max(-1, Math.min(1, dot))
  const corner = MAX_SPEED * car.skill * track.def.aiSpeed * (1 - Math.min(0.55, curve * 0.9))
  return { steer: analog, analog, brake: speed > corner * 1.12 }
}

function stepCar(state: RaceState, car: Car, controls: Controls & { analog?: number }) {
  const { track } = state
  const target = controls.analog ?? controls.steer
  car.steer += (target - car.steer) * Math.min(1, STEER_SMOOTH * DT)

  const speedCap =
    MAX_SPEED *
    (car.isPlayer ? 1 : car.skill * track.def.aiSpeed) *
    (car.boost > 0 ? BOOST_MULT : 1) *
    (car.offTrack ? OFFTRACK_MAX : 1)

  // Se gira el rumbo y recién después se separa la velocidad en "adelante" y "de costado".
  const forward = car.vx * Math.cos(car.h) + car.vy * Math.sin(car.h)
  const turn =
    car.steer * TURN_RATE * Math.min(1, Math.abs(forward) / 90) * (controls.brake ? 1.35 : 1)
  car.h += turn * (forward >= 0 ? 1 : -1) * DT
  const fx = Math.cos(car.h)
  const fy = Math.sin(car.h)
  const rx = -fy
  const ry = fx
  let vf = car.vx * fx + car.vy * fy
  let vl = car.vx * rx + car.vy * ry

  if (controls.brake) vf = Math.max(-60, vf - BRAKE_DECEL * DT)
  else if (vf < speedCap) vf = Math.min(speedCap, vf + ACCEL * (car.boost > 0 ? 1.8 : 1) * DT)
  if (vf > speedCap) vf -= (vf - speedCap) * Math.min(1, 3 * DT)
  vf -= vf * (car.offTrack ? OFFTRACK_DRAG : DRAG) * DT
  vl -= vl * Math.min(1, (controls.brake ? GRIP_DRIFT : GRIP) * DT)

  car.slip = Math.abs(vl)
  car.vx = fx * vf + rx * vl
  car.vy = fy * vf + ry * vl
  car.x += car.vx * DT
  car.y += car.vy * DT
  if (car.boost > 0) car.boost--
  if (car.flash > 0) car.flash--

  const dist = locate(track, car)
  car.offTrack = dist > track.half
  // Paredes blandas de la mesa: si se va muy lejos, la pista lo trae de vuelta.
  if (dist > track.half * WALL_FACTOR) {
    car.x += (track.xs[car.idx]! - car.x) * 0.18
    car.y += (track.ys[car.idx]! - car.y) * 0.18
    car.vx *= 0.9
    car.vy *= 0.9
  }

  // Parches de turbo.
  for (const padIdx of track.boostIdx) {
    const dx = car.x - track.xs[padIdx]!
    const dy = car.y - track.ys[padIdx]!
    if (dx * dx + dy * dy < PAD_RADIUS * PAD_RADIUS && car.boost < BOOST_TICKS - 8) {
      car.boost = BOOST_TICKS
      state.events.push({ t: 'boost', x: car.x, y: car.y, own: car.isPlayer })
    }
  }
}

function collide(state: RaceState) {
  const cars = state.cars
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]!
      const b = cars[j]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      const min = CAR_RADIUS * 2
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const push = (min - d) / 2
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (rel < 0) {
        const impulse = -rel * 0.6
        a.vx -= nx * impulse
        a.vy -= ny * impulse
        b.vx += nx * impulse
        b.vy += ny * impulse
        a.flash = b.flash = 6
        if (-rel > 40) {
          state.events.push({
            t: 'bump',
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            own: a.isPlayer || b.isPlayer,
          })
        }
      }
    }
  }
}

const IDLE: Controls = { steer: 0, brake: false }

/** Avanza un tick. `input` son los controles del jugador. */
export function stepRace(state: RaceState, input: Controls): void {
  if (state.status === 'finished') return
  state.events.length = 0
  state.tick++

  if (state.status === 'countdown') {
    const left = COUNTDOWN_TICKS - state.tick
    if (left > 0 && left % 60 === 0) state.events.push({ t: 'count', n: left / 60 })
    if (left <= 0) {
      state.status = 'racing'
      state.events.push({ t: 'go' })
    }
    // Los autos esperan quietos hasta el "¡YA!".
    return
  }

  state.raceTick++
  const player = playerOf(state)
  const laps = state.track.def.laps
  for (const car of state.cars) {
    if (car.finished) {
      stepCar(state, car, IDLE)
      continue
    }
    const before = Math.floor(car.progress / state.track.length)
    const controls = car.isPlayer ? input : aiControls(state, car)
    // Rubber-banding suave: los rivales ajustan un poquito si se alejan mucho del jugador.
    if (!car.isPlayer) {
      const gap = car.progress - player.progress
      const nudge = gap > 320 ? -0.0004 : gap < -320 ? 0.0004 : 0
      car.skill = Math.max(0.9, Math.min(1.06, car.skill + nudge))
    }
    stepCar(state, car, controls)
    const after = Math.floor(car.progress / state.track.length)
    if (car.isPlayer && after > before && after < laps) state.events.push({ t: 'lap' })
    if (car.progress >= laps * state.track.length) {
      car.finished = true
      car.finishTick = state.raceTick
      if (car.isPlayer) {
        state.events.push({ t: 'finish' })
        state.position = rankOf(state, car)
        state.status = 'finished'
      }
    }
  }
  collide(state)
}

/** Piloto automático para pruebas: maneja al jugador con la misma lógica de los rivales. */
export function autopilot(state: RaceState, skill: number): Driving {
  const player = playerOf(state)
  const saved = player.skill
  player.skill = skill / state.track.def.aiSpeed
  const controls = aiControls(state, player)
  player.skill = saved
  return controls
}
