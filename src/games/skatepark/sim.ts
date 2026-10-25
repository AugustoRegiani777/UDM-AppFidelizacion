// Simulación de "Skate Spot": un parque de skate de lado, con trucos encadenados en combos.
// Pasos fijos de 1/60 s y azar con semilla. Es práctica sin premio: no se valida en el servidor.
//
// Controles (los mismos dos pulgares del Skate de Miga):
//  - Suelo: derecho mantenido = agacharse y cargar; al soltar, salta.
//  - Suelo y riel: el pulgar izquierdo (cualquier dirección) es el TURBO. Gasta energía, se recarga
//    solo y con cada combo bien aterrizado. La velocidad que da el turbo se conserva un rato en el aire.
//  - Aire: izquierdo ←/→ gira el cuerpo; derecho toque = truco de tabla (según la palanca);
//    derecho mantenido = agarre (según la palanca).
//  - Riel o cajón: al caer sobre él con el giro correcto te agarrás (50-50 o boardslide) y avanzás
//    solo hasta el final. Un toque del derecho salta del riel sin perder el combo.
//  - Los puntos del combo se cobran recién al aterrizar bien. Caerse los pierde.

export const TICKS_PER_SECOND = 60
const DT = 1 / TICKS_PER_SECOND
const GRAVITY = 1300
const OLLIE_BASE = 380
const OLLIE_PER_CHARGE = 10
const MAX_CHARGE = 18
const TAP_TICKS = 12
const SPIN_RATE = 540
const WALL_TOLERANCE = 7
const PIT_DEPTH = 90
const IMPACT_LIMIT = 760
const BAIL_TICKS = 85
const CLEAN_SPIN = 30
const SKETCHY_SPIN = 55
const FLIP_SKETCHY = 0.7

const TURBO_MULT = 1.5
const TURBO_DRAIN = 0.0075 // se vacía en ~2,2 s
const TURBO_RECHARGE = 0.0022 // se llena en ~7,5 s
const TURBO_MIN = 0.02
const TURBO_UNLOCK = 0.25
const TURBO_BANK_REFILL = 0.25

export const RAIL_HEIGHT = 26
export const LEVEL_COUNT = 5
export const STAR_MULTIPLIERS = [1, 1.8, 3] as const

export interface LevelDef {
  seconds: number
  cruise: number
  /** Puntaje para la primera estrella. */
  target: number
  /** Probabilidad relativa de cada obstáculo. */
  weights: { ramp: number; box: number; rail: number; gap: number }
  spacing: readonly [number, number]
  gapWidth: readonly [number, number]
}

export const LEVELS: readonly LevelDef[] = [
  {
    seconds: 60,
    cruise: 190,
    target: 2500,
    weights: { ramp: 4, box: 1, rail: 4, gap: 1 },
    spacing: [330, 470],
    gapWidth: [90, 105],
  },
  {
    seconds: 60,
    cruise: 205,
    target: 3500,
    weights: { ramp: 4, box: 2, rail: 4, gap: 2 },
    spacing: [310, 440],
    gapWidth: [95, 115],
  },
  {
    seconds: 60,
    cruise: 220,
    target: 4800,
    weights: { ramp: 3, box: 3, rail: 4, gap: 3 },
    spacing: [290, 420],
    gapWidth: [100, 125],
  },
  {
    seconds: 60,
    cruise: 235,
    target: 6500,
    weights: { ramp: 3, box: 3, rail: 5, gap: 3 },
    spacing: [270, 400],
    gapWidth: [105, 135],
  },
  {
    seconds: 60,
    cruise: 250,
    target: 8500,
    weights: { ramp: 3, box: 4, rail: 5, gap: 4 },
    spacing: [250, 380],
    gapWidth: [110, 145],
  },
]

export type ObstacleKind = 'ramp' | 'box' | 'rail' | 'gap'

export interface Obstacle {
  kind: ObstacleKind
  x: number
  w: number
  h: number
}

export type TrickKind =
  | 'kickflip'
  | 'heelflip'
  | 'shoveit'
  | 'shoveit360'
  | 'hardflip'
  | 'treflip'
  | 'laserflip'
  | 'varialflip'
  | 'inwardheel'

interface TrickDef {
  kind: TrickKind
  points: number
  ticks: number
}

/** Un truco de tabla por cada posición de la palanca (0 = nada, luego →, ↘, ↓, ↙, ←, ↖, ↑, ↗). */
const TRICKS: readonly TrickDef[] = [
  { kind: 'kickflip', points: 80, ticks: 28 },
  { kind: 'shoveit360', points: 120, ticks: 36 },
  { kind: 'laserflip', points: 200, ticks: 42 },
  { kind: 'heelflip', points: 80, ticks: 28 },
  { kind: 'inwardheel', points: 130, ticks: 34 },
  { kind: 'shoveit', points: 70, ticks: 24 },
  { kind: 'varialflip', points: 130, ticks: 34 },
  { kind: 'hardflip', points: 140, ticks: 34 },
  { kind: 'treflip', points: 200, ticks: 42 },
]

export type GrabKind = 'indy' | 'melon' | 'nose' | 'tail' | 'method'
const GRABS: readonly GrabKind[] = [
  'indy',
  'method',
  'indy',
  'tail',
  'indy',
  'melon',
  'indy',
  'nose',
  'method',
]
const GRAB_POINTS: Record<GrabKind, number> = {
  indy: 60,
  melon: 70,
  nose: 80,
  tail: 80,
  method: 110,
}

export type GrindKind = '5050' | 'boardslide'
const GRIND_POINTS: Record<GrindKind, number> = { '5050': 60, boardslide: 130 }
const GRIND_RATE: Record<GrindKind, number> = { '5050': 90, boardslide: 170 }

export type BailReason = 'wall' | 'pit' | 'fall' | 'spin' | 'flip' | 'grab' | 'grind'
export type Mode = 'roll' | 'air' | 'grind' | 'bail'
export type ParkStatus = 'playing' | 'done'

export type ParkEvent =
  | { t: 'jump' | 'pop' | 'done' }
  | { t: 'action'; name: string; points: number; x: number; y: number }
  | { t: 'land'; quality: 'clean' | 'sketchy'; x: number }
  | { t: 'bank'; total: number; mult: number; names: string[] }
  | { t: 'bail'; reason: BailReason; lost: number }
  | { t: 'grind'; kind: GrindKind }
  | { t: 'sparks' }
  | { t: 'turbo' }

export interface Combo {
  points: number
  mult: number
  names: string[]
}

export interface FlipState {
  kind: TrickKind
  t: number
  ticks: number
  points: number
}

export interface ParkState {
  level: number
  def: LevelDef
  obstacles: Obstacle[]
  length: number
  tick: number
  totalTicks: number
  status: ParkStatus
  mode: Mode
  x: number
  y: number
  vy: number
  /** Qué parte de la velocidad de crucero tiene (se recupera tras una caída). */
  speedFactor: number
  /** Energía del turbo (0..1), si está activo y si quedó bloqueado por haberse vaciado. */
  turbo: number
  turboOn: boolean
  turboLock: boolean
  /** Multiplicador de velocidad por el turbo (sube rápido y baja despacio, también en el aire). */
  speedMul: number
  charge: number
  prevRight: boolean
  pressTick: number
  stickAtPress: number
  /** Giro acumulado del cuerpo en grados. */
  spin: number
  flip: FlipState | null
  queuedTrick: number
  grab: { active: boolean; kind: GrabKind; ticks: number; lastRelease: number } | null
  grind: { kind: GrindKind; obstacle: Obstacle; acc: number; since: number } | null
  airTicks: number
  peak: number
  airStartX: number
  combo: Combo
  score: number
  bestCombo: number
  landed: number
  bails: number
  bailTicks: number
  bailReason: BailReason | null
  rngState: number
  events: ParkEvent[]
}

const SX = [0, 1, 1, 0, -1, -1, -1, 0, 1]
const SY = [0, 0, 1, 1, 1, 0, -1, -1, -1]
/** Palanca: 3 = abajo, 7 = arriba (coincide con ThumbsInput del skate). */

export const stickX = (stick: number) => SX[stick] ?? 0
export const stickY = (stick: number) => SY[stick] ?? 0

function random(s: ParkState): number {
  s.rngState = (s.rngState + 0x6d2b79f5) >>> 0
  let t = Math.imul(s.rngState ^ (s.rngState >>> 15), 1 | s.rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// --- Parque ----------------------------------------------------------------------------------------

function pickKind(def: LevelDef, r: number): ObstacleKind {
  const entries = Object.entries(def.weights) as [ObstacleKind, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let acc = r * total
  for (const [kind, weight] of entries) {
    acc -= weight
    if (acc <= 0) return kind
  }
  return 'ramp'
}

export function buildPark(level: number, seed: number): { obstacles: Obstacle[]; length: number } {
  const def = LEVELS[Math.min(LEVEL_COUNT, Math.max(1, level)) - 1]!
  const rng = { rngState: seed >>> 0 } as ParkState
  const length = def.seconds * def.cruise + 900
  const obstacles: Obstacle[] = []
  let x = 520
  let previous: ObstacleKind | null = null
  let guard = 0
  while (x < length - 500 && guard++ < 200) {
    let kind = pickKind(def, random(rng))
    // Nunca dos pozos o dos cajones seguidos: el parque tiene que respirar.
    if ((kind === 'gap' || kind === 'box') && previous === kind) kind = 'ramp'
    let w: number
    let h: number
    switch (kind) {
      case 'ramp':
        w = 90 + Math.floor(random(rng) * 50)
        h = random(rng) < 0.3 ? 62 : 32
        break
      case 'box':
        w = 130 + Math.floor(random(rng) * 60)
        h = 24
        break
      case 'rail':
        w = 150 + Math.floor(random(rng) * 80)
        h = RAIL_HEIGHT
        break
      default:
        w = def.gapWidth[0] + Math.floor(random(rng) * (def.gapWidth[1] - def.gapWidth[0]))
        h = 0
    }
    obstacles.push({ kind, x, w, h })
    previous = kind
    x += w + def.spacing[0] + random(rng) * (def.spacing[1] - def.spacing[0])
  }
  return { obstacles, length }
}

/** Altura del suelo en x. -Infinity en un pozo. */
export function groundAt(obstacles: readonly Obstacle[], x: number): number {
  for (const o of obstacles) {
    if (x < o.x) break
    if (x > o.x + o.w) continue
    if (o.kind === 'gap') return -Infinity
    if (o.kind === 'box') return o.h
    if (o.kind === 'ramp') {
      const t = (x - o.x) / o.w
      return o.h * (0.35 * t + 0.65 * t * t)
    }
  }
  return 0
}

function rampSlopeAt(obstacles: readonly Obstacle[], x: number): number {
  const a = groundAt(obstacles, x - 2)
  const b = groundAt(obstacles, x)
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / 2 : 0
}

/** Superficies donde se puede hacer grind: rieles y el borde de arriba de los cajones. */
function grindSurfaces(obstacles: readonly Obstacle[]): Obstacle[] {
  return obstacles.filter((o) => o.kind === 'rail' || o.kind === 'box')
}

export function createPark(level: number, seed: number): ParkState {
  const def = LEVELS[Math.min(LEVEL_COUNT, Math.max(1, level)) - 1]!
  const { obstacles, length } = buildPark(level, seed)
  return {
    level,
    def,
    obstacles,
    length,
    tick: 0,
    totalTicks: def.seconds * TICKS_PER_SECOND,
    status: 'playing',
    mode: 'roll',
    x: 0,
    y: 0,
    vy: 0,
    speedFactor: 0.85,
    turbo: 1,
    turboOn: false,
    turboLock: false,
    speedMul: 1,
    charge: 0,
    prevRight: false,
    pressTick: 0,
    stickAtPress: 0,
    spin: 0,
    flip: null,
    queuedTrick: -1,
    grab: null,
    grind: null,
    airTicks: 0,
    peak: 0,
    airStartX: 0,
    combo: { points: 0, mult: 1, names: [] },
    score: 0,
    bestCombo: 0,
    landed: 0,
    bails: 0,
    bailTicks: 0,
    bailReason: null,
    rngState: (seed ^ 0x9e3779b9) >>> 0,
    events: [],
  }
}

export const starsFor = (score: number, level: number): number => {
  const target = LEVELS[Math.min(LEVEL_COUNT, Math.max(1, level)) - 1]!.target
  return STAR_MULTIPLIERS.filter((m) => score >= target * m).length
}

// --- Combos ----------------------------------------------------------------------------------------

function addAction(s: ParkState, name: string, points: number) {
  const repeated = s.combo.names.includes(name)
  // Repetir el mismo truco en un combo vale poco y no sube el multiplicador.
  const value = Math.round(repeated ? points * 0.4 : points)
  if (!repeated) {
    if (s.combo.names.length > 0) s.combo.mult += 1
    s.combo.names.push(name)
  }
  s.combo.points += value
  s.events.push({ t: 'action', name, points: value, x: s.x, y: s.y })
}

function bank(s: ParkState, factor: number) {
  if (s.combo.names.length === 0 && s.combo.points === 0) return
  const total = Math.round(s.combo.points * s.combo.mult * factor)
  s.score += total
  s.bestCombo = Math.max(s.bestCombo, total)
  s.events.push({ t: 'bank', total, mult: s.combo.mult, names: [...s.combo.names] })
  s.combo = { points: 0, mult: 1, names: [] }
  // Un combo bien cobrado devuelve energía de turbo.
  s.turbo = Math.min(1, s.turbo + TURBO_BANK_REFILL * factor)
}

function bail(s: ParkState, reason: BailReason) {
  const lost = s.combo.points * s.combo.mult
  s.events.push({ t: 'bail', reason, lost })
  s.combo = { points: 0, mult: 1, names: [] }
  s.mode = 'bail'
  s.bailTicks = BAIL_TICKS
  s.bailReason = reason
  s.bails++
  s.flip = null
  s.grab = null
  s.grind = null
  s.vy = reason === 'wall' || reason === 'grind' ? 180 : 0
  s.spin = 0
  s.charge = 0
  s.speedFactor = 0
  const floor = groundAt(s.obstacles, s.x)
  if (Number.isFinite(floor) && s.y < floor) s.y = floor
  // Si se cayó en un pozo o contra un cajón, se lo vuelve a poner en el suelo cerca.
  if (reason === 'pit' || reason === 'wall') {
    const hit = s.obstacles.find((o) => s.x >= o.x - 40 && s.x <= o.x + o.w + 40)
    if (hit) s.x = hit.kind === 'gap' ? hit.x + hit.w + 30 : hit.x - 70
    s.y = Math.max(0, groundAt(s.obstacles, s.x))
  }
}

// --- Aire --------------------------------------------------------------------------------------------

function startAir(s: ParkState, vy: number) {
  s.mode = 'air'
  s.vy = vy
  s.airTicks = 0
  s.peak = s.y
  s.airStartX = s.x
  s.spin = 0
  s.flip = null
  s.grab = null
  s.queuedTrick = -1
}

function startFlip(s: ParkState, stick: number) {
  const def = TRICKS[stick] ?? TRICKS[0]!
  s.flip = { kind: def.kind, t: 0, ticks: def.ticks, points: def.points }
}

function spinError(spin: number): number {
  const a = ((Math.abs(spin) % 180) + 180) % 180
  return Math.min(a, 180 - a)
}

function tryAttachGrind(s: ParkState): boolean {
  if (s.vy > 0) return false
  for (const o of grindSurfaces(s.obstacles)) {
    if (s.x < o.x + 6 || s.x > o.x + o.w - 8) continue
    if (s.y > o.h + 9 || s.y < o.h - 11) continue
    if (s.flip && s.flip.t / s.flip.ticks < 0.6) return false
    const err = spinError(s.spin)
    let kind: GrindKind
    if (err <= CLEAN_SPIN) kind = '5050'
    else if (err >= 90 - CLEAN_SPIN) kind = 'boardslide'
    else {
      bail(s, 'grind')
      return true
    }
    if (s.flip) {
      addAction(s, s.flip.kind, s.flip.points * 0.6)
      s.flip = null
    }
    if (s.grab?.active) releaseGrab(s)
    s.mode = 'grind'
    s.y = o.h
    s.vy = 0
    s.spin = 0
    s.grind = { kind, obstacle: o, acc: 0, since: s.tick }
    addAction(s, kind === '5050' ? '50-50' : 'Boardslide', GRIND_POINTS[kind])
    s.events.push({ t: 'grind', kind })
    return true
  }
  return false
}

function releaseGrab(s: ParkState) {
  const grab = s.grab
  if (!grab?.active) return
  addAction(s, grab.kind, GRAB_POINTS[grab.kind] + grab.ticks * 1.5)
  grab.active = false
  grab.lastRelease = s.tick
}

function land(s: ParkState, ground: number) {
  const spinErr = spinError(s.spin)
  const impact = -s.vy
  if (impact > IMPACT_LIMIT) return bail(s, 'fall')
  if (s.grab?.active) return bail(s, 'grab')
  if (s.flip && s.flip.t / s.flip.ticks < FLIP_SKETCHY) return bail(s, 'flip')
  if (spinErr > SKETCHY_SPIN) return bail(s, 'spin')

  const sketchy = spinErr > CLEAN_SPIN || s.flip !== null
  if (s.flip) {
    addAction(s, s.flip.kind, s.flip.points * 0.7)
    s.flip = null
  }
  const spins = Math.round(Math.abs(s.spin) / 180)
  if (spins >= 1) addAction(s, `${spins * 180}`, 90 * spins)
  if (s.peak > 85) addAction(s, 'Big air', Math.round(40 + (s.peak - 85)))
  // Pozos salvados de punta a punta.
  for (const o of s.obstacles) {
    if (o.kind === 'gap' && s.airStartX < o.x + 8 && s.x > o.x + o.w - 8) addAction(s, 'Gap', 150)
  }
  s.landed++
  s.events.push({ t: 'land', quality: sketchy ? 'sketchy' : 'clean', x: s.x })
  bank(s, sketchy ? 0.5 : 1)
  s.mode = 'roll'
  s.y = ground
  s.vy = 0
  s.spin = 0
  s.grab = null
  s.airTicks = 0
}

// --- Paso --------------------------------------------------------------------------------------------

export interface ParkInput {
  stick: number
  right: boolean
}

export function stepPark(s: ParkState, input: ParkInput): void {
  if (s.status !== 'playing') return
  s.events.length = 0
  s.tick++
  const sx = stickX(input.stick)
  const press = input.right && !s.prevRight
  const release = !input.right && s.prevRight
  if (press) {
    s.pressTick = s.tick
    s.stickAtPress = input.stick
  }
  /** Cuántos ticks lleva (o llevó, al soltar) apretado el botón derecho. */
  const pressLen = s.tick - s.pressTick

  s.speedFactor = Math.min(1, s.speedFactor + (s.mode === 'bail' ? 0 : 0.006))

  // Turbo: pulgar izquierdo apretado en el suelo o en un riel. Si se vacía, hay que esperar a que junte algo.
  if (s.turbo <= TURBO_MIN) s.turboLock = true
  else if (s.turbo >= TURBO_UNLOCK) s.turboLock = false
  const wasTurbo = s.turboOn
  s.turboOn =
    (s.mode === 'roll' || s.mode === 'grind') &&
    input.stick !== 0 &&
    !s.turboLock &&
    s.turbo > TURBO_MIN
  if (s.turboOn) {
    s.turbo = Math.max(0, s.turbo - TURBO_DRAIN)
    if (!wasTurbo) s.events.push({ t: 'turbo' })
  } else {
    s.turbo = Math.min(1, s.turbo + TURBO_RECHARGE)
  }
  const target = s.turboOn ? TURBO_MULT : 1
  s.speedMul += (target - s.speedMul) * (target > s.speedMul ? 0.18 : 0.03)
  const speed = s.def.cruise * s.speedFactor * s.speedMul

  switch (s.mode) {
    case 'bail': {
      s.bailTicks--
      s.speedFactor = 0
      if (s.bailTicks <= 0) {
        s.mode = 'roll'
        s.bailReason = null
        s.speedFactor = 0.6
        s.y = Math.max(0, groundAt(s.obstacles, s.x))
      } else if (s.y > groundAt(s.obstacles, s.x)) {
        s.vy -= GRAVITY * DT
        s.y = Math.max(groundAt(s.obstacles, s.x), s.y + s.vy * DT)
      }
      break
    }

    case 'roll': {
      const nx = s.x + speed * DT
      const next = groundAt(s.obstacles, nx)
      if (next === -Infinity) {
        // Entra a un pozo sin saltar: cae.
        s.x = nx
        startAir(s, 0)
        break
      }
      if (next - s.y > WALL_TOLERANCE) {
        s.x = nx
        bail(s, 'wall')
        break
      }
      const slope = rampSlopeAt(s.obstacles, s.x)
      if (next < s.y - 2) {
        // Se terminó la superficie: sale lanzado por la rampa o se tira de un cajón.
        s.x = nx
        startAir(s, slope > 0.04 ? slope * speed : 0)
        break
      }
      s.x = nx
      s.y = next
      if (input.right) s.charge = Math.min(MAX_CHARGE, s.charge + 1)
      if (release && s.charge > 0) {
        const boost = slope > 0.04 ? slope * speed * 0.9 : 0
        startAir(s, OLLIE_BASE + s.charge * OLLIE_PER_CHARGE + boost)
        s.charge = 0
        s.events.push({ t: 'pop' })
      } else if (!input.right) {
        s.charge = 0
      }
      break
    }

    case 'air': {
      s.airTicks++
      s.x += speed * DT
      s.vy -= GRAVITY * DT
      s.y += s.vy * DT
      s.peak = Math.max(s.peak, s.y)
      s.spin += sx * SPIN_RATE * DT

      if (s.flip) {
        s.flip.t++
        if (s.flip.t >= s.flip.ticks) {
          addAction(s, s.flip.kind, s.flip.points)
          s.flip = null
          if (s.queuedTrick >= 0) {
            startFlip(s, s.queuedTrick)
            s.queuedTrick = -1
          }
        }
      }

      if (release && pressLen < TAP_TICKS && !s.grab?.active) {
        const stick = input.stick
        if (!s.flip) startFlip(s, stick)
        else s.queuedTrick = stick
      }
      if (input.right && pressLen >= TAP_TICKS && !s.flip && !s.grab?.active) {
        s.grab = {
          active: true,
          kind: GRABS[input.stick] ?? 'indy',
          ticks: 0,
          lastRelease: -100,
        }
      }
      if (s.grab?.active) {
        s.grab.ticks++
        if (!input.right) releaseGrab(s)
      }

      if (tryAttachGrind(s)) break

      const ground = groundAt(s.obstacles, s.x)
      if (ground === -Infinity) {
        if (s.y < -PIT_DEPTH) bail(s, 'pit')
      } else if (ground - s.y > WALL_TOLERANCE + 4) {
        // Llegó al borde de un cajón, o al otro lado de un pozo, por debajo de la superficie.
        bail(s, ground > 0 ? 'wall' : 'pit')
      } else if (s.y <= ground && s.vy <= 0) {
        s.y = ground
        land(s, ground)
      }
      break
    }

    case 'grind': {
      const g = s.grind!
      s.x += speed * DT
      g.acc += GRIND_RATE[g.kind] * DT
      if (g.acc >= 1) {
        const whole = Math.floor(g.acc)
        s.combo.points += whole
        g.acc -= whole
      }
      if (s.tick % 3 === 0) s.events.push({ t: 'sparks' })

      if (release && s.pressTick >= g.since && pressLen < TAP_TICKS + 8) {
        // Salto desde el riel: se sigue el combo en el aire.
        startAir(s, OLLIE_BASE + 30)
        s.grind = null
        s.events.push({ t: 'pop' })
        break
      }
      if (s.x > g.obstacle.x + g.obstacle.w) {
        s.grind = null
        addAction(s, 'Grind out', 40)
        startAir(s, 90)
      }
      break
    }
  }

  s.prevRight = input.right
  if (s.x >= s.length || s.tick >= s.totalTicks) {
    // Fin de la sesión: lo que está en el aire sin aterrizar no cuenta.
    s.status = 'done'
    s.events.push({ t: 'done' })
  }
}

export const secondsLeft = (s: ParkState) =>
  Math.max(0, Math.ceil((s.totalTicks - s.tick) / TICKS_PER_SECOND))
