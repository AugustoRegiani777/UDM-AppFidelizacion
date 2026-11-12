// Rally de Cocina: el control táctil ANTERIOR (cruceta de 4 botones separados), guardado SOLO como
// referencia para comparar en las pruebas de jugabilidad (touchPlayability.test.ts). El juego no lo usa.
//
// Comportamiento original: cada dedo apoya en un botón a la vez (el más cercano hasta 12 px); si el
// dedo se desliza, cambia de botón; si sale de todos, no aprieta nada. La dirección es todo-o-nada.

export type LegacyButton = 'up' | 'down' | 'left' | 'right' | 'item' | 'handbrake'

export interface LegacyRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface LegacyState {
  throttle: number
  brake: number
  steer: number
  handbrake: boolean
  useItem: boolean
}

export function legacyHitTest(
  rects: Partial<Record<LegacyButton, LegacyRect>>,
  x: number,
  y: number,
  slop = 12,
): LegacyButton | null {
  let best: LegacyButton | null = null
  let bestD = Infinity
  for (const id of Object.keys(rects) as LegacyButton[]) {
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

export class LegacyTouchModel {
  private readonly pointers = new Map<number, LegacyButton | null>()
  down(id: number, button: LegacyButton | null) {
    this.pointers.set(id, button)
  }
  move(id: number, button: LegacyButton | null) {
    if (this.pointers.has(id)) this.pointers.set(id, button)
  }
  up(id: number) {
    this.pointers.delete(id)
  }
  state(): LegacyState {
    const p = new Set<LegacyButton>()
    for (const b of this.pointers.values()) if (b) p.add(b)
    return {
      throttle: p.has('up') ? 1 : 0,
      brake: p.has('down') ? 1 : 0,
      steer: (p.has('left') ? 1 : 0) - (p.has('right') ? 1 : 0),
      handbrake: p.has('handbrake'),
      useItem: p.has('item'),
    }
  }
}

/** Dónde caían los botones viejos (CSS original: botón = clamp(64px, 19vh, 78px), cruceta 3x3 con hueco de 6 px). */
export function legacyLayout(width: number, height: number): Record<LegacyButton, LegacyRect> {
  const b = Math.min(78, Math.max(64, height * 0.19))
  const gap = 6
  const padLeft = 14
  const padTop = height - 12 - (3 * b + 2 * gap)
  const cell = (col: number, row: number): LegacyRect => ({
    left: padLeft + col * (b + gap),
    top: padTop + row * (b + gap),
    right: padLeft + col * (b + gap) + b,
    bottom: padTop + row * (b + gap) + b,
  })
  const itemW = b * 1.28
  const item: LegacyRect = {
    left: width - 14 - itemW,
    right: width - 14,
    top: height - 12 - itemW,
    bottom: height - 12,
  }
  const handbrake: LegacyRect = {
    left: item.left - 14 - b,
    right: item.left - 14,
    top: height - 12 - b,
    bottom: height - 12,
  }
  return {
    up: cell(1, 0),
    left: cell(0, 1),
    right: cell(2, 1),
    down: cell(1, 2),
    item,
    handbrake,
  }
}
