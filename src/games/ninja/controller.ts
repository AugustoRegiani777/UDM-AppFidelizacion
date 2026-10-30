// Controlador de "Miga Ninja": une el motor, el dibujo, el dedo y el sonido. Es TypeScript puro
// (sin React): el lazo de animación vive acá y React solo muestra menús y HUD.

import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import {
  LIFE_STREAK,
  TICKS_PER_SECOND,
  createGame,
  endStroke,
  goalProgress,
  resultOf,
  slash,
  stepGame,
  type GameEvent,
  type GameState,
  type NinjaResult,
} from './engine.ts'
import type { LevelDef } from './levels.ts'
import { NinjaRenderer, type PopupLabels } from './renderer.ts'

export type NinjaPhase = 'ready' | 'playing' | 'paused' | 'ended'

export interface NinjaHud {
  score: number
  cuts: number
  lives: number
  maxLives: number
  combo: number
  mult: number
  secondsLeft: number
  progress: number
  goalReached: boolean
  frenzy: boolean
  freeze: boolean
  /** Cortes que faltan para ganar una vida de regalo. */
  streakToLife: number
}

export interface NinjaCallbacks {
  onPhase: (phase: NinjaPhase) => void
  onHud: (hud: NinjaHud) => void
  onEnd: (result: NinjaResult) => void
}

const STEP_MS = 1000 / TICKS_PER_SECOND
const MAX_DPR = 2
const SLOW_FRAME_MS = 21
const FRAME_SAMPLES = 90
const END_DELAY_MS = 1500
const WHOOSH_MIN_SPEED = 0.35 // unidades de campo por ms

export function hudOf(state: GameState): NinjaHud {
  return {
    score: state.score,
    cuts: state.cuts,
    lives: state.lives,
    maxLives: state.level.lives,
    combo: state.combo,
    mult: Math.min(4, 1 + Math.floor(state.combo / 5)),
    secondsLeft: Math.max(0, Math.ceil(state.ticksLeft / TICKS_PER_SECOND)),
    progress: goalProgress(state),
    goalReached: state.goalReached,
    frenzy: state.frenzyTicks > 0,
    freeze: state.freezeTicks > 0,
    streakToLife: LIFE_STREAK - (state.combo % LIFE_STREAK),
  }
}

export class NinjaController {
  readonly state: GameState
  private readonly renderer: NinjaRenderer
  private phase: NinjaPhase = 'ready'
  private raf = 0
  private last = 0
  private accumulator = 0
  private frame = 0
  private slowMs = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private endTimer = 0
  private readonly fieldH: number
  private pointerId: number | null = null
  private lastX = 0
  private lastY = 0
  private lastMoveTime = 0
  private lastWhoosh = 0
  private readonly resizeObserver: ResizeObserver
  private readonly cleanup: (() => void)[] = []
  private readonly onVisibility = () => document.hidden && this.pause()

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    level: LevelDef,
    seed: number,
    private readonly callbacks: NinjaCallbacks,
    labels: PopupLabels,
  ) {
    const rect = container.getBoundingClientRect()
    this.fieldH = Math.max(
      140,
      Math.min(200, Math.round((100 * rect.height) / Math.max(1, rect.width))),
    )
    this.state = createGame(level, seed, this.fieldH)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new NinjaRenderer(canvas, level.scene, reduced, labels)
    this.layout()
    this.drawIdle()
    this.resizeObserver = new ResizeObserver(() => {
      this.layout()
      if (this.phase !== 'playing') this.drawIdle()
    })
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.bindInput()
    callbacks.onHud(hudOf(this.state))
  }

  private layout() {
    this.renderer.resize(
      this.container.clientWidth,
      this.container.clientHeight,
      this.dpr,
      this.fieldH,
    )
  }

  private drawIdle() {
    this.renderer.render(this.state, performance.now())
  }

  private point(e: PointerEvent): [number, number] {
    const rect = this.container.getBoundingClientRect()
    return this.renderer.toField(e.clientX - rect.left, e.clientY - rect.top, this.dpr)
  }

  private bindInput() {
    const surface = this.container
    const down = (e: PointerEvent) => {
      if (this.phase !== 'playing' || this.pointerId !== null) return
      if ((e.target as HTMLElement).closest('button, input, label, [role="dialog"]')) return
      this.pointerId = e.pointerId
      try {
        surface.setPointerCapture(e.pointerId)
      } catch {
        // sin captura: el trazo igual sigue mientras el dedo esté sobre el juego
      }
      const [x, y] = this.point(e)
      this.lastX = x
      this.lastY = y
      this.lastMoveTime = e.timeStamp
      this.renderer.addTrail(x, y, performance.now())
    }
    const move = (e: PointerEvent) => {
      if (this.phase !== 'playing' || e.pointerId !== this.pointerId) return
      const batch = e.getCoalescedEvents?.() ?? []
      const list = batch.length ? batch : [e]
      for (const part of list) {
        const [x, y] = this.point(part)
        this.slashTo(x, y, part.timeStamp)
      }
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return
      this.pointerId = null
      endStroke(this.state)
      this.renderer.endTrail()
    }
    surface.addEventListener('pointerdown', down)
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerup', up)
    surface.addEventListener('pointercancel', up)
    this.cleanup.push(
      () => surface.removeEventListener('pointerdown', down),
      () => surface.removeEventListener('pointermove', move),
      () => surface.removeEventListener('pointerup', up),
      () => surface.removeEventListener('pointercancel', up),
    )
  }

  /** Un tramo del trayecto del dedo: se estira la estela y se prueba si cortó algo. */
  private slashTo(x: number, y: number, time: number) {
    const dx = x - this.lastX
    const dy = y - this.lastY
    if (dx === 0 && dy === 0) return
    this.renderer.addTrail(x, y, performance.now())
    const dist = Math.hypot(dx, dy)
    const elapsed = Math.max(1, time - this.lastMoveTime)
    if (dist / elapsed > WHOOSH_MIN_SPEED && performance.now() - this.lastWhoosh > 140) {
      this.lastWhoosh = performance.now()
      sfx.whoosh()
    }
    slash(this.state, this.lastX, this.lastY, x, y)
    this.lastX = x
    this.lastY = y
    this.lastMoveTime = time
    this.flush()
  }

  /** Reparte los eventos del motor entre el dibujo, el sonido y el HUD. */
  private flush() {
    const { state } = this
    const { events } = state
    if (!events.length) return
    this.renderer.ingest(events, state)
    for (const event of events) this.react(event)
    events.length = 0
    this.callbacks.onHud(hudOf(state))
    if (state.status === 'ended' && this.phase === 'playing') this.finish()
  }

  private react(event: GameEvent) {
    switch (event.t) {
      case 'cut':
        sfx.cut(event.combo)
        break
      case 'combo':
        sfx.combo(event.n)
        vibrate(12)
        break
      case 'bomb':
        sfx.bomb()
        vibrate([40, 30, 60])
        break
      case 'miss':
        sfx.miss()
        break
      case 'life':
        sfx.life()
        break
      case 'frenzy':
        sfx.frenzy()
        vibrate(25)
        break
      case 'freeze':
        sfx.freeze()
        break
      case 'goal':
        sfx.goal()
        break
      case 'end':
        sfx.end()
        break
      default:
    }
  }

  private setPhase(next: NinjaPhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  /** Arranca desde el menú inicial (gesto del usuario: habilita el audio). */
  start() {
    unlockAudio()
    this.resume()
  }

  resume() {
    if (this.phase === 'ended') return
    this.last = performance.now()
    this.accumulator = 0
    this.setPhase('playing')
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (this.phase !== 'playing') return
    cancelAnimationFrame(this.raf)
    this.pointerId = null
    endStroke(this.state)
    this.renderer.endTrail()
    this.setPhase('paused')
  }

  private adaptResolution(frameMs: number) {
    this.slowMs += frameMs
    if (++this.frame % FRAME_SAMPLES !== 0) return
    // Si el celular no llega a ~48 fps, se baja la definición de a poco (nunca vuelve a subir).
    if (this.slowMs / FRAME_SAMPLES > SLOW_FRAME_MS && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.layout()
    }
    this.slowMs = 0
  }

  private readonly tick = (now: number) => {
    if (this.phase !== 'playing' && this.phase !== 'ended') return
    const frameMs = Math.min(now - this.last, 100)
    this.last = now
    this.accumulator += frameMs
    this.adaptResolution(frameMs)

    const { state } = this
    while (this.accumulator >= STEP_MS) {
      stepGame(state)
      this.accumulator -= STEP_MS
      if (state.events.length) this.flush()
    }

    this.renderer.render(state, now)
    if (this.frame % 6 === 0) this.callbacks.onHud(hudOf(state))
    this.raf = requestAnimationFrame(this.tick)
  }

  private finish() {
    this.pointerId = null
    this.renderer.endTrail()
    this.setPhase('ended')
    this.callbacks.onHud(hudOf(this.state))
    this.endTimer = window.setTimeout(() => {
      this.callbacks.onEnd(resultOf(this.state))
    }, END_DELAY_MS)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.endTimer)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    for (const undo of this.cleanup) undo()
  }
}
