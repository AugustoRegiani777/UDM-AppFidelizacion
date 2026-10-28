// Generador de niveles (solo para armar `levels.data.ts`; no se usa dentro del juego).
// Se parte de un mapa YA resuelto (cajas sobre las entregas) y se juega "al revés" tirando de las cajas.
// Como cada paso al revés es un empuje válido al derecho, todo nivel generado tiene solución.

import { DELTA, DIR_LIST, OPPOSITE, type Dir } from '../engine.ts'

export function rngFrom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Spec {
  w: number
  h: number
  boxes: number
  /** Cuántos bloques de pared sueltos meter adentro. */
  blocks: number
  /** Rondas de juego al revés (cada una tira de una caja unos pasos). */
  steps: number
}

export interface Candidate {
  rows: string[]
}

export function generate(spec: Spec, rng: () => number): Candidate | null {
  const { w, h } = spec
  const wall: boolean[] = Array(w * h).fill(false)
  for (let x = 0; x < w; x++) wall[x] = wall[(h - 1) * w + x] = true
  for (let y = 0; y < h; y++) wall[y * w] = wall[y * w + w - 1] = true

  // Obstáculos sueltos (a veces de a dos casillas) sin partir el piso en pedazos.
  for (let k = 0; k < spec.blocks; k++) {
    const x = 1 + Math.floor(rng() * (w - 2))
    const y = 1 + Math.floor(rng() * (h - 2))
    const cells = [y * w + x]
    if (rng() < 0.45) {
      const [dx, dy] = DELTA[DIR_LIST[Math.floor(rng() * 4)]!]
      const nx = x + dx
      const ny = y + dy
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1) cells.push(ny * w + nx)
    }
    for (const c of cells) wall[c] = true
  }
  const floor = wall.map((isWall, i) => (isWall ? -1 : i)).filter((i) => i >= 0)
  if (floor.length < spec.boxes * 3 + 4) return null
  // El piso tiene que ser una sola zona.
  const seen = new Set<number>([floor[0]!])
  const stack = [floor[0]!]
  while (stack.length) {
    const c = stack.pop()!
    for (const dir of DIR_LIST) {
      const [dx, dy] = DELTA[dir]
      const n = c + dy * w + dx
      if (!wall[n] && !seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  if (seen.size !== floor.length) return null

  // Las entregas van juntas (a pocas casillas de la primera): así las cajas se estorban entre sí.
  const pool = floor.slice()
  const goals: number[] = [pool.splice(Math.floor(rng() * pool.length), 1)[0]!]
  while (goals.length < spec.boxes) {
    const first = goals[0]!
    const near = pool.filter((c) => {
      const dx = Math.abs((c % w) - (first % w))
      const dy = Math.abs(Math.floor(c / w) - Math.floor(first / w))
      return dx + dy <= 3
    })
    const source = near.length ? near : pool
    const pick = source[Math.floor(rng() * source.length)]!
    goals.push(pick)
    pool.splice(pool.indexOf(pick), 1)
  }
  const boxes = goals.slice()
  let player = pool[Math.floor(rng() * pool.length)]!

  const boxAt = (c: number) => boxes.indexOf(c)
  const free = (c: number) => !wall[c] && boxAt(c) < 0

  /** Lleva al jugador hasta `target` esquivando paredes y cajas. */
  const walk = (target: number): boolean => {
    if (player === target) return true
    const prev = new Set<number>([player])
    const queue = [player]
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!
      for (const dir of DIR_LIST) {
        const [dx, dy] = DELTA[dir]
        const n = c + dy * w + dx
        if (prev.has(n) || !free(n)) continue
        prev.add(n)
        if (n === target) {
          player = target
          return true
        }
        queue.push(n)
      }
    }
    return false
  }

  // Juego al revés: se elige una caja y una dirección, el jugador va al lado de la caja y tira de ella
  // varios pasos seguidos. Así las cajas se alejan de las entregas y se van trabando contra las paredes.
  let pulls = 0
  const lastDir: (Dir | null)[] = boxes.map(() => null)
  for (let round = 0; round < spec.steps; round++) {
    const index = round < boxes.length ? round : Math.floor(rng() * boxes.length)
    const box = boxes[index]!
    // Se prefiere girar: seguir o volver en la misma dirección que antes deshace el trabajo.
    const last = lastDir[index]
    const options = DIR_LIST.filter((d) => !last || (d !== last && d !== OPPOSITE[last]))
    const m = options[Math.floor(rng() * options.length)]!
    const [dx, dy] = DELTA[m]
    const delta = dy * w + dx
    const stand = box + delta // el jugador se para adelante de la caja y tira hacia atrás de él
    if (!free(stand) || !walk(stand)) continue
    lastDir[index] = m
    const length = 2 + Math.floor(rng() * 5)
    for (let k = 0; k < length; k++) {
      const to = player + delta
      if (!free(to)) break
      boxes[index] = player
      player = to
      pulls++
    }
  }
  // Nivel aburrido: cajas que ya están en su lugar, o casi sin jugadas.
  if (pulls < spec.boxes * 2 || boxes.some((b) => goals.includes(b))) return null

  const rows: string[] = []
  for (let y = 0; y < h; y++) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const c = y * w + x
      const isGoal = goals.includes(c)
      if (wall[c]) row += '#'
      else if (c === player) row += isGoal ? '+' : '@'
      else if (boxAt(c) >= 0) row += isGoal ? '*' : '$'
      else row += isGoal ? '.' : ' '
    }
    rows.push(row)
  }
  return { rows }
}
