// Controlador de "Skate Spot": une la simulación, el dibujo, los controles y el sonido.
// TypeScript puro (sin React): React solo muestra menús y HUD.

import { copy } from '@/copy'
import { vibrate } from '@/motion/feedback'
import { ThumbsInput } from '../skate/input.ts'
import { sfx, unlockAudio } from './audio.ts'
import { ParkRenderer } from './renderer.ts'
import {
  LEVELS,
  TICKS_PER_SECOND,
  createPark,
  secondsLeft,
  starsFor,
  stepPark,
  type ParkEvent,
  type ParkState,
} from './sim.ts'

export type ParkPhase = 'ready' | 'playing' | 'paused' | 'ended'

export interface ParkHud {
  score: number
  seconds: number
  comboPoints: number
  comboMult: number
  comboNames: string[]
  /** -1..1 mientras se hace grind, si no null. */
  balance: number | null
  /** 0..1 de carga del salto. */
  charge: number
  target: number
  stars: number
}

export interface ParkResult {
  score: number
  stars: number
  bestCombo: number
  landed: number
  bails: number
}

export interface ParkCallbacks {
  onPhase: (phase: ParkPhase) => void
  onHud: (hud: ParkHud) => void
  onEnd: (result: ParkResult) => void
}

const STEP_MS = 1000 / TICKS_PER_SECOND
const END_DELAY_MS = 1600
const MAX_DPR = 2.5
const SLOW_FRAME_MS = 21
const FRAME_SAMPLES = 90

export function parkHudOf(s: ParkState): ParkHud {
  return {
    score: s.score,
    seconds: secondsLeft(s),
    comboPoints: s.combo.points,
    comboMult: s.combo.mult,
    comboNames: s.combo.names,
    balance: s.mode === 'grind' && s.grind ? s.grind.balance : null,
    charge: s.charge / 18,
    target: LEVELS[s.level - 1]!.target,
    stars: starsFor(s.score, s.level),
  }
}

const trickLabel = (name: string) => (copy.skatepark.tricks as Record<string, string>)[name] ?? name

function react(events: readonly ParkEvent[]) {
  for (const event of events) {
    switch (event.t) {
      case 'pop':
        sfx.pop()
        break
      case 'action':
        if (event.name === '50-50' || event.name === 'Boardslide') sfx.grindStart()
        else sfx.trick()
        vibrate(8)
        break
      case 'sparks':
        sfx.grind()
        break
      case 'land':
        if (event.quality === 'clean') sfx.land()
        else sfx.sketchy()
        break
      case 'bank':
        sfx.bank(event.total > 800)
        vibrate(event.total > 800 ? [15, 30, 15] : 12)
        break
      case 'bail':
        sfx.bail()
        vibrate(40)
        break
      case 'done':
        sfx.done()
        break
      default:
    }
  }
}

export class ParkController {
  private readonly state: ParkState
  private readonly renderer: ParkRenderer
  private readonly input: ThumbsInput
  private phase: ParkPhase = 'ready'
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
    level: number,
    seed: number,
    private readonly callbacks: ParkCallbacks,
  ) {
    this.state = createPark(level, seed)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new ParkRenderer(canvas, reduced)
    this.input = new ThumbsInput(container, (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    })
    this.layout()
    this.renderer.snapshot(this.state)
    this.drawIdle()
    this.resizeObserver = new ResizeObserver(() => {
      this.layout()
      this.drawIdle()
    })
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    callbacks.onHud(parkHudOf(this.state))
  }

  private layout() {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight, this.dpr)
  }

  private drawIdle() {
    this.renderer.render(this.state, 1, this.input.view(), performance.now())
  }

  private setPhase(next: ParkPhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  /** Arranca desde el menú inicial (gesto del usuario: habilita el audio). */
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
    while (this.accumulator >= STEP_MS && state.status === 'playing') {
      this.renderer.snapshot(state)
      stepPark(state, { stick: this.input.stick(), right: this.input.button() })
      this.renderer.ingest(state.events, state, trickLabel)
      react(state.events)
      this.accumulator -= STEP_MS
    }

    this.renderer.render(state, Math.min(this.accumulator / STEP_MS, 1), this.input.view(), now)
    if (this.frame % 4 === 0 || state.status !== 'playing') {
      this.callbacks.onHud(parkHudOf(state))
    }

    if (state.status !== 'playing') {
      this.finish()
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private finish() {
    const { state } = this
    this.setPhase('ended')
    this.endTimer = window.setTimeout(() => {
      this.callbacks.onEnd({
        score: state.score,
        stars: starsFor(state.score, state.level),
        bestCombo: state.bestCombo,
        landed: state.landed,
        bails: state.bails,
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
