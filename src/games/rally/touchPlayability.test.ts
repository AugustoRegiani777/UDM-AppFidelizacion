// Rally de Cocina: prueba objetiva de jugabilidad táctil. Un "conductor humano simulado" da 2 vueltas con
// la IA de rivales presente, pero SOLO puede tocar: mueve pulgares (posición en px, con ruido y retraso) y el
// modelo táctil traduce esas posiciones en controles. Se corre con el control ANTERIOR (cruceta de 4 botones,
// guardada en touchLegacy.ts), con "Un pulgar" (A) y con "Dos pulgares" (B), con el mismo conductor y el
// mismo "error humano". Los números van en docs/RALLY-CONTROLES.md.
import { afterEach, describe, expect, it } from 'vitest'
import { CAR_R, HW, ZERO, clamp, setRandom, wrapA, type Control } from './data.ts'
import { NOOP_HOOKS, RallySim, type Car, type SimHooks } from './sim.ts'
import { NRM, TAN, TP } from './track.ts'
import { LegacyTouchModel, legacyHitTest, legacyLayout, type LegacyButton } from './touchLegacy.ts'
import { TUNING, TouchControls, withIdleBrake, type PadConfig } from './touchModel.ts'

afterEach(() => setRandom(null))

/* ---------- azar determinista ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- el "error humano" ---------- */
export interface Human {
  /** Ruido de posición del pulgar, ± px (uniforme, se renueva a 30 Hz). */
  noisePx: number
  /** Retraso entre lo que decide el conductor y lo que llega al juego, en segundos. */
  delay: number
  /** Velocidad máxima del pulgar al desplazarse, px/s. */
  thumbSpeed: number
}
export const HUMAN: Human = { noisePx: 12, delay: 0.08, thumbSpeed: 1600 }

class Thumb {
  x: number
  y: number
  private nx = 0
  private ny = 0
  private noiseT = 0
  private readonly queue: { t: number; x: number; y: number }[] = []

  constructor(
    x: number,
    y: number,
    private readonly human: Human,
    private readonly rnd: () => number,
  ) {
    this.x = x
    this.y = y
    this.queue.push({ t: -1, x, y })
  }

  /** Mueve el pulgar hacia donde el conductor quiere (con retraso) y devuelve la posición que "ve" el juego. */
  step(now: number, wantX: number, wantY: number, dt: number) {
    this.queue.push({ t: now, x: wantX, y: wantY })
    while (this.queue.length > 1 && this.queue[1]!.t <= now - this.human.delay) this.queue.shift()
    const tgt = this.queue[0]!
    const dx = tgt.x - this.x
    const dy = tgt.y - this.y
    const d = Math.hypot(dx, dy)
    const m = this.human.thumbSpeed * dt
    if (d <= m) {
      this.x = tgt.x
      this.y = tgt.y
    } else {
      this.x += (dx / d) * m
      this.y += (dy / d) * m
    }
    this.noiseT -= dt
    if (this.noiseT <= 0) {
      this.noiseT = 1 / 30
      this.nx = (this.rnd() * 2 - 1) * this.human.noisePx
      this.ny = (this.rnd() * 2 - 1) * this.human.noisePx
    }
    return { x: this.x + this.nx, y: this.y + this.ny }
  }
}

/* ---------- lo que decide el conductor (independiente del control) ---------- */
interface Intent {
  /** > 0 a la izquierda. Continuo: el conductor "quiere" este giro. */
  steer: number
  pedal: 'gas' | 'brake'
}

class Driver {
  private stuck = 0
  private reverse = 0
  private revSteer = 0
  private pedal: 'gas' | 'brake' = 'gas'

  decide(c: Car, h: number): Intent {
    const spd = Math.hypot(c.vx, c.vz)
    if (this.reverse > 0) {
      this.reverse -= h
      this.pedal = 'brake'
      return { steer: this.revSteer, pedal: 'brake' }
    }
    const look = Math.round(7 + spd * 0.6)
    const ti = (c.idx + look) % TP.length
    const diff = wrapA(Math.atan2(TP[ti]!.x - c.x, TP[ti]!.z - c.z) - c.heading)
    const steer = clamp(diff * 2.4, -1, 1)
    const a = TAN[c.idx]!
    const b = TAN[(c.idx + Math.round(14 + spd * 0.8)) % TP.length]!
    const turn = Math.acos(clamp(a.x * b.x + a.z * b.z, -1, 1))
    const target = c.def.maxSpeed * 0.93 * (1 - clamp(turn / 1.8, 0, 1) * 0.5)
    // Histéresis de pedales: se queda con el que tenía hasta pasarse del umbral.
    if (c.vf > target + 3.5) this.pedal = 'brake'
    else if (c.vf < target + 1) this.pedal = 'gas'
    if (spd < 1.5) this.stuck += h
    else this.stuck = Math.max(0, this.stuck - h)
    if (this.stuck > 0.7) {
      this.stuck = 0
      this.reverse = 0.9
      this.revSteer = -Math.sign(diff || 1)
    }
    return { steer, pedal: this.pedal }
  }
}

/* ---------- los controles, manejados solo con la posición del pulgar ---------- */
interface Controller {
  frame(intent: Intent, now: number, dt: number, vf: number): Control
}

const VIEW = { w: 844, h: 390 }
const TOP = 60
const LEFT = { left: 0, top: TOP, right: VIEW.w / 2, bottom: VIEW.h }
const RIGHT = { left: VIEW.w / 2, top: TOP, right: VIEW.w - 118, bottom: VIEW.h }
const asControl = (s: {
  throttle: number
  brake: number
  steer: number
  handbrake: boolean
}): Control => ({
  throttle: s.throttle,
  brake: s.brake,
  steer: s.steer,
  handbrake: s.handbrake,
})

/** Cuánto hay que correr el pulgar para pedir ese giro (el conductor "sabe" cómo responde el control). */
function steerOffset(steer: number, R: number, sens: number) {
  const mag = Math.abs(steer)
  if (mag < 0.04) return 0
  const t = TUNING
  const dxR = (t.steerDeadEnter + mag * (t.steerFull - t.steerDeadEnter)) / sens
  return -Math.sign(steer) * dxR * R
}

/** Un pulgar (A): una sola superficie; la altura elige el pedal y el desplazamiento horizontal dobla. */
class OneThumb implements Controller {
  private readonly controls: TouchControls
  private readonly thumb: Thumb
  private readonly ox = 150
  private readonly R: number
  private readonly sens: number
  private readonly gasY: number
  private readonly brakeY: number

  constructor(human: Human, rnd: () => number, cfg: Partial<PadConfig> = {}) {
    this.controls = new TouchControls({ ...cfg, scheme: 'one' })
    this.R = this.controls.cfg.radius
    this.sens = this.controls.cfg.sensitivity
    this.controls.setLayout(LEFT, RIGHT)
    const h = LEFT.bottom - LEFT.top
    this.gasY = LEFT.top + h * 0.3
    this.brakeY = LEFT.top + h * 0.82
    this.thumb = new Thumb(this.ox, this.gasY, human, rnd)
    this.controls.down(1, 'left', this.ox, this.gasY)
  }

  frame(intent: Intent, now: number, dt: number, vf: number): Control {
    const y = intent.pedal === 'brake' ? this.brakeY : this.gasY
    const pos = this.thumb.step(now, this.ox + steerOffset(intent.steer, this.R, this.sens), y, dt)
    this.controls.move(1, pos.x, pos.y)
    const s = this.controls.step(dt)
    return withIdleBrake(asControl(s), s, vf)
  }
}

/** Dos pulgares (B): izquierda dirección, derecha pedales. */
class TwoThumbs implements Controller {
  private readonly controls: TouchControls
  private readonly steerThumb: Thumb
  private readonly pedalThumb: Thumb
  private readonly ox = 150
  private readonly px = 560
  private readonly R: number
  private readonly sens: number
  private readonly gasY: number
  private readonly brakeY: number

  constructor(human: Human, rnd: () => number, cfg: Partial<PadConfig> = {}) {
    this.controls = new TouchControls({ ...cfg, scheme: 'two' })
    this.R = this.controls.cfg.radius
    this.sens = this.controls.cfg.sensitivity
    this.controls.setLayout(LEFT, RIGHT)
    const h = RIGHT.bottom - RIGHT.top
    this.gasY = RIGHT.top + h * 0.3
    this.brakeY = RIGHT.top + h * 0.82
    this.steerThumb = new Thumb(this.ox, 250, human, rnd)
    this.pedalThumb = new Thumb(this.px, this.gasY, human, rnd)
    this.controls.down(1, 'left', this.ox, 250)
    this.controls.down(2, 'right', this.px, this.gasY)
  }

  frame(intent: Intent, now: number, dt: number, vf: number): Control {
    const sp = this.steerThumb.step(
      now,
      this.ox + steerOffset(intent.steer, this.R, this.sens),
      250,
      dt,
    )
    const pp = this.pedalThumb.step(
      now,
      this.px,
      intent.pedal === 'brake' ? this.brakeY : this.gasY,
      dt,
    )
    this.controls.move(1, sp.x, sp.y)
    this.controls.move(2, pp.x, pp.y)
    const s = this.controls.step(dt)
    return withIdleBrake(asControl(s), s, vf)
  }
}

/** Cruceta vieja con UN pulgar: solo puede estar en un botón; alterna a golpecitos ("pica") para doblar. */
class LegacyOneThumb implements Controller {
  /** `simple`: sin picar a golpecitos; apreta el botón de giro mientras haga falta (lo que hace casi todo el mundo). */
  simple = false
  private readonly model = new LegacyTouchModel()
  private readonly rects = legacyLayout(VIEW.w, VIEW.h)
  private readonly thumb: Thumb
  private readonly period = 0.24

  constructor(human: Human, rnd: () => number, simple = false) {
    this.simple = simple
    const up = this.rects.up
    this.thumb = new Thumb((up.left + up.right) / 2, (up.top + up.bottom) / 2, human, rnd)
    this.model.down(1, 'up')
  }

  private center(b: LegacyButton) {
    const r = this.rects[b]
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }
  }

  frame(intent: Intent, now: number, _dt: number, vf: number): Control {
    const phase = (now % this.period) / this.period
    // Un humano con la cruceta vieja no dobla (ni pica) si el auto está casi parado: primero acelera.
    const mag = Math.abs(vf) > 2.5 ? Math.abs(intent.steer) : 0
    let want: LegacyButton = intent.pedal === 'brake' ? 'down' : 'up'
    const press = this.simple ? mag > 0.35 : mag > 0.12 && phase < mag
    if (press) want = intent.steer > 0 ? 'left' : 'right'
    const c = this.center(want)
    const pos = this.thumb.step(now, c.x, c.y, 1 / 60)
    this.model.move(1, legacyHitTest(this.rects, pos.x, pos.y, 12))
    return asControl(this.model.state())
  }
}

/** Cota optimista de la cruceta vieja: un segundo dedo mantiene el pedal mientras el otro dobla. */
class LegacyTwoFingers implements Controller {
  private readonly model = new LegacyTouchModel()
  private readonly rects = legacyLayout(VIEW.w, VIEW.h)
  private readonly a: Thumb
  private readonly b: Thumb
  private readonly period = 0.24

  constructor(human: Human, rnd: () => number) {
    this.a = new Thumb(this.ctr('up').x, this.ctr('up').y, human, rnd)
    this.b = new Thumb(this.ctr('left').x, this.ctr('left').y, human, rnd)
    this.model.down(1, 'up')
    this.model.down(2, 'left')
  }
  private ctr(id: LegacyButton) {
    const r = this.rects[id]
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }
  }

  frame(intent: Intent, now: number): Control {
    const phase = (now % this.period) / this.period
    const mag = Math.abs(intent.steer)
    const pa = this.ctr(intent.pedal === 'brake' ? 'down' : 'up')
    const wantB: LegacyButton | null =
      mag > 0.12 && phase < mag ? (intent.steer > 0 ? 'left' : 'right') : null
    const pb = wantB ? this.ctr(wantB) : { x: this.b.x, y: this.b.y }
    const ra = this.a.step(now, pa.x, pa.y, 1 / 60)
    const rb = this.b.step(now, pb.x, pb.y, 1 / 60)
    this.model.move(1, legacyHitTest(this.rects, ra.x, ra.y, 12))
    this.model.move(2, legacyHitTest(this.rects, rb.x, rb.y, 12))
    return asControl(this.model.state())
  }
}

/* ---------- la carrera ---------- */
export interface RunResult {
  finished: boolean
  time: number
  /** % del tiempo de carrera con el auto raspando el borde (muro). */
  offPct: number
  /** Golpes fuertes del jugador (contra el muro o contra otros autos). */
  crashes: number
  /** % del tiempo trabado o en marcha atrás. */
  stuckPct: number
}

type Kind = 'A' | 'B' | 'legacy1' | 'legacy1simple' | 'legacy2'
const LIMIT = 300
const DT = 1 / 60

export function simulateRace(
  kind: Kind,
  seed: number,
  opts: {
    human?: Human
    pad?: Partial<PadConfig>
    car?: string
    laps?: number
    trace?: (t: number, car: Car, pin: Control) => void
  } = {},
): RunResult {
  const human = opts.human ?? HUMAN
  setRandom(mulberry32(seed))
  const noise = mulberry32(seed * 7919 + 13)
  let crashes = 0
  let player: Car | null = null
  const hooks: SimHooks = {
    ...NOOP_HOOKS,
    sfx(name, x, z) {
      if (name === 'bump' && player && x !== undefined && z !== undefined)
        if (Math.hypot(x - player.x, z - player.z) < 3) crashes++
    },
  }
  const sim = new RallySim(hooks, {
    car: opts.car ?? 'chispa',
    laps: opts.laps ?? 2,
    rivals: 3,
    diff: 'normal',
  })
  sim.startRace(false)
  player = sim.player!
  const driver = new Driver()
  const ctl: Controller =
    kind === 'A'
      ? new OneThumb(human, noise, opts.pad)
      : kind === 'B'
        ? new TwoThumbs(human, noise, opts.pad)
        : kind === 'legacy1' || kind === 'legacy1simple'
          ? new LegacyOneThumb(human, noise, kind === 'legacy1simple')
          : new LegacyTwoFingers(human, noise)

  let now = 0
  let off = 0
  let stuck = 0
  let raceTime = 0
  const lim = HW - CAR_R - 0.15
  while (now < LIMIT + 5 && sim.state !== 'finished') {
    let pin: Control = ZERO
    if (sim.state === 'race') {
      const intent = driver.decide(player, DT)
      pin = ctl.frame(intent, now, DT, player.vf)
      raceTime += DT
      opts.trace?.(raceTime, player, pin)
      const p = TP[player.idx]!
      const n = NRM[player.idx]!
      const lat = (player.x - p.x) * n.x + (player.z - p.z) * n.z
      if (Math.abs(lat) > lim) off += DT
      if (Math.hypot(player.vx, player.vz) < 1.5 || player.vf < -0.5) stuck += DT
      if (raceTime > LIMIT) break
    }
    sim.update(DT, pin)
    now += DT
  }
  const finished = sim.state === 'finished' || player.finished
  return {
    finished,
    time: finished ? player.finishTime : raceTime,
    offPct: (off / Math.max(raceTime, 1e-6)) * 100,
    crashes,
    stuckPct: (stuck / Math.max(raceTime, 1e-6)) * 100,
  }
}

export interface Summary {
  finishedRuns: number
  runs: number
  time: number
  offPct: number
  crashes: number
  stuckPct: number
}
export function summarize(rs: RunResult[]): Summary {
  const mean = (f: (r: RunResult) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length
  return {
    finishedRuns: rs.filter((r) => r.finished).length,
    runs: rs.length,
    time: mean((r) => r.time),
    offPct: mean((r) => r.offPct),
    crashes: mean((r) => r.crashes),
    stuckPct: mean((r) => r.stuckPct),
  }
}
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1)
const batch = (kind: Kind, opts = {}) => summarize(SEEDS.map((s) => simulateRace(kind, s, opts)))
const fmt = (s: Summary) =>
  `terminó ${s.finishedRuns}/${s.runs} · tiempo ${s.time.toFixed(1)} s · fuera ${s.offPct.toFixed(1)} % · choques ${s.crashes.toFixed(1)} · trabado ${s.stuckPct.toFixed(1)} %`

describe('jugador táctil simulado: 2 vueltas con rivales, anterior vs. Un pulgar (A) vs. Dos pulgares (B)', () => {
  it('A y B son claramente mejores que la cruceta anterior con el mismo error humano', () => {
    const a = batch('A')
    const b = batch('B')
    const experto = batch('legacy1')
    const simple = batch('legacy1simple')
    const dos = batch('legacy2')
    console.log('A Un pulgar            ', fmt(a))
    console.log('B Dos pulgares         ', fmt(b))
    console.log('ANTERIOR 1 pulgar simple', fmt(simple))
    console.log('ANTERIOR 1 pulgar experto', fmt(experto))
    console.log('ANTERIOR 2 dedos        ', fmt(dos))
    for (const n of [a, b]) {
      expect(n.finishedRuns).toBe(n.runs)
      // Un pulgar en la cruceta vieja no puede acelerar y doblar a la vez: el que aprieta el botón de giro tarda el doble.
      expect(n.time).toBeLessThan(simple.time * 0.6)
      // El experto que "pica" a golpecitos (4 veces por segundo, saltando entre botones) sigue siendo más lento.
      expect(n.time).toBeLessThan(experto.time * 0.92)
      // Y con dos dedos en la cruceta (cota optimista) el giro todo-o-nada se estrella mucho más.
      expect(n.offPct).toBeLessThan(dos.offPct * 0.5)
      expect(n.crashes).toBeLessThan(dos.crashes * 0.3)
      expect(n.time).toBeLessThan(dos.time)
    }
  }, 180_000)

  it('aguantan más ruido en el pulgar (±20 px) y más retraso (120 ms)', () => {
    const duro: Human = { noisePx: 20, delay: 0.12, thumbSpeed: 1400 }
    const a = batch('A', { human: duro })
    const b = batch('B', { human: duro })
    const simple = batch('legacy1simple', { human: duro })
    const experto = batch('legacy1', { human: duro })
    console.log('A ±20/120ms            ', fmt(a))
    console.log('B ±20/120ms            ', fmt(b))
    console.log('ANTERIOR simple ±20/120', fmt(simple))
    console.log('ANTERIOR experto ±20/120', fmt(experto))
    expect(a.finishedRuns).toBe(a.runs)
    expect(b.finishedRuns).toBe(b.runs)
    expect(a.time).toBeLessThan(experto.time * 0.92)
    expect(b.time).toBeLessThan(experto.time * 0.92)
  }, 180_000)
})

describe.skipIf(!process.env.RALLY_SWEEP)('barrido de constantes', () => {
  it('derrape y giro', () => {
    const base = { ...TUNING }
    const run = (label: string, patch: Partial<typeof TUNING>, kind: Kind = 'A') => {
      Object.assign(TUNING, base, patch)
      console.log(label.padEnd(34), fmt(batch(kind)))
    }
    run('base', {})
    run('sin derrape (driftMin 9)', { driftMin: 9 })
    for (const duty of [0.25, 0.5, 0.75, 1])
      for (const br of [0.2, 0.35, 0.6, 1])
        run(`derrape duty ${duty} freno ${br}`, { driftDuty: duty, driftBrake: br })
    for (const c of [1, 1.2, 1.5]) run(`curva ${c}`, { steerCurve: c })
    for (const [r, f] of [
      [6, 10],
      [9, 14],
      [14, 20],
    ] as const)
      run(`rampa ${r}/${f}`, { rise: r, fall: f })
    Object.assign(TUNING, base)
  }, 600_000)
})

describe.skipIf(!process.env.RALLY_TRACE)('traza', () => {
  it('traza', () => {
    let last = -1
    simulateRace((process.env.RALLY_TRACE as Kind) || 'A', 1, {
      trace: (t, c, p) => {
        if (Math.floor(t * 2) !== last && t < 40) {
          last = Math.floor(t * 2)
          console.log(
            t.toFixed(1),
            c.vf.toFixed(1),
            c.idx,
            p.throttle,
            p.brake,
            p.steer.toFixed(2),
            p.handbrake,
          )
        }
      },
    })
  })
})
