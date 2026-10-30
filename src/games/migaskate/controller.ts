// Controlador de "Miga Skate": une la sesion (fisica y combos), el reconocedor de gestos, el dibujo 3D y
// el sonido. Es TypeScript puro (sin React): el lazo de animacion vive aca y React solo muestra menus,
// HUD y la tabla tactil. three.js se carga recien al entrar al juego (import dinamico).

import { copy } from '@/copy'
import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import { GestureRecognizer, type Gesture } from './gestures.ts'
import { objectiveValue, SkateSession, type SessionEvent } from './session.ts'
import { spotAt } from './spots.ts'
import type { SkateRenderer } from './renderer.ts'

export type SkatePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'

export interface SkateHud {
  score: number
  combo: number
  mult: number
  comboCount: number
  timeLeft: number
  stars: number
  done: boolean[]
  progress: { value: number; target: number }[]
  /** Equilibrio del grind o del manual (-1..1) mientras esta activo. */
  balance: number | null
  speed: number
  airborne: boolean
}

export interface SkatePopup {
  id: number
  text: string
  kind: 'trick' | 'bank' | 'bail' | 'objective' | 'hint'
}

export interface SkateResult {
  stars: number
  score: number
  landed: number
  bails: number
  bestCombo: number
  done: boolean[]
}

export interface SkateCallbacks {
  onPhase: (phase: SkatePhase) => void
  onHud: (hud: SkateHud) => void
  onPopup: (popup: SkatePopup) => void
  onEnd: (result: SkateResult) => void
}

const MAX_DPR = 2
const SLOW_FRAME_MS = 22
const FRAME_SAMPLES = 90
const END_DELAY_MS = 1800
const HUD_EVERY_MS = 90
/** Segundos de juego que se simulan como maximo por cuadro (si el celular se traba, no se acumula). */
const MAX_ADVANCE = 0.1

export function hudOf(session: SkateSession): SkateHud {
  const s = session.skater
  let balance: number | null = null
  if (s.mode === 'grind' && s.grind) balance = s.grind.bal
  else if (s.manual) balance = s.manual.bal
  return {
    score: session.stats.score,
    combo: session.comboPoints,
    mult: session.comboMult,
    comboCount: session.comboCount,
    timeLeft: session.timeLeft,
    stars: session.stars,
    done: [...session.done],
    progress: session.spot.objectives.map((o) => objectiveValue(o, session.stats)),
    balance,
    speed: Math.abs(s.speed),
    airborne: s.mode === 'air',
  }
}

export function resultOf(session: SkateSession): SkateResult {
  return {
    stars: session.stars,
    score: session.stats.score,
    landed: session.stats.landed,
    bails: session.stats.bails,
    bestCombo: session.stats.bestCombo,
    done: [...session.done],
  }
}

export class SkateController {
  readonly session: SkateSession
  readonly recognizer: GestureRecognizer
  private renderer: SkateRenderer | null = null
  private phase: SkatePhase = 'loading'
  private raf = 0
  private last = 0
  private frame = 0
  private slowMs = 0
  private lastHud = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private disposed = false
  private endTimer = 0
  private popupId = 0
  private hintShown = false
  private bailCount = 0
  private readonly keys = new Set<string>()
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly resizeObserver: ResizeObserver
  private readonly cleanup: (() => void)[] = []
  private readonly onVisibility = () => document.hidden && this.pause()

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    spotIndex: number,
    private readonly callbacks: SkateCallbacks,
  ) {
    this.session = new SkateSession(spotAt(spotIndex))
    this.recognizer = new GestureRecognizer(() => ({
      airborne: this.session.skater.mode === 'air',
    }))
    this.resizeObserver = new ResizeObserver(() => this.layout())
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.bindKeys()
    void this.load()
  }

  private async load() {
    try {
      const { SkateRenderer } = await import('./renderer.ts')
      if (this.disposed) return
      this.renderer = new SkateRenderer(
        this.canvas,
        this.session.world,
        this.session.spot.theme,
        this.reduced,
      )
      if (this.renderer.contextLost) throw new Error('webgl')
      this.layout()
      this.drawFrame(performance.now())
      this.setPhase('ready')
      this.callbacks.onHud(hudOf(this.session))
    } catch {
      if (!this.disposed) this.setPhase('error')
    }
  }

  private layout() {
    this.renderer?.resize(this.container.clientWidth, this.container.clientHeight, this.dpr)
    if (this.renderer && this.phase !== 'playing') this.drawFrame(performance.now())
  }

  private drawFrame(now: number) {
    this.renderer?.render(this.session.skater, this.recognizer.steer, now)
  }

  private setPhase(next: SkatePhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  // --- Entradas -------------------------------------------------------------------------------

  /** Un dedo de la tabla tactil (coordenadas del pad, ver gestures.ts). */
  pointer(kind: 'down' | 'move' | 'up' | 'cancel', id: number, u: number, v: number) {
    if (this.phase !== 'playing') return
    const t = performance.now()
    if (kind === 'down') this.recognizer.down(id, u, v, t)
    else if (kind === 'move') this.recognizer.move(id, u, v, t)
    else if (kind === 'up') this.recognizer.up(id, u, v, t)
    else this.recognizer.cancel(id)
  }

  /** Teclado para probar en la compu: las mismas acciones que los gestos. */
  private bindKeys() {
    const map: Record<string, () => Gesture | null> = {
      ' ': () => ({ k: 'ollie', power: 0.8, nollie: false }),
      w: () => ({ k: 'ollie', power: 0.8, nollie: false }),
      n: () => ({ k: 'ollie', power: 0.8, nollie: true }),
      k: () => ({ k: 'flip', power: 0.5, dir: 1 }),
      h: () => ({ k: 'flip', power: 0.5, dir: -1 }),
      s: () => ({ k: 'popShuvit', power: 0.8, dir: 1, nollie: false }),
      e: () => ({ k: 'spin', power: 0.5, dir: 1 }),
      p: () => ({ k: 'push', power: 0.7 }),
    }
    const down = (e: KeyboardEvent) => {
      if (this.phase !== 'playing' || e.repeat) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === 'g') {
        this.session.gesture({ k: 'grab', name: 'indy' })
      } else if (key === 'm') {
        this.session.gesture({ k: 'manual', nose: false })
      } else {
        const g = map[key]?.()
        if (g) this.session.gesture(g)
      }
      if (key.startsWith('Arrow') || key === ' ') e.preventDefault()
      this.keys.add(key)
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      this.keys.delete(key)
      if (key === 'g') this.session.gesture({ k: 'grabEnd' })
      if (key === 'm') this.session.gesture({ k: 'manualEnd' })
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    this.cleanup.push(
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
    )
  }

  private input() {
    const left = this.keys.has('ArrowLeft') || this.keys.has('a')
    const right = this.keys.has('ArrowRight') || this.keys.has('d')
    const upKey = this.keys.has('ArrowUp')
    const downKey = this.keys.has('ArrowDown')
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    return {
      steer: clamp(this.recognizer.steer + (right ? 1 : 0) - (left ? 1 : 0)),
      balance: clamp(this.recognizer.balance + (upKey ? 1 : 0) - (downKey ? 1 : 0)),
    }
  }

  // --- Ciclo de juego --------------------------------------------------------------------------

  /** Arranca desde el menu inicial (gesto del usuario: habilita el audio). */
  start() {
    if (this.phase !== 'ready') return
    unlockAudio()
    this.resume()
    if (!this.hintShown) {
      this.hintShown = true
      this.popup(copy.migaskate.hintFirst, 'hint')
    }
  }

  resume() {
    this.last = performance.now()
    this.setPhase('playing')
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (this.phase !== 'playing') return
    cancelAnimationFrame(this.raf)
    this.recognizer.clear()
    this.session.gesture({ k: 'grabEnd' })
    this.setPhase('paused')
  }

  /** Cierra la sesion antes de tiempo (cobra el combo que quedaba). */
  finishNow() {
    if (this.phase !== 'playing' && this.phase !== 'paused') return
    cancelAnimationFrame(this.raf)
    this.session.finish()
    this.react(this.session.drain())
    this.beginEnd()
  }

  private adaptResolution(frameMs: number) {
    this.slowMs += frameMs
    if (++this.frame % FRAME_SAMPLES !== 0) return
    // Si el celular no llega a ~45 fps, se baja la definicion de a poco (nunca vuelve a subir).
    if (this.slowMs / FRAME_SAMPLES > SLOW_FRAME_MS && this.dpr > 0.6) {
      this.dpr = Math.max(0.6, this.dpr - 0.25)
      this.layout()
    }
    this.slowMs = 0
  }

  private readonly tick = (now: number) => {
    if (this.phase !== 'playing') return
    const frameMs = Math.min(now - this.last, 100)
    this.last = now
    this.adaptResolution(frameMs)

    const { session } = this
    for (const g of this.recognizer.update(now)) session.gesture(g)
    this.recognizer.grindingHint = session.skater.mode === 'grind'
    session.update(Math.min(frameMs / 1000, MAX_ADVANCE), this.input())
    this.react(session.drain())
    this.drawFrame(now)

    if (now - this.lastHud > HUD_EVERY_MS) {
      this.lastHud = now
      this.callbacks.onHud(hudOf(session))
    }
    if (session.finished) {
      this.beginEnd()
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private beginEnd() {
    this.callbacks.onHud(hudOf(this.session))
    this.setPhase('ended')
    sfx.star()
    this.endTimer = window.setTimeout(
      () => this.callbacks.onEnd(resultOf(this.session)),
      END_DELAY_MS,
    )
  }

  private popup(text: string, kind: SkatePopup['kind']) {
    this.callbacks.onPopup({ id: ++this.popupId, text, kind })
  }

  private react(events: readonly SessionEvent[]) {
    const sk = this.session.skater
    for (const e of events) {
      switch (e.t) {
        case 'push':
          sfx.push()
          break
        case 'pop':
          sfx.pop()
          break
        case 'flip':
          sfx.flip()
          break
        case 'land':
          sfx.land()
          if (e.hard) {
            this.renderer?.addShake(0.15)
            vibrate(15)
          }
          this.renderer?.burst({ x: sk.x, y: sk.y + 0.05, z: sk.z, count: 5, speed: 1.6 })
          break
        case 'grindStart':
          sfx.grind()
          break
        case 'grabStart':
          sfx.grab()
          break
        case 'bump':
          sfx.bump()
          this.renderer?.addShake(0.12)
          break
        case 'trick': {
          sfx.trick()
          const name = copy.migaskate.tricks[e.item.key] ?? e.item.key
          const label = e.item.nollie ? `${copy.migaskate.nollie} ${name}` : name
          this.popup(`${label} +${e.item.points}`, 'trick')
          break
        }
        case 'bank':
          sfx.bank()
          vibrate(20)
          this.popup(copy.migaskate.bank(e.points), 'bank')
          break
        case 'bail': {
          sfx.bail()
          this.renderer?.addShake(0.2)
          const text =
            e.reason === 'manual'
              ? copy.migaskate.bailManual
              : e.reason === 'grind'
                ? copy.migaskate.bailGrind
                : copy.migaskate.bails[this.bailCount % copy.migaskate.bails.length]!
          this.bailCount++
          this.popup(text, 'bail')
          break
        }
        case 'lost':
          this.popup(copy.migaskate.lost(e.points), 'bail')
          break
        case 'objective': {
          sfx.star()
          vibrate([20, 30, 20])
          const text = copy.migaskate.objective(this.session.spot.objectives[e.index]!)
          this.popup(copy.migaskate.objectiveDone(text), 'objective')
          break
        }
        default:
      }
    }
    // Chispas mientras se patina sobre un riel.
    if (sk.mode === 'grind' && this.frame % 3 === 0) {
      this.renderer?.burst({ x: sk.x, y: sk.y, z: sk.z, count: 1, speed: 1.2 })
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.endTimer)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    for (const undo of this.cleanup) undo()
    this.renderer?.dispose()
    this.renderer = null
  }
}
