// Rally de Cocina: modelo de los botones táctiles (sin DOM). Cada dedo (puntero) apoya en un
// botón a la vez; el estado de los botones se convierte en {acelerar, frenar, doblar, freno de mano, ítem}.

export type PadButton = 'up' | 'down' | 'left' | 'right'
export type ActionButton = 'item' | 'handbrake'
export type TouchButton = PadButton | ActionButton

export interface TouchState {
  throttle: number
  brake: number
  /** > 0 dobla a la izquierda, < 0 a la derecha (igual que el teclado de la demo). */
  steer: number
  handbrake: boolean
  /** Verdadero mientras el botón del ítem está apretado. */
  useItem: boolean
}

export const EMPTY_TOUCH: TouchState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  useItem: false,
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Botón bajo el dedo. Si el dedo cae entre botones (hasta `slop` px de uno), toma el más cercano. */
export function hitTest(
  rects: Partial<Record<TouchButton, Rect>>,
  x: number,
  y: number,
  slop = 10,
): TouchButton | null {
  let best: TouchButton | null = null
  let bestD = Infinity
  for (const id of Object.keys(rects) as TouchButton[]) {
    const r = rects[id]!
    const dx = Math.max(r.left - x, 0, x - r.right)
    const dy = Math.max(r.top - y, 0, y - r.bottom)
    const d = Math.hypot(dx, dy)
    if (d <= slop && d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}

export class TouchModel {
  /** Qué botón tiene cada dedo. */
  private readonly pointers = new Map<number, TouchButton | null>()

  constructor(private readonly onPress?: (button: TouchButton) => void) {}

  /** Un dedo toca un botón (o la nada). Avisa `onPress` cuando el toque empieza justo sobre un botón. */
  down(pointerId: number, button: TouchButton | null) {
    this.pointers.set(pointerId, button)
    if (button !== null) this.onPress?.(button)
  }

  /** El dedo se desliza: pasa a otro botón (o sale de todos). No vuelve a disparar `onPress`. */
  move(pointerId: number, button: TouchButton | null) {
    if (!this.pointers.has(pointerId)) return
    this.pointers.set(pointerId, button)
  }

  /** El dedo sigue apoyado (aunque esté entre botones: si vuelve a uno, lo retoma). */
  has(pointerId: number) {
    return this.pointers.has(pointerId)
  }

  up(pointerId: number) {
    this.pointers.delete(pointerId)
  }
  cancel(pointerId: number) {
    this.pointers.delete(pointerId)
  }
  clear() {
    this.pointers.clear()
  }

  pressed(): Set<TouchButton> {
    const out = new Set<TouchButton>()
    for (const b of this.pointers.values()) if (b) out.add(b)
    return out
  }

  state(): TouchState {
    const p = this.pressed()
    return {
      throttle: p.has('up') ? 1 : 0,
      brake: p.has('down') ? 1 : 0,
      steer: (p.has('left') ? 1 : 0) - (p.has('right') ? 1 : 0),
      handbrake: p.has('handbrake'),
      useItem: p.has('item'),
    }
  }
}
