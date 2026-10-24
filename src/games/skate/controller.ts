// Controlador del skate: une la simulación (compartida con el servidor), el dibujo, los controles y el sonido.
// TypeScript puro (sin React): React solo muestra menús y HUD.

import { TICKS_PER_SECOND, type SkateConfig } from '@skate/config.ts'
import { SkateRecorder } from '@skate/replay.ts'
import { createSkate, stepSkate, type SkateEvent, type SkateState } from '@skate/sim.ts'
import { copy } from '@/copy'
import { vibrate } from '@/motion/feedback'
import type { GameOutcome, GameSession } from '../outcome.ts'
import { skateSfx, unlockAudio } from './audio.ts'
import { ThumbsInput } from './input.ts'
import { SkateRenderer, VIEW_H } from './renderer.ts'

export type SkatePhase = 'ready' | 'playing' | 'paused' | 'ended'

export interface SkateHudData {
  lives: number
  maxLives: number
  /** 0 a 1 del circuito. */
  progress: number
  /** 0 a 100. */
  boost: number
  checkpoints: number[]
}

export interface SkateCallbacks {
  onPhase: (phase: SkatePhase) => void
  onHud: (hud: SkateHudData) => void
  onEnd: (outcome: GameOutcome) => void
}

const STEP_MS = 1000 / TICKS_PER_SECOND
const END_DELAY_MS = 1500
const MAX_DPR = 3
const SLOW_FRAME_MS = 21
const FRAME_SAMPLES = 90

export function skateHudOf(state: SkateState): SkateHudData {
  return {
    lives: Math.max(0, state.lives),
    maxLives: state.config.lives,
    progress: Math.min(1, state.x / state.terrain.length),
    boost: state.boost,
    checkpoints: state.terrain.checkpoints.slice(1).map((x) => x / state.terrain.length),
  }
}

function react(events: readonly SkateEvent[]) {
  for (const event of events) {
    switch (event.t) {
      case 'jump':
        skateSfx.jump()
        break
      case 'trick':
        skateSfx.trick()
        vibrate(8)
        break
      case 'land':
        if (event.quality === 'clean') {
          skateSfx.land()
          vibrate(12)
        } else skateSfx.sketchy()
        break
      case 'bail':
        skateSfx.bail()
        vibrate([50, 30, 70])
        break
      case 'boost':
        skateSfx.boost()
        break
      case 'checkpoint':
        skateSfx.checkpoint()
        vibrate(20)
        break
      default:
    }
  }
}

export class SkateController {
  private readonly state: SkateState
  private readonly recorder = new SkateRecorder()
  private readonly renderer: SkateRenderer
  private readonly input: ThumbsInput
  private phase: SkatePhase = 'ready'
  private raf = 0
  private last = 0
  private accumulator = 0
  private frame = 0
  private slowMs = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private endTimer = 0
  private readonly resizeObserver: ResizeObserver
  private readonly onVisibility = () => document.hidden && this.pause()

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    session: GameSession<SkateConfig>,
    private readonly callbacks: SkateCallbacks,
  ) {
    this.state = createSkate(session.config, session.seed)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new SkateRenderer(canvas, reduced, {
      tricks: copy.skate.tricks,
      checkpoint: copy.skate.checkpointBanner,
      bail: copy.skate.bailBanner,
      finish: copy.skate.finishBanner,
      turbo: copy.skate.turbo,
    })
    this.input = new ThumbsInput(container, (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * this.renderer.viewW,
        y: ((clientY - rect.top) / rect.height) * VIEW_H,
      }
    })
    this.layout()
    this.drawIdle()
    this.resizeObserver = new ResizeObserver(() => {
      this.layout()
      this.drawIdle()
    })
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    callbacks.onHud(skateHudOf(this.state))
  }

  private layout() {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight, this.dpr)
  }

  private drawIdle() {
    this.renderer.render(this.state, 0, this.input.view(), performance.now())
  }

  private setPhase(next: SkatePhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  start() {
    unlockAudio()
    this.resume()
  }

  resume() {
    this.last = performance.now()
    this.accumulator = 0
    this.setPhase('playing')
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (this.phase !== 'playing') return
    cancelAnimationFrame(this.raf)
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
    if (this.phase !== 'playing') return
    const frameMs = Math.min(now - this.last, 100)
    this.last = now
    this.accumulator += frameMs
    this.adaptResolution(frameMs)

    const { state } = this
    while (this.accumulator >= STEP_MS) {
      const stick = this.input.stick()
      const button = this.input.button()
      this.recorder.input(state.tick, stick, button)
      stepSkate(state, stick, button)
      this.renderer.ingest(state.events, state)
      react(state.events)
      this.accumulator -= STEP_MS
      if (state.status !== 'playing') break
    }

    this.renderer.render(state, Math.min(this.accumulator / STEP_MS, 1), this.input.view(), now)
    if (this.frame % 5 === 0 || state.status !== 'playing') this.callbacks.onHud(skateHudOf(state))

    if (state.status !== 'playing') {
      this.finish()
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private finish() {
    const { state } = this
    const won = state.status === 'won'
    this.setPhase('ended')
    if (won) {
      skateSfx.finish()
      vibrate([30, 40, 30])
    } else skateSfx.lose()
    this.endTimer = window.setTimeout(() => {
      this.callbacks.onEnd({
        won,
        log: this.recorder.log,
        lostText: copy.skate.lostBody(Math.round((state.x / state.terrain.length) * 100)),
        statsText: copy.skate.stats(state.clean, state.bails),
      })
    }, END_DELAY_MS)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.endTimer)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.input.dispose()
  }
}
