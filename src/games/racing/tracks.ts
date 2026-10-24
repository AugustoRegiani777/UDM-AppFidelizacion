// Pistas de "Miga Racers" (autitos sobre la mesa). Cada pista es un circuito cerrado definido por
// puntos de control; se suaviza con una curva Catmull-Rom y se re-muestrea a pasos parejos.

export type Pt = readonly [number, number]

export interface TrackDef {
  id: string
  /** Puntos de control del eje de la pista (circuito cerrado). */
  points: readonly Pt[]
  /** Ancho total de la pista. */
  width: number
  laps: number
  /** Velocidad máxima de los rivales respecto de la del jugador. */
  aiSpeed: number
  /** Posiciones sobre el eje (0..1) de los parches de turbo. */
  boosts: readonly number[]
}

export const TRACK_DEFS: readonly TrackDef[] = [
  {
    id: 'cocina',
    width: 92,
    laps: 3,
    aiSpeed: 0.86,
    boosts: [0.18, 0.62],
    points: [
      [300, 200],
      [700, 150],
      [1100, 220],
      [1250, 450],
      [1100, 700],
      [750, 780],
      [450, 720],
      [250, 560],
      [180, 350],
    ],
  },
  {
    id: 'mostrador',
    width: 82,
    laps: 3,
    aiSpeed: 0.93,
    boosts: [0.1, 0.4, 0.78],
    points: [
      [200, 200],
      [600, 140],
      [900, 260],
      [1200, 160],
      [1350, 420],
      [1100, 560],
      [900, 450],
      [650, 600],
      [850, 800],
      [500, 880],
      [200, 760],
      [120, 480],
    ],
  },
  {
    id: 'noche',
    width: 74,
    laps: 3,
    aiSpeed: 0.99,
    boosts: [0.08, 0.34, 0.55, 0.86],
    points: [
      [200, 300],
      [450, 120],
      [750, 200],
      [700, 400],
      [1000, 330],
      [1300, 200],
      [1400, 500],
      [1150, 700],
      [900, 600],
      [800, 850],
      [500, 780],
      [550, 580],
      [300, 650],
      [120, 500],
    ],
  },
]

export const TRACK_COUNT = TRACK_DEFS.length
/** Distancia entre muestras del eje. */
export const SPACING = 10

export interface Track {
  def: TrackDef
  /** Muestras del eje: x, y alternados. */
  xs: Float32Array
  ys: Float32Array
  /** Tangente unitaria en cada muestra. */
  tx: Float32Array
  ty: Float32Array
  count: number
  length: number
  half: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  boostIdx: number[]
}

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): [number, number] {
  const t2 = t * t
  const t3 = t2 * t
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]
}

const cache = new Map<string, Track>()

export function buildTrack(def: TrackDef): Track {
  const cached = cache.get(def.id)
  if (cached) return cached
  const n = def.points.length
  const dense: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const p0 = def.points[(i + n - 1) % n]!
    const p1 = def.points[i]!
    const p2 = def.points[(i + 1) % n]!
    const p3 = def.points[(i + 2) % n]!
    for (let k = 0; k < 24; k++) dense.push(catmull(p0, p1, p2, p3, k / 24))
  }
  // Re-muestreo a pasos parejos a lo largo de la curva.
  const out: [number, number][] = [dense[0]!]
  let carry = 0
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i]!
    const b = dense[(i + 1) % dense.length]!
    const segment = Math.hypot(b[0] - a[0], b[1] - a[1])
    let at = SPACING - carry
    while (at <= segment) {
      const u = at / segment
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
      at += SPACING
    }
    carry = segment - (at - SPACING)
  }
  // Si el último punto quedó muy pegado al primero, se descarta para cerrar parejo.
  const last = out[out.length - 1]!
  if (Math.hypot(last[0] - out[0]![0], last[1] - out[0]![1]) < SPACING * 0.5) out.pop()

  const count = out.length
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  const tx = new Float32Array(count)
  const ty = new Float32Array(count)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < count; i++) {
    xs[i] = out[i]![0]
    ys[i] = out[i]![1]
    minX = Math.min(minX, xs[i]!)
    maxX = Math.max(maxX, xs[i]!)
    minY = Math.min(minY, ys[i]!)
    maxY = Math.max(maxY, ys[i]!)
  }
  for (let i = 0; i < count; i++) {
    const a = (i + count - 1) % count
    const b = (i + 1) % count
    const dx = xs[b]! - xs[a]!
    const dy = ys[b]! - ys[a]!
    const d = Math.hypot(dx, dy) || 1
    tx[i] = dx / d
    ty[i] = dy / d
  }
  const track: Track = {
    def,
    xs,
    ys,
    tx,
    ty,
    count,
    length: count * SPACING,
    half: def.width / 2,
    bounds: { minX, minY, maxX, maxY },
    boostIdx: def.boosts.map((u) => Math.floor(u * count) % count),
  }
  cache.set(def.id, track)
  return track
}

export function trackAt(index: number): Track {
  return buildTrack(TRACK_DEFS[Math.min(TRACK_COUNT, Math.max(1, index)) - 1]!)
}
