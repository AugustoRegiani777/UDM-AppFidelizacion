// Una sesion de "Miga Skate": une la fisica, los combos, el puntaje y los objetivos del spot.
// TypeScript puro (sin three.js ni React): el controlador la avanza y muestra lo que pasa.

import type { Gesture } from './gestures.ts'
import {
  advance,
  applyGesture,
  createSkater,
  type SimEvent,
  type SimInput,
  type Skater,
  type WorldDef,
} from './physics.ts'
import type { Objective, SpotDef } from './spots.ts'
import {
  BOARDSLIDE_FACTOR,
  comboMultiplier,
  GRIND_BASE,
  GRIND_PER_SECOND,
  itemsFromLanding,
  MANUAL_PER_SECOND,
  type TrickItem,
  type TrickKey,
  type TrickTag,
} from './tricks.ts'

/** Cuanto espera el combo en el suelo antes de cobrarse. */
export const COMBO_GRACE = 1.5

export interface SessionStats {
  score: number
  bestCombo: number
  bestComboLen: number
  maxHeight: number
  grindSeconds: number
  manualSeconds: number
  tags: Partial<Record<TrickTag, number>>
  landed: number
  bails: number
}

export type SessionEvent =
  | SimEvent
  | { t: 'trick'; item: TrickItem; combo: number; mult: number }
  | { t: 'bank'; points: number; count: number }
  | { t: 'lost'; points: number }
  | { t: 'objective'; index: number }
  | { t: 'end' }

interface Live {
  key: TrickKey
  points: number
  tag: TrickTag
}

export function objectiveValue(o: Objective, s: SessionStats): { value: number; target: number } {
  switch (o.kind) {
    case 'score':
      return { value: s.score, target: o.target }
    case 'combo':
      return { value: s.bestCombo, target: o.target }
    case 'comboLen':
      return { value: s.bestComboLen, target: o.target }
    case 'trick':
      return { value: s.tags[o.tag] ?? 0, target: o.count }
    case 'grindSeconds':
      return { value: s.grindSeconds, target: o.target }
    case 'manualSeconds':
      return { value: s.manualSeconds, target: o.target }
    case 'height':
      return { value: s.maxHeight, target: o.target }
  }
}

export const objectiveDone = (o: Objective, s: SessionStats) => {
  const { value, target } = objectiveValue(o, s)
  return value >= target
}

export class SkateSession {
  readonly world: WorldDef
  readonly skater: Skater
  readonly stats: SessionStats = {
    score: 0,
    bestCombo: 0,
    bestComboLen: 0,
    maxHeight: 0,
    grindSeconds: 0,
    manualSeconds: 0,
    tags: {},
    landed: 0,
    bails: 0,
  }
  readonly done: boolean[] = [false, false, false]
  time = 0
  finished = false
  private items: TrickItem[] = []
  private live: Live | null = null
  private idle = 0
  private events: SessionEvent[] = []

  constructor(readonly spot: SpotDef) {
    this.world = spot.world
    this.skater = createSkater(spot.world)
  }

  get stars() {
    return this.done.filter(Boolean).length
  }

  get comboCount() {
    return this.items.length + (this.live ? 1 : 0)
  }

  get comboMult() {
    return comboMultiplier(this.comboCount)
  }

  /** Puntos del combo en curso (todavia sin cobrar). */
  get comboPoints() {
    const sum = this.items.reduce((acc, i) => acc + i.points, 0) + (this.live?.points ?? 0)
    return Math.round(sum * this.comboMult)
  }

  get timeLeft() {
    return Math.max(0, this.spot.seconds - this.time)
  }

  /** Eventos acumulados desde la ultima vez (para sonido, vibracion y carteles). */
  drain(): SessionEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  gesture(g: Gesture) {
    if (this.finished) return
    this.handle(applyGesture(this.skater, g))
  }

  /** Avanza `seconds` segundos de juego. */
  update(seconds: number, input: SimInput) {
    if (this.finished) return
    advance(this.world, this.skater, input, seconds, (events) => this.handle(events))
    this.time += seconds
    this.tickCombo(seconds)
    if (this.time >= this.spot.seconds) this.finish()
  }

  /** Termina la sesion (se acabo el tiempo o el jugador salio): cobra el combo que quedaba. */
  finish() {
    if (this.finished) return
    this.closeLive()
    this.bank()
    this.finished = true
    this.events.push({ t: 'end' })
  }

  private handle(events: SimEvent[]) {
    for (const e of events) {
      this.events.push(e)
      this.react(e)
    }
  }

  private react(e: SimEvent) {
    const s = this.skater
    switch (e.t) {
      case 'land': {
        this.stats.landed++
        this.idle = 0
        if (!e.trick) break
        this.stats.maxHeight = Math.max(this.stats.maxHeight, e.trick.height)
        for (const item of itemsFromLanding(e.trick)) this.push(item)
        this.check()
        break
      }
      case 'bail': {
        this.stats.bails++
        const lost = this.comboPoints
        this.live = null
        this.items = []
        this.idle = 0
        if (lost > 0) this.events.push({ t: 'lost', points: lost })
        break
      }
      case 'grindStart': {
        const key = e.kind === 'boardslide' ? 'boardslide' : 'grind'
        if (this.live && (this.live.tag === 'grind' || this.live.tag === 'boardslide')) {
          this.live.key = key
        } else {
          this.live = { key, points: GRIND_BASE, tag: 'grind' }
        }
        break
      }
      case 'grindEnd': {
        this.stats.grindSeconds = Math.max(this.stats.grindSeconds, e.seconds)
        if (this.live && this.live.tag === 'grind' && s.mode !== 'bail') {
          const boardslide = this.live.key === 'boardslide'
          this.closeLive()
          if (boardslide) this.addTag('boardslide')
        } else this.live = null
        this.check()
        break
      }
      case 'manualStart':
        this.live = { key: 'manual', points: 0, tag: 'manual' }
        break
      case 'manualEnd': {
        this.stats.manualSeconds = Math.max(this.stats.manualSeconds, e.seconds)
        if (this.live?.tag === 'manual') {
          if (e.seconds >= 0.6 && s.mode !== 'bail') {
            this.live.key = e.nose ? 'noseManual' : 'manual'
            this.closeLive()
          } else this.live = null
        }
        this.check()
        break
      }
      default:
    }
  }

  private addTag(tag: TrickTag) {
    this.stats.tags[tag] = (this.stats.tags[tag] ?? 0) + 1
  }

  private push(item: TrickItem) {
    this.items.push(item)
    for (const tag of item.tags) this.addTag(tag)
    this.events.push({ t: 'trick', item, combo: this.comboPoints, mult: this.comboMult })
  }

  private closeLive() {
    const live = this.live
    if (!live) return
    this.live = null
    if (live.points <= 0) return
    const tags: TrickTag[] = live.tag === 'manual' ? ['manual'] : ['grind']
    const item: TrickItem = { key: live.key, nollie: false, points: Math.round(live.points), tags }
    this.push(item)
  }

  private tickCombo(dt: number) {
    const s = this.skater
    if (this.live) {
      if (this.live.tag === 'grind' && s.mode === 'grind') {
        const factor = this.live.key === 'boardslide' ? BOARDSLIDE_FACTOR : 1
        this.live.points += GRIND_PER_SECOND * factor * dt
      } else if (this.live.tag === 'manual' && s.manual) {
        this.live.points += MANUAL_PER_SECOND * dt
      }
    }
    const busy = s.mode === 'air' || s.mode === 'grind' || s.manual !== null
    if (busy) {
      this.idle = 0
    } else if (this.items.length > 0 || this.live) {
      this.idle += dt
      if (s.mode === 'bail') this.idle = 0
      if (this.idle > COMBO_GRACE) this.bank()
    }
  }

  private bank() {
    if (this.items.length === 0) return
    const points = this.comboPoints
    const count = this.items.length
    this.stats.score += points
    this.stats.bestCombo = Math.max(this.stats.bestCombo, points)
    this.stats.bestComboLen = Math.max(this.stats.bestComboLen, count)
    this.items = []
    this.idle = 0
    this.events.push({ t: 'bank', points, count })
    this.check()
  }

  private check() {
    this.spot.objectives.forEach((o, i) => {
      if (!this.done[i] && objectiveDone(o, this.stats)) {
        this.done[i] = true
        this.events.push({ t: 'objective', index: i })
      }
    })
  }
}
