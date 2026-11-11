// Rally de Cocina: simulación (física del auto, IA, ítems, vueltas). No toca el DOM ni three:
// todo lo que se ve u oye sale por los `hooks`. Es la misma lógica de la demo del dueño.
import {
  CAR_R,
  CARS,
  FLIP_T,
  GRAV,
  HW,
  ITEM_KEYS,
  ITEM_NAMES,
  N,
  PULSE_R,
  ZERO,
  clamp,
  fmt,
  rand,
  random,
  wrapA,
  type CarDef,
  type Control,
  type ItemKey,
  type RallySettings,
} from './data.ts'
import { NRM, TAN, TP, groundAt, idxBack, nearestIdx, pickupSpots } from './track.ts'

export type SfxName =
  | 'beep'
  | 'go'
  | 'pickup'
  | 'got'
  | 'turbo'
  | 'rocket'
  | 'boom'
  | 'bump'
  | 'zap'
  | 'oil'
  | 'drop'
  | 'lap'
  | 'finish'
  | 'land'
  | 'hit'

export type RaceState = 'menu' | 'countdown' | 'race' | 'finished' | 'paused'

export interface Car {
  def: CarDef
  isPlayer: boolean
  ai: boolean
  x: number
  z: number
  y: number
  vy: number
  heading: number
  vx: number
  vz: number
  vf: number
  vl: number
  steer: number
  thrVis: number
  idx: number
  lapsDone: number
  maxLap: number
  lapStart: number
  lapTimes: number[]
  bestLap: number
  finished: boolean
  finishTime: number
  place: number
  pos: number
  item: ItemKey | null
  itemHeld: number
  itemDelay: number
  rolling: number
  turbo: number
  stun: number
  slip: number
  zap: number
  spinVel: number
  flipT: number
  flipDir: number
  invuln: number
  blink: number
  airborne: boolean
  lane: number
  laneT: number
  avoid: number
  stuckT: number
  stuckN: number
  reverseT: number
  revSteer: number
  turnAhead: number
  speedMult: number
  baseMult: number
  pitch: number
  roll: number
  dive: number
  antA: number
  antV: number
  antB: number
  antVb: number
  squash: number
  resetCD: number
  bumpCD: number
  newRecord: boolean
}

export interface Rocket {
  x: number
  z: number
  y: number
  heading: number
  speed: number
  life: number
  age: number
  owner: Car
  target: Car | null
  idx: number
}
export interface Oil {
  x: number
  z: number
  life: number
  age: number
  owner: Car
}
export interface Pickup {
  x: number
  z: number
  active: boolean
  respawn: number
  phase: number
  pop: number
}

/** Todo lo que la simulación necesita del mundo exterior (imagen, sonido, mensajes). */
export interface SimHooks {
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    size: number,
    life: number,
    grav: number,
  ): void
  sfx(name: SfxName, x?: number, z?: number, k?: number): void
  toast(text: string): void
  bigMsg(text: string, long?: boolean): void
  fx(kind: 'explode' | 'pulse', x: number, y: number, z: number, follow?: Car): void
  onClear(): void
  onCarCreated(car: Car): void
  onRaceStarted(attract: boolean): void
  onRocketSpawn(r: Rocket): void
  onRocketRemove(r: Rocket): void
  onOilSpawn(o: Oil): void
  onOilRemove(o: Oil): void
  /** Guarda la mejor vuelta; devuelve true si es récord personal. */
  saveBest(carId: string, lap: number): boolean
}

export const NOOP_HOOKS: SimHooks = {
  emit() {},
  sfx() {},
  toast() {},
  bigMsg() {},
  fx() {},
  onClear() {},
  onCarCreated() {},
  onRaceStarted() {},
  onRocketSpawn() {},
  onRocketRemove() {},
  onOilSpawn() {},
  onOilRemove() {},
  saveBest: () => false,
}

export function makeCar(def: CarDef, isPlayer: boolean): Car {
  return {
    def,
    isPlayer,
    ai: !isPlayer,
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    vf: 0,
    vl: 0,
    steer: 0,
    thrVis: 0,
    idx: 0,
    lapsDone: -1,
    maxLap: -1,
    lapStart: 0,
    lapTimes: [],
    bestLap: Infinity,
    finished: false,
    finishTime: 0,
    place: 0,
    pos: 1,
    item: null,
    itemHeld: 0,
    itemDelay: 0,
    rolling: 0,
    turbo: 0,
    stun: 0,
    slip: 0,
    zap: 0,
    spinVel: 0,
    flipT: 0,
    flipDir: 1,
    invuln: 0,
    blink: 0,
    airborne: false,
    lane: 0,
    laneT: random() * 10,
    avoid: 0,
    stuckT: 0,
    stuckN: 0,
    reverseT: 0,
    revSteer: 0,
    turnAhead: 0,
    speedMult: 1,
    baseMult: 1,
    pitch: 0,
    roll: 0,
    dive: 0,
    antA: 0,
    antV: 0,
    antB: 0,
    antVb: 0,
    squash: 0,
    resetCD: 0,
    bumpCD: 0,
    newRecord: false,
  }
}

const DIFF_MULT = { easy: 0.84, normal: 0.93, hard: 1.0 }

export class RallySim {
  state: RaceState = 'menu'
  prevState: RaceState = 'race'
  attract = true
  cars: Car[] = []
  ranked: Car[] = []
  player: Car | null = null
  raceTime = 0
  countdown = 0
  finishCount = 0
  totalLaps = 3
  resultsTimer = 0
  time = 0
  readonly rockets: Rocket[] = []
  readonly oils: Oil[] = []
  readonly pickups: Pickup[] = pickupSpots.map((p) => ({
    x: p.x,
    z: p.z,
    active: true,
    respawn: 0,
    phase: random() * 6,
    pop: 0,
  }))
  settings: RallySettings

  constructor(
    private readonly hooks: SimHooks,
    settings: RallySettings,
  ) {
    this.settings = { ...settings }
  }

  progress(c: Car) {
    return c.lapsDone * N + c.idx
  }

  /* ---------- carrera ---------- */
  clearRace() {
    this.hooks.onClear()
    this.cars = []
    this.ranked = []
    this.player = null
    for (const r of this.rockets) this.hooks.onRocketRemove(r)
    this.rockets.length = 0
    for (const o of this.oils) this.hooks.onOilRemove(o)
    this.oils.length = 0
    for (const p of this.pickups) {
      p.active = true
      p.respawn = 0
    }
  }

  startRace(isAttract: boolean) {
    this.clearRace()
    this.attract = isAttract
    this.finishCount = 0
    this.raceTime = 0
    this.resultsTimer = 0
    this.totalLaps = isAttract ? 999 : this.settings.laps
    let defs: CarDef[]
    if (isAttract) defs = CARS.slice()
    else {
      const mine = CARS.find((c) => c.id === this.settings.car) ?? CARS[0]!
      const others = CARS.filter((c) => c !== mine).sort(() => random() - 0.5)
      defs = [mine, ...others.slice(0, this.settings.rivals)]
    }
    // Vos salís al final de la parrilla.
    const order = isAttract ? defs : [...defs.slice(1), defs[0]!]
    const diffMult = DIFF_MULT[this.settings.diff] || 0.93
    order.forEach((def, k) => {
      const row = Math.floor(k / 2)
      const col = k % 2
      const i = idxBack(6 + row * 7)
      const p = TP[i]!
      const n = NRM[i]!
      const t = TAN[i]!
      const lat = (col ? -1 : 1) * 2.4
      const car = makeCar(def, !isAttract && def === defs[0])
      car.x = p.x + n.x * lat
      car.z = p.z + n.z * lat
      car.heading = Math.atan2(t.x, t.z)
      car.idx = i
      car.lane = clamp(lat * 0.5 + rand(-1.2, 1.2), -(HW - 1.6), HW - 1.6)
      car.baseMult = car.speedMult = car.isPlayer
        ? 1
        : isAttract
          ? 0.95
          : diffMult + rand(-0.025, 0.025)
      this.cars.push(car)
      if (car.isPlayer) this.player = car
      this.hooks.onCarCreated(car)
    })
    this.computePositions()
    this.hooks.onRaceStarted(isAttract)
    if (isAttract) this.state = 'menu'
    else {
      this.state = 'countdown'
      this.countdown = 4
    }
  }

  togglePause(now?: () => void) {
    if (this.state === 'race' || this.state === 'countdown') {
      this.prevState = this.state
      this.state = 'paused'
    } else if (this.state === 'paused') {
      this.state = this.prevState
      now?.()
    }
  }

  computePositions() {
    this.ranked = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place
      if (a.finished) return -1
      if (b.finished) return 1
      return this.progress(b) - this.progress(a)
    })
    this.ranked.forEach((c, i) => (c.pos = i + 1))
  }

  /* ---------- actualización por cuadro ---------- */
  update(dt: number, pin: Control) {
    this.time += dt
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.countdown)
      this.countdown -= dt
      const cur = Math.ceil(this.countdown)
      if (cur !== prev && cur > 0 && cur <= 3) {
        this.hooks.bigMsg(String(cur))
        this.hooks.sfx('beep')
      }
      if (this.countdown <= 0) {
        this.state = 'race'
        this.raceTime = 0
        this.hooks.bigMsg('¡YA!')
        this.hooks.sfx('go')
      }
    }
    if (this.state === 'race' || this.state === 'finished' || this.state === 'menu')
      this.raceTime += dt
    const player = this.player
    if (!this.attract && player && !player.finished) {
      for (const c of this.cars) {
        if (c.isPlayer) continue
        const gap = this.progress(c) - this.progress(player)
        c.speedMult = c.baseMult + clamp(-gap / 90, -1, 1) * 0.06
      }
    }
    const steps = Math.max(1, Math.ceil(dt / 0.0125))
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      for (const c of this.cars)
        this.stepCar(c, h, this.state === 'countdown' ? ZERO : this.controlFor(c, h, pin))
      this.collideCars()
      this.updateRockets(h)
    }
    for (const c of this.cars) {
      this.timers(c, dt)
      if (this.state !== 'countdown' && (c.ai || c.finished)) this.aiItems(c)
      this.checkPickups(c)
      this.checkOils(c)
      this.emitCarFx(c, dt)
    }
    this.updatePickups(dt)
    this.updateOils(dt)
    this.computePositions()
  }

  private controlFor(c: Car, h: number, pin: Control): Control {
    if (c.isPlayer && !c.finished && this.state === 'race') return pin
    return this.aiControl(c, h)
  }

  /* ---------- física ---------- */
  stepCar(c: Car, h: number, ctrl: Control) {
    const d = c.def
    const fx_ = Math.sin(c.heading)
    const fz_ = Math.cos(c.heading)
    const lx = fz_
    const lz = -fx_
    let vf = c.vx * fx_ + c.vz * fz_
    let vl = c.vx * lx + c.vz * lz
    const prevVf = vf
    let thr = ctrl.throttle
    let brk = ctrl.brake
    let st = ctrl.steer
    if (c.stun > 0) {
      thr = 0
      brk = 0
      st *= 0.25
    }
    c.steer += (st - c.steer) * Math.min(1, h * 9)
    c.thrVis = thr
    let turn = 0
    if (!c.airborne) {
      let maxS = d.maxSpeed * c.speedMult
      let acc = d.accel
      if (c.turbo > 0) {
        maxS *= 1.42
        acc *= 1.9
      }
      if (thr > 0) {
        if (vf < 0) vf += 38 * thr * h
        else vf += acc * thr * h * clamp((maxS - vf) / (maxS * 0.35), 0, 1)
      }
      if (brk > 0) {
        if (vf > 0.3) vf -= 42 * brk * h
        else if (vf > -9) vf -= 15 * brk * h
      }
      if (thr <= 0 && brk <= 0) vf -= vf * 1.2 * h
      if (vf > maxS) vf -= (vf - maxS) * 2.5 * h
      let grip = d.grip
      if (ctrl.handbrake) grip *= 0.22
      if (c.slip > 0) grip *= 0.12
      vl *= Math.exp(-grip * h)
      if (ctrl.handbrake) vf -= vf * 0.6 * h
      const av = Math.abs(vf)
      const sk = clamp(av / 4, 0, 1) * (1 - 0.38 * clamp(av / 40, 0, 1))
      turn = c.steer * d.steer * sk * (vf >= 0 ? 1 : -1) * (ctrl.handbrake ? 1.4 : 1)
    } else vf -= vf * 0.1 * h
    c.vx = fx_ * vf + lx * vl
    c.vz = fz_ * vf + lz * vl
    c.heading += turn * h
    if (c.spinVel) {
      c.heading += c.spinVel * h
      c.spinVel *= Math.exp(-2.4 * h)
      if (Math.abs(c.spinVel) < 0.08) c.spinVel = 0
    }
    const gOld = groundAt(c.x, c.z)
    c.x += c.vx * h
    c.z += c.vz * h
    const gNew = groundAt(c.x, c.z)
    if (c.airborne) {
      c.vy -= GRAV * h
      c.y += c.vy * h
      if (c.y <= gNew) {
        if (c.vy < -7) {
          c.squash = 0.25
          this.landDust(c)
          if (c.isPlayer) this.hooks.sfx('land')
        }
        c.y = gNew
        c.vy = 0
        c.airborne = false
      }
    } else if (gNew >= gOld - 1e-4) {
      c.vy = Math.min((gNew - gOld) / h, 14)
      c.y = gNew
    } else {
      c.airborne = true
      c.vy -= GRAV * h
      c.y += c.vy * h
      if (c.y <= gNew) {
        c.y = gNew
        c.vy = 0
        c.airborne = false
      }
    }
    this.trackCollide(c)
    // movimiento del cuerpo (solo para que se vea bien)
    const acc = (vf - prevVf) / h
    const latAcc = turn * vf
    c.vf = vf
    c.vl = vl
    const pt =
      -Math.atan(c.vy / Math.max(Math.abs(vf), 3)) * (vf >= 0 ? 1 : -1) * (c.airborne ? 0.6 : 1)
    c.pitch += (clamp(pt, -0.6, 0.6) - c.pitch) * Math.min(1, h * 14)
    c.roll += (clamp(latAcc * 0.006, -0.13, 0.13) - c.roll) * Math.min(1, h * 8)
    c.dive += (clamp(-acc * 0.0035, -0.07, 0.07) - c.dive) * Math.min(1, h * 8)
    c.antV += (-70 * c.antA - 5 * c.antV - acc * 0.04) * h
    c.antA = clamp(c.antA + c.antV * h, -0.7, 0.7)
    c.antVb += (-70 * c.antB - 5 * c.antVb + latAcc * 0.025) * h
    c.antB = clamp(c.antB + c.antVb * h, -0.7, 0.7)
  }

  private trackCollide(c: Car) {
    const ni = nearestIdx(c.x, c.z, c.idx)
    const dl = ni - c.idx
    if (dl < -N / 2) this.onCross(c, 1)
    else if (dl > N / 2) this.onCross(c, -1)
    c.idx = ni
    const p = TP[ni]!
    const n = NRM[ni]!
    const lat = (c.x - p.x) * n.x + (c.z - p.z) * n.z
    const lim = HW - CAR_R
    if (Math.abs(lat) > lim) {
      const s = lat > 0 ? 1 : -1
      const pen = Math.abs(lat) - lim
      c.x -= n.x * s * pen
      c.z -= n.z * s * pen
      const vn = (c.vx * n.x + c.vz * n.z) * s
      if (vn > 0) {
        c.vx -= n.x * s * vn * 1.3
        c.vz -= n.z * s * vn * 1.3
        c.vx *= 0.992
        c.vz *= 0.992
        if (vn > 5 && c.bumpCD <= 0) {
          c.bumpCD = 0.25
          for (let i = 0; i < 6; i++)
            this.hooks.emit(
              c.x + n.x * s * CAR_R,
              c.y + 0.3,
              c.z + n.z * s * CAR_R,
              rand(-3, 3),
              rand(1, 4),
              rand(-3, 3),
              i % 2 ? 0xffd23f : 0xffffff,
              rand(0.08, 0.16),
              0.3,
              14,
            )
          this.hooks.sfx('bump', c.x, c.z, Math.min(1, vn / 14))
        }
      }
    }
  }

  private onCross(c: Car, dir: number) {
    if (dir < 0) {
      c.lapsDone--
      return
    }
    c.lapsDone++
    if (c.lapsDone <= c.maxLap) return
    c.maxLap = c.lapsDone
    if (c.lapsDone >= 1) {
      const lt = this.raceTime - c.lapStart
      c.lapTimes.push(lt)
      c.lapStart = this.raceTime
      if (lt < c.bestLap) {
        c.bestLap = lt
        if (c.isPlayer && c.lapTimes.length > 1 && !c.finished)
          this.hooks.toast('Vuelta rápida ' + fmt(lt))
      }
      if (c.isPlayer && !this.attract && c.lapsDone < this.totalLaps) this.hooks.sfx('lap')
    }
    if (!this.attract && c.lapsDone >= this.totalLaps && !c.finished) {
      c.finished = true
      c.finishTime = this.raceTime
      c.place = ++this.finishCount
      if (c.isPlayer) this.onPlayerFinish(c)
    } else if (
      c.isPlayer &&
      !this.attract &&
      this.totalLaps > 1 &&
      c.lapsDone === this.totalLaps - 1
    )
      this.hooks.bigMsg('ÚLTIMA VUELTA', true)
  }

  private onPlayerFinish(player: Car) {
    this.state = 'finished'
    this.hooks.bigMsg(player.place === 1 ? '¡GANASTE!' : '¡META!')
    this.hooks.sfx('finish')
    this.resultsTimer = 2.6
    if (isFinite(player.bestLap))
      player.newRecord = this.hooks.saveBest(player.def.id, player.bestLap)
  }

  collideCars() {
    const R = 1.5
    const cars = this.cars
    for (let i = 0; i < cars.length; i++)
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i]!
        const b = cars[j]!
        if (Math.abs(a.y - b.y) > 1.1) continue
        const dx = b.x - a.x
        const dz = b.z - a.z
        const d2 = dx * dx + dz * dz
        if (d2 < R * R && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const nx = dx / d
          const nz = dz / d
          const ma = a.def.mass
          const mb = b.def.mass
          const pen = R - d
          a.x -= (nx * pen * mb) / (ma + mb)
          a.z -= (nz * pen * mb) / (ma + mb)
          b.x += (nx * pen * ma) / (ma + mb)
          b.z += (nz * pen * ma) / (ma + mb)
          const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz
          if (rv < 0) {
            const jj = (-1.3 * rv) / (1 / ma + 1 / mb)
            a.vx -= (jj / ma) * nx
            a.vz -= (jj / ma) * nz
            b.vx += (jj / mb) * nx
            b.vz += (jj / mb) * nz
            if (-rv > 5 && (a.isPlayer || b.isPlayer) && a.bumpCD <= 0) {
              a.bumpCD = 0.25
              this.hooks.sfx('bump', a.x, a.z, Math.min(1, -rv / 12))
            }
          }
        }
      }
  }

  resetCar(c: Car) {
    const i = c.idx
    const p = TP[i]!
    const t = TAN[i]!
    c.x = p.x
    c.z = p.z
    c.y = groundAt(p.x, p.z)
    c.vx = c.vz = c.vy = 0
    c.vf = 0
    c.heading = Math.atan2(t.x, t.z)
    c.airborne = false
    c.spinVel = 0
    c.slip = 0
    c.flipT = 0
    c.stun = 0.3
    c.invuln = 1.5
    c.blink = 1.2
    c.stuckT = 0
    c.reverseT = 0
    for (let k = 0; k < 10; k++)
      this.hooks.emit(
        c.x,
        c.y + 0.5,
        c.z,
        rand(-2, 2),
        rand(1, 4),
        rand(-2, 2),
        0xffffff,
        rand(0.1, 0.2),
        0.5,
        6,
      )
  }

  /* ---------- IA ---------- */
  aiControl(c: Car, h: number): Control {
    const spd = Math.hypot(c.vx, c.vz)
    if (c.reverseT > 0) {
      c.reverseT -= h
      return { throttle: 0, brake: 1, steer: c.revSteer, handbrake: false }
    }
    c.laneT += h * 0.35
    const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) }
    let avoidTarget = 0
    for (const o of this.cars) {
      if (o === c) continue
      const dx = o.x - c.x
      const dz = o.z - c.z
      const ahead = dx * f.x + dz * f.z
      if (ahead < 0.5 || ahead > 7) continue
      const side = dx * f.z - dz * f.x
      if (Math.abs(side) < 1.6) avoidTarget = side > 0 ? -2.4 : 2.4
    }
    for (const o of this.oils) {
      const dx = o.x - c.x
      const dz = o.z - c.z
      const ahead = dx * f.x + dz * f.z
      if (ahead < 1 || ahead > 12) continue
      const side = dx * f.z - dz * f.x
      if (Math.abs(side) < 2.4) avoidTarget = side > 0 ? -3 : 3
    }
    c.avoid += (avoidTarget - c.avoid) * Math.min(1, h * 3)
    const lane = clamp(c.lane + Math.sin(c.laneT) * 1.3 + c.avoid, -(HW - 1.3), HW - 1.3)
    const ti = (c.idx + Math.round(8 + spd * 0.5)) % N
    const tx = TP[ti]!.x + NRM[ti]!.x * lane
    const tz = TP[ti]!.z + NRM[ti]!.z * lane
    const diff = wrapA(Math.atan2(tx - c.x, tz - c.z) - c.heading)
    const steer = clamp(diff * 2.6, -1, 1)
    const a = TAN[c.idx]!
    const b = TAN[(c.idx + Math.round(14 + spd * 0.8)) % N]!
    const turnAmt = Math.acos(clamp(a.x * b.x + a.z * b.z, -1, 1))
    c.turnAhead = turnAmt
    let target =
      c.def.maxSpeed *
      c.speedMult *
      (c.turbo > 0 ? 1.4 : 1) *
      (1 - clamp(turnAmt / 1.8, 0, 1) * 0.45)
    if (Math.abs(diff) > 1.2) target = Math.min(target, 10)
    let thr = 1
    let brk = 0
    if (c.vf > target + 1) {
      thr = 0
      brk = clamp((c.vf - target) / 10, 0.15, 1)
    }
    if (c.stun <= 0) {
      if (spd < 1.2) c.stuckT += h
      else {
        c.stuckT = Math.max(0, c.stuckT - h)
        if (spd > 6) c.stuckN = 0
      }
    }
    if (c.stuckT > 1) {
      c.stuckT = 0
      c.stuckN++
      if (c.stuckN >= 3) {
        this.resetCar(c)
        c.stuckN = 0
      } else {
        c.reverseT = 0.8
        c.revSteer = -Math.sign(diff || 1)
      }
    }
    return { throttle: thr, brake: brk, steer, handbrake: false }
  }

  targetFor(c: Car): Car | null {
    const i = this.ranked.indexOf(c)
    if (i > 0) {
      const t = this.ranked[i - 1]!
      if (Math.hypot(t.x - c.x, t.z - c.z) < 90) return t
    }
    let best: Car | null = null
    let bd = 50
    const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) }
    for (const o of this.cars) {
      if (o === c) continue
      const dx = o.x - c.x
      const dz = o.z - c.z
      const d = Math.hypot(dx, dz)
      if (d < bd && (dx * f.x + dz * f.z) / d > 0.5) {
        bd = d
        best = o
      }
    }
    return best
  }

  private aiItems(c: Car) {
    if (!c.item || c.itemDelay > 0) return
    let use = false
    if (c.item === 'turbo') use = c.turnAhead < 0.3 && c.stun <= 0
    else if (c.item === 'rocket') {
      const t = this.targetFor(c)
      use = !!t && Math.hypot(t.x - c.x, t.z - c.z) < 45
    } else if (c.item === 'oil') {
      const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) }
      use = this.cars.some((o) => {
        if (o === c) return false
        const dx = o.x - c.x
        const dz = o.z - c.z
        const ah = dx * f.x + dz * f.z
        return ah < -1 && ah > -16 && Math.abs(dx * f.z - dz * f.x) < 3
      })
    } else if (c.item === 'pulse')
      use = this.cars.some((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < PULSE_R * 0.8)
    if (c.itemHeld > 9) use = true
    if (use) this.useItem(c)
  }

  /* ---------- ítems ---------- */
  rollItem(c: Car): ItemKey {
    const n = this.cars.length
    const r = n > 1 ? (c.pos - 1) / (n - 1) : 0.5
    const w: Record<ItemKey, number> = {
      turbo: 1 + r * 1.4,
      rocket: 0.5 + r * 1.8,
      oil: 1.5 - r * 0.9,
      pulse: 0.9 + r * 0.3,
    }
    let tot = 0
    for (const k of ITEM_KEYS) tot += w[k]
    let x = random() * tot
    for (const k of ITEM_KEYS) {
      x -= w[k]
      if (x <= 0) return k
    }
    return 'turbo'
  }

  private collect(c: Car, p: Pickup) {
    p.active = false
    p.respawn = 4.5
    for (let i = 0; i < 12; i++)
      this.hooks.emit(
        p.x,
        1,
        p.z,
        rand(-4, 4),
        rand(2, 6),
        rand(-4, 4),
        i % 2 ? 0xffd23f : 0x16a3a0,
        rand(0.12, 0.22),
        0.5,
        14,
      )
    if (c.item || c.rolling > 0) return
    if (c.isPlayer) {
      c.rolling = 0.9
      this.hooks.sfx('pickup')
    } else {
      c.item = this.rollItem(c)
      c.itemDelay = rand(0.6, 2.2)
      c.itemHeld = 0
    }
  }

  useItem(c: Car) {
    const it = c.item
    if (!it) return
    c.item = null
    c.itemHeld = 0
    if (it === 'turbo') {
      c.turbo = 2.6
      this.hooks.sfx('turbo', c.x, c.z)
      if (c.isPlayer) this.hooks.toast('¡TURBO!')
    } else if (it === 'rocket') this.spawnRocket(c)
    else if (it === 'oil') this.spawnOil(c)
    else if (it === 'pulse') this.doPulse(c)
  }

  /** El botón del ítem: solo en carrera y si hay un ítem ya sorteado. */
  tryUseItem() {
    const p = this.player
    if (this.state === 'race' && p && p.item && p.rolling <= 0 && !p.finished) this.useItem(p)
  }
  tryReset() {
    const p = this.player
    if (this.state === 'race' && p && p.resetCD <= 0 && !p.finished) {
      this.resetCar(p)
      p.resetCD = 1.2
    }
  }

  private spawnRocket(c: Car) {
    const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) }
    const r: Rocket = {
      x: c.x + f.x * 1.4,
      z: c.z + f.z * 1.4,
      y: c.y + 0.55,
      heading: c.heading,
      speed: Math.max(50, Math.abs(c.vf) + 22),
      life: 4.5,
      age: 0,
      owner: c,
      target: this.targetFor(c),
      idx: c.idx,
    }
    this.rockets.push(r)
    this.hooks.onRocketSpawn(r)
    this.hooks.sfx('rocket', c.x, c.z)
  }

  private latOf(c: Car) {
    const p = TP[c.idx]!
    const n = NRM[c.idx]!
    return (c.x - p.x) * n.x + (c.z - p.z) * n.z
  }

  private updateRockets(h: number) {
    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const r = this.rockets[k]!
      r.life -= h
      r.age += h
      const T = r.target
      const ai = (r.idx + 16) % N
      let tx: number
      let tz: number
      if (T) {
        const dT = Math.hypot(T.x - r.x, T.z - r.z)
        if (dT < 16) {
          tx = T.x
          tz = T.z
        } else {
          const lt = clamp(this.latOf(T), -(HW - 1.2), HW - 1.2)
          tx = TP[ai]!.x + NRM[ai]!.x * lt
          tz = TP[ai]!.z + NRM[ai]!.z * lt
        }
      } else {
        tx = TP[ai]!.x
        tz = TP[ai]!.z
      }
      const df = wrapA(Math.atan2(tx - r.x, tz - r.z) - r.heading)
      r.heading += clamp(df, -5 * h, 5 * h)
      r.x += Math.sin(r.heading) * r.speed * h
      r.z += Math.cos(r.heading) * r.speed * h
      r.y += (groundAt(r.x, r.z) + 0.55 - r.y) * Math.min(1, h * 10)
      r.idx = nearestIdx(r.x, r.z, r.idx)
      const p = TP[r.idx]!
      const n = NRM[r.idx]!
      const lat = (r.x - p.x) * n.x + (r.z - p.z) * n.z
      let dead = r.life <= 0 || Math.abs(lat) > HW - 0.1
      if (!dead)
        for (const c of this.cars) {
          if (c === r.owner) continue
          if ((c.x - r.x) ** 2 + (c.z - r.z) ** 2 < 1.7 && Math.abs(c.y + 0.45 - r.y) < 1.5) {
            this.hitCar(c, 'rocket')
            dead = true
            break
          }
        }
      if (dead) {
        this.explode(r.x, r.y, r.z)
        this.hooks.onRocketRemove(r)
        this.rockets.splice(k, 1)
      }
    }
  }

  private explode(x: number, y: number, z: number) {
    this.hooks.fx('explode', x, y, z)
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2
      const sp = rand(3, 10)
      this.hooks.emit(
        x,
        y,
        z,
        Math.cos(a) * sp,
        rand(2, 9),
        Math.sin(a) * sp,
        [0xffd23f, 0xff8a00, 0xff4a3d, 0x6b6b6b][i % 4]!,
        rand(0.2, 0.45),
        rand(0.4, 0.8),
        18,
      )
    }
    this.hooks.sfx('boom', x, z)
  }

  private spawnOil(c: Car) {
    const f = { x: Math.sin(c.heading), z: Math.cos(c.heading) }
    const o: Oil = { x: c.x - f.x * 2.2, z: c.z - f.z * 2.2, life: 22, age: 0, owner: c }
    this.oils.push(o)
    this.hooks.onOilSpawn(o)
    if (this.oils.length > 10) {
      const old = this.oils.shift()!
      this.hooks.onOilRemove(old)
    }
    this.hooks.sfx('drop', c.x, c.z)
  }

  private updateOils(dt: number) {
    for (let k = this.oils.length - 1; k >= 0; k--) {
      const o = this.oils[k]!
      o.age += dt
      o.life -= dt
      if (o.life <= 0) {
        this.hooks.onOilRemove(o)
        this.oils.splice(k, 1)
      }
    }
  }

  private checkOils(c: Car) {
    if (c.airborne) return
    for (const o of this.oils) {
      if (o.owner === c && o.age < 1.5) continue
      if ((c.x - o.x) ** 2 + (c.z - o.z) ** 2 < 2.9 && c.slip <= 0 && c.invuln <= 0) {
        this.hitCar(c, 'oil')
        this.hooks.sfx('oil', c.x, c.z)
      }
    }
  }

  private doPulse(c: Car) {
    this.hooks.fx('pulse', c.x, c.y, c.z, c)
    for (const o of this.cars)
      if (o !== c && Math.hypot(o.x - c.x, o.z - c.z) < PULSE_R && Math.abs(o.y - c.y) < 3)
        this.hitCar(o, 'pulse')
    this.hooks.sfx('zap', c.x, c.z)
  }

  hitCar(c: Car, kind: 'rocket' | 'oil' | 'pulse') {
    if (c.invuln > 0) return
    if (kind === 'rocket') {
      c.stun = 1.2
      c.vx *= 0.2
      c.vz *= 0.2
      c.vy = 10
      c.y += 0.05
      c.airborne = true
      c.flipT = FLIP_T
      c.flipDir = random() < 0.5 ? 1 : -1
      c.spinVel = rand(-3, 3)
      c.invuln = 1.4
    } else if (kind === 'oil') {
      c.slip = 1.0
      c.spinVel = (random() < 0.5 ? -1 : 1) * rand(6, 8)
      c.stun = 0.5
      c.invuln = 0.8
    } else {
      c.stun = 1.0
      c.zap = 1.0
      c.vx *= 0.35
      c.vz *= 0.35
      c.invuln = 0.6
    }
    if (c.isPlayer && !c.finished) {
      this.hooks.toast(
        kind === 'oil' ? '¡Patinaste!' : kind === 'pulse' ? '¡Electrocutado!' : '¡Impacto!',
      )
      this.hooks.sfx('hit')
    }
  }

  /* ---------- mantenimiento por cuadro ---------- */
  private timers(c: Car, dt: number) {
    c.turbo = Math.max(0, c.turbo - dt)
    c.stun = Math.max(0, c.stun - dt)
    c.slip = Math.max(0, c.slip - dt)
    c.invuln = Math.max(0, c.invuln - dt)
    c.zap = Math.max(0, c.zap - dt)
    c.blink = Math.max(0, c.blink - dt)
    c.flipT = Math.max(0, c.flipT - dt)
    c.resetCD = Math.max(0, c.resetCD - dt)
    c.bumpCD = Math.max(0, c.bumpCD - dt)
    c.itemDelay -= dt
    if (c.item) c.itemHeld += dt
    if (c.rolling > 0) {
      c.rolling -= dt
      if (c.rolling <= 0) {
        c.rolling = 0
        c.item = this.rollItem(c)
        c.itemHeld = 0
        if (c.isPlayer) {
          this.hooks.sfx('got')
          this.hooks.toast(ITEM_NAMES[c.item])
        }
      }
    }
  }

  private checkPickups(c: Car) {
    if (c.y > 2.5) return
    for (const p of this.pickups) {
      if (p.active && (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 3.4) this.collect(c, p)
    }
  }

  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (!p.active) {
        p.respawn -= dt
        if (p.respawn <= 0) {
          p.active = true
          p.pop = 0.35
        }
        continue
      }
      p.pop = Math.max(0, p.pop - dt)
    }
  }

  private landDust(c: Car) {
    for (let i = 0; i < 10; i++) {
      const a = random() * 6.28
      this.hooks.emit(
        c.x + Math.cos(a) * 0.6,
        0.2,
        c.z + Math.sin(a) * 0.6,
        Math.cos(a) * 3,
        rand(0.5, 2),
        Math.sin(a) * 3,
        0xd9d4cc,
        rand(0.25, 0.4),
        0.5,
        -1,
      )
    }
  }

  private emitCarFx(c: Car, dt: number) {
    const fx_ = Math.sin(c.heading)
    const fz_ = Math.cos(c.heading)
    const rx = c.x - fx_ * 0.95
    const rz = c.z - fz_ * 0.95
    if (c.turbo > 0 && random() < dt * 50)
      this.hooks.emit(
        rx + rand(-0.15, 0.15),
        c.y + 0.45,
        rz + rand(-0.15, 0.15),
        -fx_ * 4 + rand(-1, 1),
        rand(0, 1.5),
        -fz_ * 4 + rand(-1, 1),
        random() < 0.5 ? 0xffd23f : 0xff8a00,
        rand(0.18, 0.32),
        rand(0.18, 0.3),
        0,
      )
    if (
      !c.airborne &&
      (Math.abs(c.vl) > 3.5 || (c.slip > 0 && Math.abs(c.vf) > 3)) &&
      random() < dt * 30
    ) {
      for (const s of [-1, 1]) {
        const wx = rx + Math.cos(c.heading) * 0.5 * s
        const wz = rz - Math.sin(c.heading) * 0.5 * s
        this.hooks.emit(
          wx,
          0.2,
          wz,
          rand(-1, 1),
          rand(1, 2.4),
          rand(-1, 1),
          0xd9d4cc,
          rand(0.25, 0.45),
          rand(0.4, 0.7),
          -1.5,
        )
      }
    }
    if (c.zap > 0 && random() < dt * 40)
      this.hooks.emit(
        c.x + rand(-0.8, 0.8),
        c.y + rand(0.3, 1.2),
        c.z + rand(-0.8, 0.8),
        rand(-2, 2),
        rand(0, 3),
        rand(-2, 2),
        random() < 0.5 ? 0x7ef0ff : 0xffffff,
        rand(0.1, 0.2),
        0.25,
        0,
      )
  }
}
