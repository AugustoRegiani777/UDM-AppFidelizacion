// Controlador de "Entregas de Miga": une las reglas (engine), el dibujo y los controles (teclado, deslizar el
// dedo y botones en pantalla). Es TypeScript puro; React solo muestra el HUD y los menús.

import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import { Board, starsFor, type Dir } from './engine.ts'
import type { Level } from './levels.ts'
import { SokobanRenderer } from './renderer.ts'

export interface SokobanHud {
  moves: number
  pushes: number
  onGoal: number
  total: number
  canUndo: boolean
}

export interface SokobanWin {
  moves: number
  pushes: number
  stars: number
}

export interface SokobanCallbacks {
  onHud: (hud: SokobanHud) => void
  onWin: (win: SokobanWin) => void
}

const KEYS: Record<string, Dir> = {
  ArrowUp: 'U',
  w: 'U',
  W: 'U',
  ArrowDown: 'D',
  s: 'D',
  S: 'D',
  ArrowLeft: 'L',
  a: 'L',
  A: 'L',
  ArrowRight: 'R',
  d: 'R',
  D: 'R',
}

const REPEAT_DELAY_MS = 190
const REPEAT_MS = 115
const SWIPE_PX = 26
const WIN_DELAY_MS = 1100
const MAX_DPR = 2.5

export class SokobanController {
  readonly board: Board
  private readonly renderer: SokobanRenderer
  private raf = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private heldKeys: string[] = []
  private repeatTimer = 0
  private repeatStart = 0
  private finished = false
  private winTimer = 0
  private swipe: { id: number; x: number; y: number } | null = null
  private readonly resizeObserver: ResizeObserver
  private readonly cleanup: (() => void)[] = []

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    private readonly level: Level,
    private readonly callbacks: SokobanCallbacks,
  ) {
    this.board = new Board(level.layout)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new SokobanRenderer(canvas, this.board, level.theme, reduced)
    this.layout()
    this.resizeObserver = new ResizeObserver(() => this.layout())
    this.resizeObserver.observe(container)
    this.bindInput()
    this.publish()
    this.raf = requestAnimationFrame(this.frame)
  }

  private layout() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    // Arriba va el HUD; abajo, la cruceta (en pantallas bajas, o sea de costado, casi no hace falta lugar).
    const low = h < 520
    this.renderer.resize(w, h, this.dpr, { top: low ? 56 : 84, bottom: low ? 20 : 200 })
  }

  private publish() {
    const { board } = this
    this.callbacks.onHud({
      moves: board.moves,
      pushes: board.pushes,
      onGoal: board.boxesOnGoal,
      total: board.boxes.length,
      canUndo: board.canUndo,
    })
  }

  /** Habilita el audio (hay que llamarlo desde un toque del usuario). */
  start() {
    unlockAudio()
  }

  /** Un paso en esa dirección (lo usan el teclado, el dedo y la cruceta). */
  press(dir: Dir) {
    if (this.finished) return
    const before = this.board.boxesOnGoal
    const result = this.board.move(dir)
    if (!result) {
      this.renderer.bumped(dir)
      sfx.blocked()
      return
    }
    this.renderer.moved(dir, result.pushed ? result.pushed.to : null)
    if (result.pushed) {
      sfx.push()
      vibrate(8)
      if (result.landed && this.board.boxesOnGoal > before) {
        this.renderer.landed(result.pushed.to)
        sfx.landed()
        vibrate(18)
      }
    } else {
      sfx.move(this.level.theme.vehicle)
    }
    this.publish()
    if (this.board.solved) this.finish()
  }

  undo() {
    if (this.finished) return
    const undone = this.board.undo()
    if (!undone) return
    sfx.undo()
    this.publish()
  }

  restart() {
    this.finished = false
    window.clearTimeout(this.winTimer)
    this.board.reset()
    this.renderer.snap()
    sfx.restart()
    this.publish()
  }

  private finish() {
    this.finished = true
    this.releaseAll()
    this.renderer.win()
    sfx.win()
    vibrate([30, 40, 30])
    const win: SokobanWin = {
      moves: this.board.moves,
      pushes: this.board.pushes,
      stars: starsFor(this.board.moves, this.level.par),
    }
    this.winTimer = window.setTimeout(() => this.callbacks.onWin(win), WIN_DELAY_MS)
  }

  // --- Controles ---------------------------------------------------------------------------------------

  /** Mantener apretada una dirección repite el paso (teclado y cruceta). */
  hold(dir: Dir) {
    this.release()
    this.press(dir)
    this.repeatStart = window.setTimeout(() => {
      this.repeatTimer = window.setInterval(() => this.press(dir), REPEAT_MS)
    }, REPEAT_DELAY_MS)
  }

  release() {
    window.clearTimeout(this.repeatStart)
    window.clearInterval(this.repeatTimer)
  }

  private releaseAll() {
    this.heldKeys = []
    this.release()
  }

  private bindInput() {
    const keyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.key === 'z' || e.key === 'Z') && !e.altKey) {
          e.preventDefault()
          this.undo()
        }
        return
      }
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        if (e.repeat || this.heldKeys.includes(e.key)) return
        this.heldKeys.push(e.key)
        this.hold(dir)
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault()
        this.undo()
      } else if (e.key === 'r' || e.key === 'R') {
        this.restart()
      }
    }
    const keyUp = (e: KeyboardEvent) => {
      if (!KEYS[e.key]) return
      this.heldKeys = this.heldKeys.filter((k) => k !== e.key)
      const last = this.heldKeys[this.heldKeys.length - 1]
      if (last) this.hold(KEYS[last]!)
      else this.release()
    }
    const blur = () => this.releaseAll()
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)

    // Deslizar el dedo en cualquier parte del mapa: cada ~26 px es un paso (arrastrando se encadenan).
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, [role="dialog"], a')) return
      this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const move = (e: PointerEvent) => {
      const s = this.swipe
      if (!s || e.pointerId !== s.id) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return
      this.press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U')
      this.swipe = { id: s.id, x: e.clientX, y: e.clientY }
    }
    const up = (e: PointerEvent) => {
      if (this.swipe && e.pointerId === this.swipe.id) this.swipe = null
    }
    this.container.addEventListener('pointerdown', down)
    this.container.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    this.cleanup.push(
      () => window.removeEventListener('keydown', keyDown),
      () => window.removeEventListener('keyup', keyUp),
      () => window.removeEventListener('blur', blur),
      () => this.container.removeEventListener('pointerdown', down),
      () => this.container.removeEventListener('pointermove', move),
      () => window.removeEventListener('pointerup', up),
      () => window.removeEventListener('pointercancel', up),
    )
  }

  private readonly frame = (now: number) => {
    this.renderer.render(now)
    this.raf = requestAnimationFrame(this.frame)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.winTimer)
    this.releaseAll()
    this.resizeObserver.disconnect()
    for (const undo of this.cleanup) undo()
  }
}
