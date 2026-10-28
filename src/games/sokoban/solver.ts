// Resolvedor de niveles: búsqueda A* sobre los EMPUJES (no sobre cada paso), así que encuentra la solución
// con menos empujes. Se usa para comprobar que cada nivel se puede ganar y para fijar su marca.
// No se usa dentro del juego.

import { DELTA, DIR_LIST, type Dir, type Layout } from './engine.ts'

export interface Solution {
  /** Teclas ('UDLR') de la solución completa, con los caminos más cortos entre empujes. */
  keys: string
  pushes: number
  moves: number
  /** Estados distintos que se exploraron (sirve para medir qué tan difícil es). */
  states: number
}

const opposite = (d: Dir): Dir => (d === 'U' ? 'D' : d === 'D' ? 'U' : d === 'L' ? 'R' : 'L')

function neighbor(layout: Layout, cell: number, dir: Dir): number {
  const { w, h } = layout
  const [dx, dy] = DELTA[dir]
  const x = (cell % w) + dx
  const y = Math.floor(cell / w) + dy
  if (x < 0 || y < 0 || x >= w || y >= h) return -1
  return y * w + x
}

/**
 * Mínimo de empujes que necesita una caja en cada casilla para llegar a alguna entrega (sin contar otras
 * cajas). Infinity = callejón sin salida: una caja ahí ya no se puede resolver.
 */
export function pushDistances(layout: Layout): number[] {
  const dist: number[] = Array(layout.w * layout.h).fill(Infinity)
  const queue: number[] = []
  layout.goal.forEach((g, i) => {
    if (g) {
      dist[i] = 0
      queue.push(i)
    }
  })
  for (let head = 0; head < queue.length; head++) {
    const y = queue[head]!
    for (const dir of DIR_LIST) {
      // La caja pudo venir de x = y - dir, empujada en dirección dir por un jugador parado en x - dir.
      const x = neighbor(layout, y, opposite(dir))
      if (x < 0 || layout.wall[x] || dist[x] !== Infinity) continue
      const pusher = neighbor(layout, x, opposite(dir))
      if (pusher < 0 || layout.wall[pusher]) continue
      dist[x] = dist[y]! + 1
      queue.push(x)
    }
  }
  return dist
}

/** Zona que el jugador puede recorrer sin empujar. Devuelve la marca por casilla y la casilla más chica. */
function reach(
  layout: Layout,
  player: number,
  boxSet: Uint8Array,
): { seen: Uint8Array; low: number } {
  const seen = new Uint8Array(layout.w * layout.h)
  const stack = [player]
  seen[player] = 1
  let low = player
  while (stack.length) {
    const c = stack.pop()!
    if (c < low) low = c
    for (const dir of DIR_LIST) {
      const n = neighbor(layout, c, dir)
      if (n < 0 || seen[n] || layout.wall[n] || boxSet[n]) continue
      seen[n] = 1
      stack.push(n)
    }
  }
  return { seen, low }
}

/** Camino más corto del jugador a una casilla, esquivando paredes y cajas. null si no llega. */
export function walkTo(
  layout: Layout,
  from: number,
  to: number,
  boxes: readonly number[],
): string | null {
  if (from === to) return ''
  const boxSet = new Uint8Array(layout.w * layout.h)
  for (const b of boxes) boxSet[b] = 1
  const prev = new Int32Array(layout.w * layout.h).fill(-2)
  const how: Dir[] = []
  const queue = [from]
  prev[from] = -1
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!
    for (const dir of DIR_LIST) {
      const n = neighbor(layout, c, dir)
      if (n < 0 || prev[n] !== -2 || layout.wall[n] || boxSet[n]) continue
      prev[n] = c
      how[n] = dir
      if (n === to) {
        let out = ''
        for (let at = to; at !== from; at = prev[at]!) out = how[at]! + out
        return out
      }
      queue.push(n)
    }
  }
  return null
}

interface Node {
  boxes: number[]
  player: number
  parent: number
  g: number
  /** Empuje que llevó a este nodo: caja que estaba en `box` y dirección. */
  box: number
  dir: Dir | ''
}

interface Entry {
  f: number
  g: number
  id: number
}

/** Cola de prioridad mínima por f = empujes hechos + estimación (a igual f, primero el más avanzado). */
class Heap {
  private items: Entry[] = []

  get size() {
    return this.items.length
  }

  private less(x: Entry, y: Entry) {
    return x.f < y.f || (x.f === y.f && x.g > y.g)
  }

  push(item: Entry) {
    const a = this.items
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!this.less(a[i]!, a[p]!)) break
      const tmp = a[i]!
      a[i] = a[p]!
      a[p] = tmp
      i = p
    }
  }

  pop(): Entry {
    const a = this.items
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && this.less(a[l]!, a[m]!)) m = l
        if (r < a.length && this.less(a[r]!, a[m]!)) m = r
        if (m === i) break
        const tmp = a[i]!
        a[i] = a[m]!
        a[m] = tmp
        i = m
      }
    }
    return top
  }
}

export function solve(layout: Layout, maxStates = 1_500_000): Solution | null {
  const size = layout.w * layout.h
  const dist = pushDistances(layout)
  const startBoxes = [...layout.startBoxes].sort((a, b) => a - b)
  if (startBoxes.some((b) => dist[b] === Infinity)) return null

  const isGoal = (boxes: number[]) => boxes.every((b) => layout.goal[b])
  const keyOf = (boxes: number[], low: number) => boxes.join(',') + '|' + low
  const estimate = (boxes: number[]) => boxes.reduce((sum, b) => sum + dist[b]!, 0)

  const nodes: Node[] = []
  const bestG = new Map<string, number>()
  const open = new Heap()
  const startSet = new Uint8Array(size)
  for (const b of startBoxes) startSet[b] = 1
  const startReach = reach(layout, layout.startPlayer, startSet)
  nodes.push({ boxes: startBoxes, player: layout.startPlayer, parent: -1, g: 0, box: -1, dir: '' })
  bestG.set(keyOf(startBoxes, startReach.low), 0)
  open.push({ f: estimate(startBoxes), g: 0, id: 0 })

  let goalNode = -1
  while (open.size) {
    if (nodes.length > maxStates) return null
    const { id } = open.pop()
    const node = nodes[id]!
    if (isGoal(node.boxes)) {
      goalNode = id
      break
    }
    const boxSet = new Uint8Array(size)
    for (const b of node.boxes) boxSet[b] = 1
    const { seen } = reach(layout, node.player, boxSet)
    for (let i = 0; i < node.boxes.length; i++) {
      const box = node.boxes[i]!
      for (const dir of DIR_LIST) {
        const behind = neighbor(layout, box, opposite(dir))
        const ahead = neighbor(layout, box, dir)
        if (behind < 0 || ahead < 0 || !seen[behind]) continue
        if (layout.wall[ahead] || boxSet[ahead] || dist[ahead] === Infinity) continue
        const next = node.boxes.slice()
        next[i] = ahead
        next.sort((a, b) => a - b)
        const nextSet = new Uint8Array(size)
        for (const b of next) nextSet[b] = 1
        const { low } = reach(layout, box, nextSet)
        const key = keyOf(next, low)
        const g = node.g + 1
        const known = bestG.get(key)
        if (known !== undefined && known <= g) continue
        bestG.set(key, g)
        nodes.push({ boxes: next, player: box, parent: id, g, box, dir })
        open.push({ f: g + estimate(next), g, id: nodes.length - 1 })
      }
    }
  }
  if (goalNode < 0) return null

  // Se reconstruyen los empujes y se unen con los caminos más cortos del jugador.
  const chain: Node[] = []
  for (let at = goalNode; at > 0; at = nodes[at]!.parent) chain.push(nodes[at]!)
  chain.reverse()
  let boxes = startBoxes.slice()
  let player = layout.startPlayer
  let keys = ''
  for (const push of chain) {
    const stand = neighbor(layout, push.box, opposite(push.dir as Dir))
    const walk = walkTo(layout, player, stand, boxes)
    if (walk === null) return null
    keys += walk + push.dir
    const moved = neighbor(layout, push.box, push.dir as Dir)
    boxes = boxes.map((b) => (b === push.box ? moved : b))
    player = push.box
  }
  return { keys, pushes: chain.length, moves: keys.length, states: nodes.length }
}
