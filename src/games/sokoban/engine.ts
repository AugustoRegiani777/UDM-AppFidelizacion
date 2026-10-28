// Motor de "Entregas de Miga" (estilo Sokoban): empujás cajas con tu vehículo hasta los puntos de entrega.
// Reglas: un solo movimiento por vez; solo se empuja UNA caja; no se puede empujar contra una pared ni
// contra otra caja; no se tira de las cajas. El mapa se escribe como texto:
//   # pared   (espacio) piso   . entrega   $ caja   * caja en entrega   @ vos   + vos en entrega

export type Dir = 'U' | 'D' | 'L' | 'R'
export const DIR_LIST: readonly Dir[] = ['U', 'D', 'L', 'R']
export const DELTA: Record<Dir, readonly [number, number]> = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
}
export const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' }

/** La parte del mapa que no cambia durante la partida. */
export interface Layout {
  w: number
  h: number
  wall: boolean[]
  goal: boolean[]
  /** Piso al que se llega caminando desde el inicio (el resto es decorado afuera del mapa). */
  inside: boolean[]
  startBoxes: number[]
  startPlayer: number
}

export function parseLevel(rows: readonly string[]): Layout {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const wall: boolean[] = Array(w * h).fill(false)
  const goal: boolean[] = Array(w * h).fill(false)
  const startBoxes: number[] = []
  let startPlayer = -1
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? ' '
      const i = y * w + x
      if (ch === '#') wall[i] = true
      if (ch === '.' || ch === '*' || ch === '+') goal[i] = true
      if (ch === '$' || ch === '*') startBoxes.push(i)
      if (ch === '@' || ch === '+') startPlayer = i
    }
  })
  if (startPlayer < 0) throw new Error('el mapa no tiene jugador')
  if (startBoxes.length === 0) throw new Error('el mapa no tiene cajas')
  const goals = goal.filter(Boolean).length
  if (goals !== startBoxes.length) throw new Error('tiene que haber tantas entregas como cajas')

  // Piso alcanzable desde el jugador (cruzando cajas: son móviles).
  const inside: boolean[] = Array(w * h).fill(false)
  const stack = [startPlayer]
  inside[startPlayer] = true
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = Math.floor(i / w)
    for (const dir of DIR_LIST) {
      const [dx, dy] = DELTA[dir]
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const n = ny * w + nx
      if (wall[n] || inside[n]) continue
      inside[n] = true
      stack.push(n)
    }
  }
  return { w, h, wall, goal, inside, startBoxes, startPlayer }
}

export interface StepResult {
  /** Cuál caja se movió, si hubo empuje. */
  pushed: { from: number; to: number } | null
  /** El empuje dejó una caja sobre una entrega (para el efecto de brillo). */
  landed: boolean
}

interface HistoryEntry {
  dir: Dir
  pushed: boolean
}

export class Board {
  readonly layout: Layout
  boxes: number[]
  player: number
  moves = 0
  pushes = 0
  private history: HistoryEntry[] = []

  constructor(layout: Layout) {
    this.layout = layout
    this.boxes = [...layout.startBoxes]
    this.player = layout.startPlayer
  }

  reset() {
    this.boxes = [...this.layout.startBoxes]
    this.player = this.layout.startPlayer
    this.moves = 0
    this.pushes = 0
    this.history = []
  }

  boxAt(cell: number): number {
    return this.boxes.indexOf(cell)
  }

  private cellAfter(cell: number, dir: Dir): number {
    const { w, h } = this.layout
    const [dx, dy] = DELTA[dir]
    const x = (cell % w) + dx
    const y = Math.floor(cell / w) + dy
    if (x < 0 || y < 0 || x >= w || y >= h) return -1
    return y * w + x
  }

  /** Intenta mover. Devuelve null si no se puede (pared, o caja trabada). */
  move(dir: Dir): StepResult | null {
    const { wall, goal } = this.layout
    const next = this.cellAfter(this.player, dir)
    if (next < 0 || wall[next]) return null
    const index = this.boxAt(next)
    let result: StepResult = { pushed: null, landed: false }
    if (index >= 0) {
      const beyond = this.cellAfter(next, dir)
      if (beyond < 0 || wall[beyond] || this.boxAt(beyond) >= 0) return null
      this.boxes[index] = beyond
      this.pushes++
      result = { pushed: { from: next, to: beyond }, landed: goal[beyond] === true }
    }
    this.player = next
    this.moves++
    this.history.push({ dir, pushed: result.pushed !== null })
    return result
  }

  get canUndo() {
    return this.history.length > 0
  }

  /** Deshace el último movimiento. Devuelve lo que se revirtió (para animar), o null. */
  undo(): { dir: Dir; pushed: { from: number; to: number } | null } | null {
    const last = this.history.pop()
    if (!last) return null
    const back = OPPOSITE[last.dir]
    const previous = this.cellAfter(this.player, back)
    let pushed: { from: number; to: number } | null = null
    if (last.pushed) {
      const ahead = this.cellAfter(this.player, last.dir)
      const index = this.boxAt(ahead)
      // La caja que se empujó está ahora delante del jugador: vuelve adonde estaba el jugador.
      this.boxes[index] = this.player
      pushed = { from: ahead, to: this.player }
      this.pushes--
    }
    this.player = previous
    this.moves--
    return { dir: last.dir, pushed }
  }

  get boxesOnGoal(): number {
    return this.boxes.filter((b) => this.layout.goal[b]).length
  }

  get solved(): boolean {
    return this.boxesOnGoal === this.boxes.length
  }

  /** Camino de teclas hecho hasta ahora. */
  get path(): string {
    return this.history.map((h) => h.dir).join('')
  }

  /** Aplica una secuencia de teclas ('UDLR'). Devuelve cuántas se pudieron hacer. */
  play(keys: string): number {
    let done = 0
    for (const ch of keys) {
      if (this.move(ch as Dir)) done++
    }
    return done
  }
}

/** Estrellas según los movimientos hechos respecto de la marca de referencia del nivel. */
export function starsFor(moves: number, par: number): number {
  if (moves <= Math.ceil(par * 1.15)) return 3
  if (moves <= Math.ceil(par * 1.7)) return 2
  return 1
}
