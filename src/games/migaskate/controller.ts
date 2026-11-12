// Controlador de "Miga Skate": une la sesion (fisica y combos), el control tactil multi-touch, el dibujo
// 3D, el game feel (SkateJuice) y el tutorial. Es TypeScript puro (sin React): el lazo de animacion vive
// aca y React solo muestra menus, HUD y la tabla tactil. three.js se carga recien al entrar al juego
// (import dinamico).

import { copy } from '@/copy'
import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import type { Gesture } from './gestures.ts'
import { SkateJuice } from './juice.ts'
import { objectiveValue, SkateSession, type SessionEvent } from './session.ts'
import { spotAt } from './spots.ts'
import { SkateTouchController } from './touchController.ts'
import { Tutorial, tutorialSeen, type TutorialStep } from './tutorial.ts'
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
  /** Estado de la maquina de estados de la tabla (para pruebas y para la ayuda en pantalla). */
  state: string
  tutorial: TutorialStep | null
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

export interface SkateOptions {
  leftHanded?: boolean
}

const MAX_DPR = 2
const SLOW_FRAME_MS = 22
const FRAME_SAMPLES = 90
const END_DELAY_MS = 1800
const HUD_EVERY_MS = 90
/** Segundos de juego que se simulan como maximo por cuadro (si el celular se traba, no se acumula). */
const MAX_ADVANCE = 0.1

export function hudOf(session: SkateSession, tutorial: TutorialStep | null = null): SkateHud {
  const p = session.physics
  let balance: number | null = null
  if (p.state === 'grinding' && p.grind) balance = p.grind.bal
  else if (p.manual) balance = p.manual.bal
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
    speed: p.horizontalSpeed,
    airborne: p.airborne,
    state: p.state,
    tutorial,
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
  readonly touch: SkateTouchController
  private readonly tutorial: Tutorial
  private renderer: SkateRenderer | null = null
  private juice: SkateJuice | null = null
  private phase: SkatePhase = 'loading'
  private raf = 0
  private last = 0
  private frame = 0
  private slowMs = 0
  private lastHud = 0
  private hitStopMs = 0
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
    options: SkateOptions = {},
  ) {
    this.session = new SkateSession(spotAt(spotIndex))
    this.tutorial = new Tutorial(spotIndex !== 0 || tutorialSeen())
    this.touch = new SkateTouchController(() => ({
      state: this.session.physics.state,
      boardYaw: this.session.physics.boardYaw,
      cameraYaw: this.renderer?.cameraYaw ?? this.session.physics.boardYaw,
    }))
    this.touch.leftHanded = options.leftHanded ?? false
    this.resizeObserver = new ResizeObserver(() => this.layout())
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.bindKeys()
    void this.load()
  }

  get tutorialStep(): TutorialStep | null {
    return this.tutorial.step
  }

  skipTutorial() {
    this.tutorial.skip()
    this.callbacks.onHud(this.hud())
  }

  setLeftHanded(on: boolean) {
    this.touch.leftHanded = on
  }

  private hud() {
    return hudOf(this.session, this.tutorial.step)
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
      this.setupJuice(this.renderer)
      this.layout()
      this.drawFrame(performance.now())
      this.setPhase('ready')
      this.callbacks.onHud(this.hud())
    } catch {
      if (!this.disposed) this.setPhase('error')
    }
  }

  /** Conecta los hooks de la fisica con audio, particulas, haptica, camara y hit-stop. */
  private setupJuice(renderer: SkateRenderer) {
    this.juice = new SkateJuice(
      this.session.physics,
      {
        sfx: {
          pop: (power) => sfx.pop(power),
          land: (intensity, sloppy) => sfx.land(intensity, sloppy),
          flip: () => sfx.flip(),
          grind: () => sfx.grind(),
          grindLoop: (speed) => sfx.grindLoop(speed),
          grab: () => sfx.grab(),
          bump: () => sfx.bump(),
          bail: () => sfx.bail(),
          push: () => sfx.push(),
          catch: () => sfx.catch(),
        },
        haptic: (pattern) => vibrate(pattern),
        particles: {
          burst: (b) => renderer.burst(b),
          trail: (x, y, z) => renderer.trail(x, y, z),
        },
        shake: (amount) => renderer.addShake(amount),
        hitStop: (ms) => {
          this.hitStopMs = Math.max(this.hitStopMs, ms)
        },
      },
      { reduced: this.reduced },
    )
  }

  private layout() {
    this.renderer?.resize(this.container.clientWidth, this.container.clientHeight, this.dpr)
    if (this.renderer && this.phase !== 'playing') this.drawFrame(performance.now())
  }

  private drawFrame(now: number) {
    if (!this.renderer) return
    const view = this.session.physics.view(this.session.alpha)
    if (this.juice) this.renderer.setRailWear(this.juice.railWear)
    this.renderer.render(view, this.touch.steer, now, this.juice?.squash ?? 0)
  }

  private setPhase(next: SkatePhase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  // --- Entradas -------------------------------------------------------------------------------

  /**
   * Un dedo de la tabla tactil (coordenadas del pad, ver touchController.ts). `t` es la marca de tiempo
   * del evento: si el celular se traba dibujando, los toques conservan su tiempo real.
   */
  pointer(
    kind: 'down' | 'move' | 'up' | 'cancel',
    id: number,
    u: number,
    v: number,
    t: number = performance.now(),
  ) {
    if (this.phase !== 'playing') return
    if (kind === 'down') this.touch.down(id, u, v, t)
    else if (kind === 'move') this.touch.move(id, u, v, t)
    else if (kind === 'up') this.touch.up(id, u, v, t)
    else this.touch.cancel(id)
  }

  /** Teclado para probar en la compu: las mismas acciones que los gestos. */
  private bindKeys() {
    const map: Record<string, Gesture> = {
      ' ': { k: 'ollie', power: 0.8, nollie: false },
      w: { k: 'ollie', power: 0.8, nollie: false },
      n: { k: 'ollie', power: 0.8, nollie: true },
      k: { k: 'flip', power: 0.5, dir: 1 },
      h: { k: 'flip', power: 0.5, dir: -1 },
      j: { k: 'shuvit', power: 0.5, dir: 1 },
      s: { k: 'popShuvit', power: 0.8, dir: 1, nollie: false },
      e: { k: 'spin', power: 0.5, dir: 1 },
      p: { k: 'push', power: 0.7 },
      g: { k: 'grab', name: 'indy' },
      m: { k: 'manual', nose: false },
      c: { k: 'catch' },
    }
    const release: Record<string, Gesture> = {
      g: { k: 'grabEnd' },
      m: { k: 'manualEnd' },
      c: { k: 'catchEnd' },
    }
    const down = (e: KeyboardEvent) => {
      if (this.phase !== 'playing' || e.repeat) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const g = map[key]
      if (g) this.session.gesture(g)
      if (key.startsWith('Arrow') || key === ' ') e.preventDefault()
      this.keys.add(key)
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      this.keys.delete(key)
      const g = release[key]
      if (g && this.phase === 'playing') this.session.gesture(g)
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
      steer: clamp(this.touch.steer + (right ? 1 : 0) - (left ? 1 : 0)),
      balance: clamp(this.touch.balance + (upKey ? 1 : 0) - (downKey ? 1 : 0)),
    }
  }

  // --- Ciclo de juego --------------------------------------------------------------------------

  /** Arranca desde el menu inicial (gesto del usuario: habilita el audio). */
  start() {
    if (this.phase !== 'ready') return
    unlockAudio()
    this.resume()
    if (!this.hintShown && !this.tutorial.step) {
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
    this.touch.clear()
    this.session.gesture({ k: 'grabEnd' })
    this.session.gesture({ k: 'catchEnd' })
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
    for (const g of this.touch.update(now)) session.gesture(g)
    if (this.hitStopMs > 0) {
      // Hit-stop: un instante de congelamiento al caer fuerte (la imagen sigue dibujandose).
      this.hitStopMs -= frameMs
    } else {
      session.update(Math.min(frameMs / 1000, MAX_ADVANCE), this.input())
    }
    this.react(session.drain())
    this.juice?.update(frameMs / 1000, session.physics.view(session.alpha))
    this.drawFrame(now)

    if (now - this.lastHud > HUD_EVERY_MS) {
      this.lastHud = now
      this.callbacks.onHud(this.hud())
    }
    if (session.finished) {
      this.beginEnd()
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private beginEnd() {
    this.callbacks.onHud(this.hud())
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

  /**
   * Reacciona a los eventos de la sesion: carteles y los sonidos de puntaje. Los sonidos y efectos de
   * la tabla (pop, land, grind, bump, bail, flip...) los dispara SkateJuice desde los hooks de la fisica.
   */
  private react(events: readonly SessionEvent[]) {
    for (const e of events) {
      if (this.tutorial.onEvent(e)) {
        this.callbacks.onHud(this.hud())
        this.popup(copy.migaskate.tutorialNice, 'hint')
      }
      switch (e.t) {
        case 'land':
          if (e.quality === 'sloppy' && e.trick) this.popup(copy.migaskate.sloppy, 'hint')
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
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.endTimer)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    for (const undo of this.cleanup) undo()
    this.juice?.dispose()
    this.renderer?.dispose()
    this.renderer = null
  }
}
