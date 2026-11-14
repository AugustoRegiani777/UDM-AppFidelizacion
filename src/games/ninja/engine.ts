// Motor de "Miga Ninja": simulación pura, determinista (con semilla) y sin DOM.
// El mundo mide FIELD_W unidades de ancho y `height` de alto; y crece hacia abajo.
// Todo lo que se lanza sale por debajo de la pantalla, sube en arco y cae. Los cortes entran
// como segmentos (el trayecto del dedo) y se prueban contra el círculo de cada objeto.

import type { LevelDef } from './levels.ts'

export const FIELD_W = 100
export const TICKS_PER_SECOND = 60
export const ITEM_RADIUS = 7.5
export const MAX_ITEMS = 32
const MAX_LAUNCHES = 64
const DT = 1 / TICKS_PER_SECOND
/** Zona de corte generosa para lo bueno y más chica que el dibujo para las hormigas. */
export const HIT_RADIUS = ITEM_RADIUS * 1.35
export const ANT_HIT_RADIUS = ITEM_RADIUS * 0.9
/** Segundos (de juego) de aviso en el borde antes de que salga una hormiga. */
export const ANT_WARNING = 0.9
/** Separación mínima entre una hormiga y cualquier otra cosa mientras ambas están a la vista. */
export const ANT_MIN_SEP = HIT_RADIUS + ANT_HIT_RADIUS + ITEM_RADIUS * 0.6
/** Entre hormiga y hormiga pasa al menos esto (segundos de juego). */
export const ANT_COOLDOWN = 1.1
/** Cada tantos cortes seguidos se recupera una vida (hasta las del nivel). */
export const LIFE_STREAK = 12
/** Un corte seguido dentro de esta ventana mantiene la racha. */
const COMBO_TICKS = 70
const FREEZE_SCALE = 0.35
export const FRENZY_SECONDS = 5
export const FREEZE_SECONDS = 5
const FRENZY_GAP = 0.22
const SPECIAL_COOLDOWN = 14

export type GoodKind = 'sandwich' | 'medialuna' | 'chipa' | 'cinnamon' | 'cafe'
export type SpecialKind = 'golden' | 'ice'
export type ItemKind = GoodKind | SpecialKind | 'ant'
export const GOOD_KINDS: readonly GoodKind[] = [
  'sandwich',
  'medialuna',
  'chipa',
  'cinnamon',
  'cafe',
]

export const KIND_POINTS: Record<ItemKind, number> = {
  sandwich: 10,
  medialuna: 10,
  chipa: 10,
  cinnamon: 15,
  cafe: 15,
  golden: 50,
  ice: 30,
  ant: 0,
}

export type PatternId =
  'single' | 'pair' | 'volley' | 'fan' | 'cross' | 'sweep' | 'fountain' | 'rain'

export type GameEvent =
  | {
      t: 'cut'
      kind: ItemKind
      x: number
      y: number
      angle: number
      vx: number
      vy: number
      points: number
      combo: number
      mult: number
    }
  | { t: 'bomb'; x: number; y: number; angle: number; vx: number; vy: number }
  | { t: 'miss'; x: number; kind: ItemKind }
  | { t: 'combo'; n: number; bonus: number; x: number; y: number }
  | { t: 'frenzy' }
  | { t: 'freeze' }
  | { t: 'goal' }
  | { t: 'life' }
  | { t: 'end'; win: boolean }

export interface Item {
  active: boolean
  id: number
  kind: ItemKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
}

interface Launch {
  used: boolean
  delay: number
  x: number
  apexX: number
  apexY: number
  kind: ItemKind
  /** Aviso total de una hormiga (0 = sin aviso); el render dibuja la señal en el borde. */
  warn: number
}

export interface GameState {
  level: LevelDef
  height: number
  gravity: number
  rng: number
  tick: number
  ticksLeft: number
  /** Reloj del juego en segundos (corre más lento con el café frío). */
  clock: number
  nextWave: number
  items: Item[]
  launches: Launch[]
  nextId: number
  score: number
  cuts: number
  lives: number
  combo: number
  bestCombo: number
  bestStroke: number
  lastCutTick: number
  strokeCuts: number
  bombHits: number
  misses: number
  frenzyTicks: number
  freezeTicks: number
  goldenReady: number
  iceReady: number
  /** Reloj a partir del cual puede salir otra hormiga. */
  antReady: number
  goalReached: boolean
  status: 'playing' | 'ended'
  win: boolean
  events: GameEvent[]
}

// ---- azar con semilla (mulberry32) -------------------------------------------------------

function rand(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const range = (s: GameState, a: number, b: number) => a + (b - a) * rand(s)
const int = (s: GameState, a: number, b: number) => a + Math.floor(rand(s) * (b - a + 1))

// ---- creación ----------------------------------------------------------------------------

export function createGame(level: LevelDef, seed: number, height = 160): GameState {
  const items: Item[] = []
  for (let i = 0; i < MAX_ITEMS; i++) {
    items.push({
      active: false,
      id: 0,
      kind: 'sandwich',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rot: 0,
      spin: 0,
    })
  }
  const launches: Launch[] = []
  for (let i = 0; i < MAX_LAUNCHES; i++) {
    launches.push({ used: false, delay: 0, x: 0, apexX: 0, apexY: 0, kind: 'sandwich', warn: 0 })
  }
  return {
    level,
    height,
    gravity: height * 1.05,
    rng: seed | 0,
    tick: 0,
    ticksLeft: level.seconds * TICKS_PER_SECOND,
    clock: 0,
    nextWave: 0.9,
    items,
    launches,
    nextId: 1,
    score: 0,
    cuts: 0,
    lives: level.lives,
    combo: 0,
    bestCombo: 0,
    bestStroke: 0,
    lastCutTick: -9999,
    strokeCuts: 0,
    bombHits: 0,
    misses: 0,
    frenzyTicks: 0,
    freezeTicks: 0,
    goldenReady: 4,
    iceReady: 7,
    antReady: 3,
    goalReached: false,
    status: 'playing',
    win: false,
    events: [],
  }
}

// ---- lanzamientos ------------------------------------------------------------------------

/** Avance 0..1 del tiempo del nivel. */
function levelProgress(s: GameState): number {
  return Math.max(0, Math.min(1, 1 - s.ticksLeft / (s.level.seconds * TICKS_PER_SECOND)))
}

/** Curva suave 0.3..1: pocas hormigas al empezar, el ritmo completo hacia la mitad del nivel. */
export function antRamp(s: GameState): number {
  const p = Math.min(1, levelProgress(s) / 0.55)
  return 0.3 + 0.7 * p * p * (3 - 2 * p)
}

function pickKind(s: GameState, allowBomb: boolean): ItemKind {
  if (
    allowBomb &&
    s.level.bombChance > 0 &&
    rand(s) < s.level.bombChance * antRamp(s)
  ) {
    return 'ant'
  }
  const kinds = s.level.kinds
  return kinds[int(s, 0, kinds.length - 1)]!
}

function queue(
  s: GameState,
  delay: number,
  x: number,
  apexX: number,
  apexY: number,
  kind: ItemKind,
) {
  for (const launch of s.launches) {
    if (launch.used) continue
    launch.used = true
    launch.delay = delay
    launch.x = x
    launch.apexX = apexX
    launch.apexY = apexY
    launch.kind = kind
    launch.warn = 0
    return
  }
}

const spawnY = (s: GameState) => s.height + ITEM_RADIUS * 1.6

/** Velocidad inicial de un lanzamiento (misma fórmula para lanzar y para predecir). */
function launchVel(s: GameState, launch: Launch, out: { vx: number; vy: number }) {
  const rise = Math.max(8, spawnY(s) - launch.apexY)
  out.vy = -Math.sqrt(2 * s.gravity * rise)
  out.vx = (launch.apexX - launch.x) / (-out.vy / s.gravity)
}

const velTmp = { vx: 0, vy: 0 }

/** Pasos de la predicción (segundos de juego) y alcance máximo de un vuelo. */
const PREDICT_STEP = 0.04
const PREDICT_MAX = 4

/**
 * Cerca de qué distancia pasan dos trayectorias mientras las dos se ven en pantalla.
 * `a` y `b` son (x, y, vx, vy, retardo hasta salir); el retardo es 0 si ya está volando.
 */
function tooClose(
  s: GameState,
  a: readonly [number, number, number, number, number],
  b: readonly [number, number, number, number, number],
  minSep: number,
): boolean {
  const limit = minSep * minSep
  const g = s.gravity
  for (let t = 0; t <= PREDICT_MAX; t += PREDICT_STEP) {
    const ta = t - a[4]
    const tb = t - b[4]
    if (ta < 0 || tb < 0) continue
    const ya = a[1] + a[3] * ta + 0.5 * g * ta * ta
    const yb = b[1] + b[3] * tb + 0.5 * g * tb * tb
    if (ya > s.height + ITEM_RADIUS || yb > s.height + ITEM_RADIUS) continue
    const dx = a[0] + a[2] * ta - (b[0] + b[2] * tb)
    const dy = ya - yb
    if (dx * dx + dy * dy < limit) return true
  }
  return false
}

type Track = [number, number, number, number, number]

function launchTrack(s: GameState, l: Launch): Track {
  launchVel(s, l, velTmp)
  return [l.x, spawnY(s), velTmp.vx, velTmp.vy, l.delay]
}

const itemTrack = (it: Item): Track => [it.x, it.y, it.vx, it.vy, 0]

/**
 * Deja las hormigas justas: les da aviso y arco lento al empezar, y deshace cualquier
 * hormiga que no se pueda esquivar (pegada a otra cosa, o dos seguidas muy cerca en el tiempo).
 * Corre después de armar cada oleada. Sin azar propio: no altera la secuencia del RNG.
 */
function makeAntsFair(s: GameState) {
  const ramp = antRamp(s)
  const calm = s.level.kinds[0]!
  for (const l of s.launches) {
    if (!l.used || l.kind !== 'ant' || l.warn > 0) continue
    // Una por vez: si no pasó el enfriamiento (o ya hay otra avisada), pasa a ser algo bueno.
    const taken = s.launches.some((o) => o !== l && o.used && o.kind === 'ant' && o.warn > 0)
    if (taken || s.clock < s.antReady) {
      l.kind = calm
      continue
    }
    l.delay += ANT_WARNING
    l.warn = ANT_WARNING
    // Más lenta (arco más bajo) al empezar; el arco completo a mitad del nivel.
    l.apexY = Math.max(l.apexY, s.height * (0.46 - 0.24 * ramp))
    // La siguiente sale recién cuando ésta ya cayó: nunca dos a la vista a la vez.
    launchVel(s, l, velTmp)
    const flight = (-2 * velTmp.vy) / s.gravity
    s.antReady = s.clock + l.delay + Math.max(ANT_COOLDOWN, flight + 0.15)
  }
  // Separación respecto de todo lo demás (lanzamientos pendientes y cosas en vuelo).
  for (const l of s.launches) {
    if (!l.used || l.kind !== 'ant') continue
    const track = launchTrack(s, l)
    let clash = false
    for (const o of s.launches) {
      if (o === l || !o.used) continue
      if (!tooClose(s, track, launchTrack(s, o), ANT_MIN_SEP)) continue
      // Lo bueno que la pisaría se descarta (la hormiga manda el espacio); otra hormiga, no.
      if (o.kind === 'ant') clash = true
      else o.used = false
    }
    if (!clash) {
      for (const it of s.items) {
        if (it.active && tooClose(s, track, itemTrack(it), ANT_MIN_SEP)) {
          clash = true
          break
        }
      }
    }
    if (clash) {
      l.kind = calm
      l.warn = 0
      l.delay -= ANT_WARNING
      if (l.delay < 0) l.delay = 0
    }
  }
  // Lo bueno que sale después de una hormiga ya en vuelo y la pisaría: se descarta.
  for (const l of s.launches) {
    if (!l.used || l.kind === 'ant') continue
    const track = launchTrack(s, l)
    for (const it of s.items) {
      if (it.active && it.kind === 'ant' && tooClose(s, track, itemTrack(it), ANT_MIN_SEP)) {
        l.used = false
        break
      }
    }
  }
}

function spawnNow(s: GameState, launch: Launch) {
  const item = s.items.find((it) => !it.active)
  if (!item) return
  const y0 = spawnY(s)
  launchVel(s, launch, velTmp)
  const vy = velTmp.vy
  item.active = true
  item.id = s.nextId++
  item.kind = launch.kind
  item.x = launch.x
  item.y = y0
  item.vx = velTmp.vx
  item.vy = vy
  item.rot = rand(s) * Math.PI * 2
  item.spin = range(s, -4, 4)
}

const apexY = (s: GameState) => range(s, s.height * 0.22, s.height * 0.5)

/** Arma una oleada según el patrón. `n` es la cantidad de objetos. */
function pattern(s: GameState, id: PatternId, n: number) {
  const bombs = s.frenzyTicks <= 0
  const first = pickKind(s, false)
  const k = (i: number) => (i === 0 ? first : pickKind(s, bombs))
  switch (id) {
    case 'single':
      queue(s, 0, range(s, 20, 80), range(s, 30, 70), apexY(s), first)
      break
    case 'pair':
      for (let i = 0; i < 2; i++) {
        queue(s, i * 0.12, range(s, 20, 80), range(s, 25, 75), apexY(s), k(i))
      }
      break
    case 'volley': {
      const x = range(s, 25, 75)
      for (let i = 0; i < n; i++) queue(s, i * 0.16, x, x + range(s, -12, 12), apexY(s), k(i))
      break
    }
    case 'fan': {
      const x = range(s, 30, 70)
      for (let i = 0; i < n; i++) {
        const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 56
        queue(
          s,
          0,
          x,
          Math.min(88, Math.max(12, x + spread)),
          range(s, s.height * 0.22, s.height * 0.4),
          k(i),
        )
      }
      break
    }
    case 'cross':
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0
        queue(
          s,
          Math.floor(i / 2) * 0.3,
          left ? 10 : 90,
          left ? range(s, 55, 80) : range(s, 20, 45),
          apexY(s),
          k(i),
        )
      }
      break
    case 'sweep': {
      const dir = rand(s) < 0.5 ? 1 : -1
      for (let i = 0; i < n; i++) {
        const p = n === 1 ? 0.5 : i / (n - 1)
        const x = 16 + (dir > 0 ? p : 1 - p) * 68
        queue(s, i * 0.2, x, x + range(s, -6, 6), range(s, s.height * 0.24, s.height * 0.42), k(i))
      }
      break
    }
    case 'fountain':
      for (let i = 0; i < n; i++) {
        const p = n === 1 ? 0.5 : i / (n - 1)
        queue(
          s,
          0,
          50 + range(s, -4, 4),
          14 + p * 72,
          range(s, s.height * 0.22, s.height * 0.46),
          k(i),
        )
      }
      break
    case 'rain':
      for (let i = 0; i < n; i++) {
        queue(
          s,
          i * 0.11,
          range(s, 14, 86),
          range(s, 14, 86),
          range(s, s.height * 0.24, s.height * 0.5),
          k(i),
        )
      }
      break
  }
}

function spawnWave(s: GameState) {
  const { level } = s
  const id = level.patterns[int(s, 0, level.patterns.length - 1)]!
  const n = int(s, level.waveMin, level.waveMax)
  pattern(s, id, n)
  // De vez en cuando una de las cosas de la oleada es especial.
  if (level.golden > 0 && s.clock >= s.goldenReady && rand(s) < level.golden) {
    s.goldenReady = s.clock + SPECIAL_COOLDOWN
    queue(s, 0.35, range(s, 25, 75), range(s, 35, 65), s.height * 0.3, 'golden')
  } else if (level.ice > 0 && s.clock >= s.iceReady && rand(s) < level.ice) {
    s.iceReady = s.clock + SPECIAL_COOLDOWN
    queue(s, 0.35, range(s, 25, 75), range(s, 35, 65), s.height * 0.3, 'ice')
  }
  makeAntsFair(s)
}

// ---- paso de simulación ------------------------------------------------------------------

function finish(s: GameState) {
  if (s.status === 'ended') return
  s.status = 'ended'
  s.win = goalMet(s)
  s.events.push({ t: 'end', win: s.win })
}

export function goalMet(s: GameState): boolean {
  return s.level.goal.type === 'score'
    ? s.score >= s.level.goal.target
    : s.cuts >= s.level.goal.target
}

/** Avance 0..1 hacia el objetivo del nivel. */
export function goalProgress(s: GameState): number {
  const value = s.level.goal.type === 'score' ? s.score : s.cuts
  return Math.min(1, value / s.level.goal.target)
}

function checkGoal(s: GameState) {
  if (!s.goalReached && goalMet(s)) {
    s.goalReached = true
    s.events.push({ t: 'goal' })
  }
}

function loseLife(s: GameState) {
  s.lives = Math.max(0, s.lives - 1)
  s.combo = 0
  if (s.lives <= 0) finish(s)
}

/** Velocidad del tiempo: sube con el nivel y baja con el café frío. */
export function timeScale(s: GameState): number {
  return s.level.speed * (s.freezeTicks > 0 ? FREEZE_SCALE : 1)
}

export function stepGame(s: GameState): void {
  if (s.status !== 'playing') return
  s.tick++
  s.ticksLeft--
  const dt = DT * timeScale(s)
  s.clock += dt
  if (s.frenzyTicks > 0) s.frenzyTicks--
  if (s.freezeTicks > 0) s.freezeTicks--

  // Oleadas (o lluvia de frenesí).
  if (s.clock >= s.nextWave) {
    if (s.frenzyTicks > 0) {
      pattern(s, 'single', 1)
      s.nextWave = s.clock + FRENZY_GAP
    } else {
      spawnWave(s)
      const progress = 1 - s.ticksLeft / (s.level.seconds * TICKS_PER_SECOND)
      const factor = 1 + (s.level.rampTo - 1) * Math.max(0, Math.min(1, progress))
      s.nextWave = s.clock + s.level.interval * factor * (0.85 + 0.3 * rand(s))
    }
  }

  for (const launch of s.launches) {
    if (!launch.used) continue
    launch.delay -= dt
    if (launch.delay <= 0) {
      launch.used = false
      spawnNow(s, launch)
    }
  }

  const floor = s.height + ITEM_RADIUS + 2
  for (const item of s.items) {
    if (!item.active) continue
    item.vy += s.gravity * dt
    item.x += item.vx * dt
    item.y += item.vy * dt
    item.rot += item.spin * dt
    if (item.vy > 0 && item.y > floor) {
      item.active = false
      if (item.kind !== 'ant' && item.kind !== 'golden' && item.kind !== 'ice') {
        s.misses++
        s.events.push({ t: 'miss', x: item.x, kind: item.kind })
        // En el frenesí no se pierde nada.
        if (s.frenzyTicks <= 0) loseLife(s)
      }
    } else if (item.x < -30 || item.x > FIELD_W + 30) {
      item.active = false
    }
  }

  if (s.status === 'playing' && s.ticksLeft <= 0) finish(s)
}

// ---- cortes ------------------------------------------------------------------------------

/** Distancia al cuadrado del punto (px,py) al segmento (x0,y0)-(x1,y1). */
export function distSqToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = dx * dx + dy * dy
  let t = len === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len
  t = Math.max(0, Math.min(1, t))
  const cx = x0 + t * dx - px
  const cy = y0 + t * dy - py
  return cx * cx + cy * cy
}

function cutItem(s: GameState, item: Item, angle: number) {
  item.active = false
  if (item.kind === 'ant') {
    s.bombHits++
    s.events.push({ t: 'bomb', x: item.x, y: item.y, angle, vx: item.vx, vy: item.vy })
    loseLife(s)
    return
  }
  s.combo = s.tick - s.lastCutTick <= COMBO_TICKS ? s.combo + 1 : 1
  s.lastCutTick = s.tick
  s.bestCombo = Math.max(s.bestCombo, s.combo)
  const mult = s.frenzyTicks > 0 ? 1 : Math.min(4, 1 + Math.floor(s.combo / 5))
  const points = KIND_POINTS[item.kind] * mult * (s.frenzyTicks > 0 ? 2 : 1)
  s.score += points
  s.cuts++
  s.strokeCuts++
  s.events.push({
    t: 'cut',
    kind: item.kind,
    x: item.x,
    y: item.y,
    angle,
    vx: item.vx,
    vy: item.vy,
    points,
    combo: s.combo,
    mult,
  })
  if (item.kind === 'golden') {
    s.frenzyTicks = FRENZY_SECONDS * TICKS_PER_SECOND
    s.events.push({ t: 'frenzy' })
  } else if (item.kind === 'ice') {
    s.freezeTicks = FREEZE_SECONDS * TICKS_PER_SECOND
    s.events.push({ t: 'freeze' })
  }
  if (s.combo % LIFE_STREAK === 0 && s.lives < s.level.lives) {
    s.lives++
    s.events.push({ t: 'life' })
  }
  // Tres o más de un solo tajo: bonus que crece con cada uno.
  if (s.strokeCuts >= 3) {
    const bonus = 10 * (s.strokeCuts - 1)
    s.score += bonus
    s.bestStroke = Math.max(s.bestStroke, s.strokeCuts)
    s.events.push({ t: 'combo', n: s.strokeCuts, bonus, x: item.x, y: item.y })
  }
  checkGoal(s)
}

/** Un tramo del trayecto del dedo. Devuelve cuántos objetos cortó. */
export function slash(s: GameState, x0: number, y0: number, x1: number, y1: number): number {
  if (s.status !== 'playing') return 0
  if (x0 === x1 && y0 === y1) return 0
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const limit = HIT_RADIUS * HIT_RADIUS
  const antLimit = ANT_HIT_RADIUS * ANT_HIT_RADIUS
  let count = 0
  for (const item of s.items) {
    if (!item.active) continue
    if (distSqToSegment(item.x, item.y, x0, y0, x1, y1) > (item.kind === 'ant' ? antLimit : limit))
      continue
    cutItem(s, item, angle)
    count++
    if (s.status !== 'playing') break
  }
  return count
}

/** El dedo se levantó: el próximo tajo cuenta como uno nuevo. */
export function endStroke(s: GameState): void {
  s.strokeCuts = 0
}

// ---- resultado ---------------------------------------------------------------------------

export function starsOf(s: GameState): number {
  if (!goalMet(s)) return 0
  const [two, three] = s.level.stars
  return 1 + (s.score >= two ? 1 : 0) + (s.score >= three ? 1 : 0)
}

export interface NinjaResult {
  win: boolean
  stars: number
  score: number
  cuts: number
  bestCombo: number
  bestStroke: number
}

export function resultOf(s: GameState): NinjaResult {
  return {
    win: s.win,
    stars: starsOf(s),
    score: s.score,
    cuts: s.cuts,
    bestCombo: s.bestCombo,
    bestStroke: s.bestStroke,
  }
}
