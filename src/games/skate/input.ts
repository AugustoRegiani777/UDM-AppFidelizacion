// Controles del skate con los dos pulgares: la mitad izquierda de la pantalla es el pulgar izquierdo
// (un joystick que aparece donde apoyás) y la derecha es el botón. También funciona con teclado.
// A la simulación solo llega: pulgar izquierdo 0..8 (nada + 8 direcciones) y derecho apretado o no.

import { STICK_NONE } from '@skate/config.ts'

const DEAD_ZONE = 12
const MAX_PULL = 44

export interface ThumbsView {
  stick: { active: boolean; originX: number; originY: number; x: number; y: number }
  button: { active: boolean; x: number; y: number }
}

/** Cuantiza un vector de pantalla a: 1 →, 2 ↘, 3 ↓, 4 ↙, 5 ←, 6 ↖, 7 ↑, 8 ↗ (0 = nada). */
export function quantizeStick(dx: number, dy: number): number {
  if (dx * dx + dy * dy < DEAD_ZONE * DEAD_ZONE) return STICK_NONE
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  return (((sector % 8) + 8) % 8) + 1
}

const KEY_STICK: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  A: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
  D: [1, 0],
  ArrowUp: [0, -1],
  w: [0, -1],
  W: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  S: [0, 1],
}
const KEY_BUTTON = new Set([' ', 'Shift', 'k', 'K'])

const BY_VECTOR: Record<string, number> = {
  '1,0': 1,
  '1,1': 2,
  '0,1': 3,
  '-1,1': 4,
  '-1,0': 5,
  '-1,-1': 6,
  '0,-1': 7,
  '1,-1': 8,
}

export class ThumbsInput {
  private stickId: number | null = null
  private buttonId: number | null = null
  private origin = { x: 0, y: 0 }
  private pointer = { x: 0, y: 0 }
  private buttonAt = { x: 0, y: 0 }
  private stickValue = STICK_NONE
  private keys = new Set<string>()
  private readonly cleanup: (() => void)[] = []

  /** `toView` convierte coordenadas de pantalla a las del dibujo (para el joystick visual). */
  constructor(
    surface: HTMLElement,
    private readonly toView: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, input, label, [role="dialog"]')) return
      const left = e.clientX < surface.getBoundingClientRect().left + surface.clientWidth / 2
      if (left && this.stickId === null) {
        this.stickId = e.pointerId
        this.origin = this.toView(e.clientX, e.clientY)
        this.pointer = { ...this.origin }
        this.stickValue = STICK_NONE
      } else if (!left && this.buttonId === null) {
        this.buttonId = e.pointerId
        this.buttonAt = this.toView(e.clientX, e.clientY)
      } else return
      try {
        surface.setPointerCapture(e.pointerId)
      } catch {
        // la captura es opcional
      }
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return
      const p = this.toView(e.clientX, e.clientY)
      const dx = p.x - this.origin.x
      const dy = p.y - this.origin.y
      const len = Math.sqrt(dx * dx + dy * dy)
      // El origen sigue al dedo si se pasa del radio: nunca se "pierde la palanca".
      if (len > MAX_PULL * 1.5) {
        const k = (len - MAX_PULL * 1.5) / len
        this.origin = { x: this.origin.x + dx * k, y: this.origin.y + dy * k }
      }
      this.pointer = p
      this.stickValue = quantizeStick(p.x - this.origin.x, p.y - this.origin.y)
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null
        this.stickValue = STICK_NONE
      }
      if (e.pointerId === this.buttonId) this.buttonId = null
    }
    const keyDown = (e: KeyboardEvent) => {
      if (e.key in KEY_STICK || KEY_BUTTON.has(e.key)) {
        this.keys.add(e.key)
        e.preventDefault()
      }
    }
    const keyUp = (e: KeyboardEvent) => this.keys.delete(e.key)
    const blur = () => {
      this.keys.clear()
      this.stickId = null
      this.buttonId = null
      this.stickValue = STICK_NONE
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

  /** Pulgar izquierdo: 0..8. */
  stick(): number {
    if (this.stickId !== null) return this.stickValue
    let x = 0
    let y = 0
    for (const key of this.keys) {
      const v = KEY_STICK[key]
      if (v) {
        x += v[0]
        y += v[1]
      }
    }
    return BY_VECTOR[`${Math.sign(x)},${Math.sign(y)}`] ?? STICK_NONE
  }

  /** Pulgar derecho apretado. */
  button(): boolean {
    if (this.buttonId !== null) return true
    for (const key of this.keys) if (KEY_BUTTON.has(key)) return true
    return false
  }

  view(): ThumbsView {
    const dx = this.pointer.x - this.origin.x
    const dy = this.pointer.y - this.origin.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const clamp = Math.min(len, MAX_PULL) / len
    return {
      stick: {
        active: this.stickId !== null,
        originX: this.origin.x,
        originY: this.origin.y,
        x: this.origin.x + dx * clamp,
        y: this.origin.y + dy * clamp,
      },
      button: { active: this.buttonId !== null, x: this.buttonAt.x, y: this.buttonAt.y },
    }
  }

  dispose() {
    this.cleanup.forEach((fn) => fn())
    this.cleanup.length = 0
  }
}
