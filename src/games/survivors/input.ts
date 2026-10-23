// Controles: un joystick que aparece donde apoyás el dedo (o el mouse) y las teclas WASD / flechas.
// Lo único que llega a la simulación es un índice de dirección (0..15) o NO_DIR.

import { NO_DIR } from '@engine/config.ts'
import type { JoystickView } from './renderer.ts'

const DEAD_ZONE = 9
const MAX_PULL = 36

/** Índices de dirección por combinación de teclas (x, y) → 0 = derecha, sentido horario en pantalla. */
const KEY_DIRS: Record<string, number> = {
  '1,0': 0,
  '1,1': 2,
  '0,1': 4,
  '-1,1': 6,
  '-1,0': 8,
  '-1,-1': 10,
  '0,-1': 12,
  '1,-1': 14,
}

const KEY_VECTORS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  w: [0, -1],
  W: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  S: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  A: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
  D: [1, 0],
}

/** Cuantiza un vector de pantalla a una de las 16 direcciones. */
export function quantizeDirection(dx: number, dy: number): number {
  if (dx * dx + dy * dy < DEAD_ZONE * DEAD_ZONE) return NO_DIR
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 8))
  return ((sector % 16) + 16) % 16
}

export class InputController {
  private pointerId: number | null = null
  private origin = { x: 0, y: 0 }
  private pointer = { x: 0, y: 0 }
  private pointerDir = NO_DIR
  private keys = new Set<string>()
  private readonly cleanup: (() => void)[] = []

  /** `toArena` convierte coordenadas de pantalla a unidades lógicas de la arena. */
  constructor(
    surface: HTMLElement,
    private readonly toArena: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    const down = (e: PointerEvent) => {
      if (this.pointerId !== null) return
      // Los menús y botones se tocan normalmente: el joystick solo arranca sobre el juego.
      if ((e.target as HTMLElement).closest('button, input, label, [role="dialog"]')) return
      this.pointerId = e.pointerId
      this.origin = this.toArena(e.clientX, e.clientY)
      this.pointer = { ...this.origin }
      this.pointerDir = NO_DIR
      surface.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return
      const p = this.toArena(e.clientX, e.clientY)
      const dx = p.x - this.origin.x
      const dy = p.y - this.origin.y
      const len = Math.sqrt(dx * dx + dy * dy)
      // Si te pasás del radio, el origen te sigue: así nunca "te quedás sin palanca".
      if (len > MAX_PULL * 1.6) {
        const k = (len - MAX_PULL * 1.6) / len
        this.origin = { x: this.origin.x + dx * k, y: this.origin.y + dy * k }
      }
      this.pointer = p
      this.pointerDir = quantizeDirection(p.x - this.origin.x, p.y - this.origin.y)
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return
      this.pointerId = null
      this.pointerDir = NO_DIR
    }
    const keyDown = (e: KeyboardEvent) => {
      if (e.key in KEY_VECTORS) {
        this.keys.add(e.key)
        e.preventDefault()
      }
    }
    const keyUp = (e: KeyboardEvent) => this.keys.delete(e.key)
    const blur = () => {
      this.keys.clear()
      this.pointerId = null
      this.pointerDir = NO_DIR
    }
    const noMenu = (e: Event) => e.preventDefault()

    surface.addEventListener('pointerdown', down)
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerup', up)
    surface.addEventListener('pointercancel', up)
    surface.addEventListener('contextmenu', noMenu)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    this.cleanup.push(
      () => surface.removeEventListener('pointerdown', down),
      () => surface.removeEventListener('pointermove', move),
      () => surface.removeEventListener('pointerup', up),
      () => surface.removeEventListener('pointercancel', up),
      () => surface.removeEventListener('contextmenu', noMenu),
      () => window.removeEventListener('keydown', keyDown),
      () => window.removeEventListener('keyup', keyUp),
      () => window.removeEventListener('blur', blur),
    )
  }

  direction(): number {
    if (this.pointerId !== null) return this.pointerDir
    let x = 0
    let y = 0
    for (const key of this.keys) {
      const v = KEY_VECTORS[key]
      if (v) {
        x += v[0]
        y += v[1]
      }
    }
    return KEY_DIRS[`${Math.sign(x)},${Math.sign(y)}`] ?? NO_DIR
  }

  view(): JoystickView {
    if (this.pointerId === null) return { active: false, originX: 0, originY: 0, x: 0, y: 0 }
    const dx = this.pointer.x - this.origin.x
    const dy = this.pointer.y - this.origin.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const clamp = Math.min(len, MAX_PULL) / len
    return {
      active: true,
      originX: this.origin.x,
      originY: this.origin.y,
      x: this.origin.x + dx * clamp,
      y: this.origin.y + dy * clamp,
    }
  }

  dispose() {
    this.cleanup.forEach((fn) => fn())
    this.cleanup.length = 0
  }
}
