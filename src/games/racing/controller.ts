// Controlador de "Miga Racers": une la simulación, el dibujo, los controles y el sonido.
// Es TypeScript puro (sin React): el lazo de animación vive acá y React solo muestra menús y HUD.

import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import { RacingRenderer } from './renderer.ts'
import {
  COUNTDOWN_TICKS,
  TICKS_PER_SECOND,
  createRace,
  lapOf,
  playerOf,
  rankOf,
  stepRace,
  type RaceEvent,
  type RaceState,
} from './sim.ts'

export type RacePhase = 'ready' | 'racing' | 'paused' | 'ended'

export interface RaceHud {
  position: number
  cars: number
  lap: number
  laps: number
  seconds: number
}

export interface RaceResult {
  position: number
  seconds: number
}

export interface RacingCallbacks {
  onPhase: (phase: RacePhase) => void
  onHud: (hud: RaceHud) => void
  /** 3, 2, 1, 0 = ¡YA!, null = ocultar. */
  onCount: (n: number | null) => void
  onEnd: (result: RaceResult) => void
}

const STEP_MS = 1000 / TICKS_PER_SECOND
const MAX_DPR = 2.5
const SLOW_FRAME_MS = 21
const FRAME_SAMPLES = 90
const END_DELAY_MS = 1600

export function raceHudOf(state: RaceState): RaceHud {
  const player = playerOf(state)
  return {
    position: rankOf(state, player),
    cars: state.cars.length,
    lap: lapOf(state, player),
    laps: state.track.def.laps,
    seconds: state.raceTick / TICKS_PER_SECOND,
  }
}

function react(events: readonly RaceEvent[], onCount: (n: number | null) => void) {
  for (const event of events) {
    switch (event.t) {
      case 'count':
        sfx.count()
        onCount(event.n)
        break
      case 'go':
        sfx.go()
        onCount(0)
        window.setTimeout(() => onCount(null), 700)
        break
      case 'lap':
        sfx.lap()
        break
      case 'boost':
        if (event.own) {
          sfx.boost()
          vibrate(15)
        }
        break
      case 'bump':
        if (event.own) {
          sfx.bump()
          vibrate(20)
        }
        break
      case 'finish':
        sfx.finish()
        vibrate([30, 40, 30])
        break
      default:
    }
  }
}

export class RacingController {
  private readonly state: RaceState
  private readonly renderer: RacingRenderer
  private phase: RacePhase = 'ready'
  private raf = 0
  private last = 0
  private accumulator = 0
  private frame = 0
  private slowMs = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private endTimer = 0
  private readonly pointers = new Map<number, number>()
  private readonly keys = new Set<string>()
  private brakeButton = false
  private readonly resizeObserver: ResizeObserver
  private readonly cleanup: (() => void)[] = []
  private readonly onVisibility = () => document.hidden && this.pause()

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    trackIndex: number,
    seed: number,
    private readonly callbacks: RacingCallbacks,
  ) {
    this.state = createRace(trackIndex, seed)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new RacingRenderer(canvas, this.state.track, reduced)
    this.layout()
    this.renderer.snapshot(this.state)
    this.drawIdle()
    this.resizeObserver = new ResizeObserver(() => {
      this.layout()
      this.drawIdle()
    })
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.bindInput()
    callbacks.onHud(raceHudOf(this.state))
  }

  private layout() {
    this.renderer.resize(this.container.clientWidth, this.container.clientHeight, this.dpr)
  }

  private drawIdle() {
    this.renderer.render(this.state, 1, performance.now())
  }

  /** Doblar: mitad izquierda de la pantalla = izquierda, mitad derecha = derecha. Dos dedos = derecho. */
  private bindInput() {
    const surface = this.container
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, input, label, [role="dialog"]')) return
      const rect = surface.getBoundingClientRect()
      this.pointers.set(e.pointerId, e.clientX < rect.left + rect.width / 2 ? -1 : 1)
    }
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
    }
    const keyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 's', 'A', 'D', 'S'].includes(e.key)
      ) {
        this.keys.add(e.key.toLowerCase())
        if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault()
      }
    }
    const keyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase())
    }
    surface.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    this.cleanup.push(
      () => surface.removeEventListener('pointerdown', down),
      () => window.removeEventListener('pointerup', up),
      () => window.removeEventListener('pointercancel', up),
      () => window.removeEventListener('keydown', keyDown),
      () => window.removeEventListener('keyup', keyUp),
    )
  }

  /** El botón de derrape de la pantalla. */
  setBrake(on: boolean) {
    this.brakeButton = on
  }

  private controls() {
    let steer = 0
    for (const side of this.pointers.values()) steer += side
    if (this.keys.has('arrowleft') || this.keys.has('a')) steer -= 1
    if (this.keys.has('arrowright') || this.keys.has('d')) steer += 1
    const brake =
      this.brakeButton || this.keys.has('arrowdown') || this.keys.has('s') || this.keys.has(' ')
    return { steer: Math.max(-1, Math.min(1, steer)), brake }
  }

  private setPhase(next: RacePhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  /** Arranca desde el menú inicial (gesto del usuario: habilita el audio). */
  start() {
    unlockAudio()
    this.callbacks.onCount(Math.ceil(COUNTDOWN_TICKS / 60))
    sfx.count()
    this.resume()
  }

  resume() {
    this.last = performance.now()
    this.accumulator = 0
    this.setPhase('racing')
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (this.phase !== 'racing') return
    cancelAnimationFrame(this.raf)
    this.pointers.clear()
    this.brakeButton = false
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
    if (this.phase !== 'racing') return
    const frameMs = Math.min(now - this.last, 100)
    this.last = now
    this.accumulator += frameMs
    this.adaptResolution(frameMs)

    const { state } = this
    while (this.accumulator >= STEP_MS && state.status !== 'finished') {
      this.renderer.snapshot(state)
      stepRace(state, this.controls())
      this.renderer.ingest(state.events, state)
      react(state.events, this.callbacks.onCount)
      this.accumulator -= STEP_MS
    }

    this.renderer.render(state, Math.min(this.accumulator / STEP_MS, 1), now)
    if (this.frame % 6 === 0 || state.status === 'finished') {
      this.callbacks.onHud(raceHudOf(state))
    }

    if (state.status === 'finished') {
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
        position: state.position,
        seconds: playerOf(state).finishTick / TICKS_PER_SECOND,
      })
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
