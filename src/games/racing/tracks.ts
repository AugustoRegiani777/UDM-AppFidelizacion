// Pistas de "Miga Racers" (autitos por el local de Uno de Miga). Cada pista es un circuito cerrado definido
// por puntos de control; se suaviza con una curva Catmull-Rom y se re-muestrea a pasos parejos.
// Cada una transcurre en un lugar real del local y trae sus obstáculos, charcos y peligros.

export type Pt = readonly [number, number]

export type SceneId = 'vitrina' | 'obrador' | 'cafetera' | 'boleria' | 'fiambrera'

export type SolidKind =
  | 'jar'
  | 'tin'
  | 'miga'
  | 'film'
  | 'labels'
  | 'grill'
  | 'cups'
  | 'jug'
  | 'grinder'
  | 'cinnamon'
  | 'croissant'
  | 'cheese'
  | 'ham'

export type ZoneKind = 'dulce' | 'coffee' | 'water' | 'oil'

/** Qué se maneja en cada escenario (solo cambia el dibujo y el sonido de la presentación). */
export type VehicleKind = 'car' | 'boat' | 'bike' | 'copter'

/** Vueltas que puede elegir el jugador antes de largar. */
export const LAP_OPTIONS: readonly number[] = [3, 5, 7]
export const DEFAULT_LAPS = 5

/** Obstáculo fijo al costado de la pista: `off` es qué tan lejos del eje está, en mitades de ancho. */
export interface SolidDef {
  u: number
  side: 1 | -1
  off: number
  r: number
  kind: SolidKind
}

/** Charco que frena: `lane` va de -1 a 1 a lo ancho de la pista. */
export interface ZoneDef {
  u: number
  lane: number
  r: number
  kind: ZoneKind
}

/** Hoja de fiambrera que gira alrededor de un punto al costado de la pista. */
export interface SweeperDef {
  u: number
  side: 1 | -1
  off: number
  orbit: number
  r: number
  /** Pasos (1/60 s) que tarda en dar una vuelta. */
  period: number
}

export interface TrackDef {
  id: string
  /** Puntos de control del eje de la pista (circuito cerrado). */
  points: readonly Pt[]
  /** Ancho total de la pista. */
  width: number
  /** Vehículo propio del escenario. */
  vehicle: VehicleKind
  /** Velocidad máxima de los rivales respecto de la del jugador. */
  aiSpeed: number
  /** Posiciones sobre el eje (0..1) de los parches de turbo. */
  boosts: readonly number[]
  scene: SceneId
  solids: readonly SolidDef[]
  zones: readonly ZoneDef[]
  sweepers: readonly SweeperDef[]
}

export const TRACK_DEFS: readonly TrackDef[] = [
  {
    // 1 · La vitrina de sándwiches: vidrio ancho y fácil, con el pote de dulce de leche y la lata de alfajores.
    id: 'vitrina',
    scene: 'vitrina',
    width: 92,
    vehicle: 'car',
    aiSpeed: 0.86,
    boosts: [0.18, 0.62],
    solids: [
      { u: 0.1, side: 1, off: 0.95, r: 22, kind: 'jar' },
      { u: 0.36, side: -1, off: 0.95, r: 24, kind: 'tin' },
      { u: 0.74, side: 1, off: 0.95, r: 22, kind: 'miga' },
    ],
    zones: [],
    sweepers: [],
    points: [
      [300, 200],
      [600, 200],
      [900, 200],
      [1150, 230],
      [1300, 450],
      [1150, 690],
      [900, 720],
      [600, 720],
      [350, 700],
      [190, 450],
      [200, 280],
    ],
  },
  {
    // 2 · La mesa del obrador: acero, rollos de film y etiquetas, y charcos de agua.
    id: 'obrador',
    scene: 'obrador',
    width: 82,
    vehicle: 'boat',
    aiSpeed: 0.93,
    boosts: [0.1, 0.4, 0.78],
    solids: [
      { u: 0.06, side: -1, off: 0.95, r: 22, kind: 'film' },
      { u: 0.3, side: 1, off: 0.95, r: 20, kind: 'labels' },
      { u: 0.55, side: -1, off: 0.95, r: 26, kind: 'grill' },
      { u: 0.84, side: 1, off: 0.95, r: 22, kind: 'film' },
    ],
    zones: [
      { u: 0.22, lane: 0.2, r: 30, kind: 'water' },
      { u: 0.68, lane: -0.25, r: 30, kind: 'water' },
    ],
    sweepers: [],
    points: [
      [200, 200],
      [500, 200],
      [800, 200],
      [1100, 200],
      [1330, 280],
      [1380, 470],
      [1250, 640],
      [1000, 700],
      [800, 640],
      [600, 700],
      [350, 760],
      [180, 650],
      [130, 450],
      [150, 300],
    ],
  },
  {
    // 3 · La cafetera: la rejilla de la bandeja, vasos apilados, el molino y café derramado.
    id: 'cafetera',
    scene: 'cafetera',
    width: 74,
    vehicle: 'bike',
    aiSpeed: 0.97,
    boosts: [0.08, 0.34, 0.55, 0.86],
    solids: [
      { u: 0.05, side: 1, off: 0.95, r: 20, kind: 'cups' },
      { u: 0.24, side: -1, off: 0.95, r: 18, kind: 'jug' },
      { u: 0.47, side: 1, off: 0.95, r: 24, kind: 'grinder' },
      { u: 0.7, side: -1, off: 0.95, r: 20, kind: 'cups' },
    ],
    zones: [
      { u: 0.16, lane: -0.2, r: 26, kind: 'coffee' },
      { u: 0.62, lane: 0.25, r: 26, kind: 'coffee' },
      { u: 0.92, lane: 0, r: 26, kind: 'coffee' },
    ],
    sweepers: [],
    points: [
      [250, 200],
      [550, 200],
      [850, 200],
      [1150, 200],
      [1350, 280],
      [1400, 480],
      [1300, 660],
      [1050, 720],
      [850, 600],
      [650, 590],
      [480, 700],
      [280, 790],
      [130, 640],
      [110, 430],
      [130, 290],
    ],
  },
  {
    // 4 · La vitrina de bollería: papel madera, cinnamon rolls, medialunas y charcos de dulce de leche.
    id: 'boleria',
    scene: 'boleria',
    width: 76,
    vehicle: 'copter',
    aiSpeed: 0.99,
    boosts: [0.12, 0.45, 0.8],
    solids: [
      { u: 0.08, side: 1, off: 0.95, r: 26, kind: 'cinnamon' },
      { u: 0.28, side: -1, off: 0.95, r: 24, kind: 'croissant' },
      { u: 0.52, side: 1, off: 0.95, r: 26, kind: 'cinnamon' },
      { u: 0.76, side: -1, off: 0.95, r: 24, kind: 'croissant' },
    ],
    zones: [
      { u: 0.2, lane: 0.15, r: 28, kind: 'dulce' },
      { u: 0.4, lane: -0.25, r: 28, kind: 'dulce' },
      { u: 0.64, lane: 0.2, r: 28, kind: 'dulce' },
      { u: 0.9, lane: -0.1, r: 28, kind: 'dulce' },
    ],
    sweepers: [],
    points: [
      [220, 220],
      [520, 170],
      [820, 170],
      [1120, 170],
      [1360, 260],
      [1420, 450],
      [1380, 650],
      [1150, 800],
      [900, 900],
      [600, 900],
      [330, 900],
      [150, 740],
      [120, 520],
      [140, 340],
    ],
  },
  {
    // 5 · La fiambrera: arriba de la heladera crema, con la hoja de la máquina Febal girando.
    id: 'fiambrera',
    scene: 'fiambrera',
    width: 70,
    vehicle: 'car',
    aiSpeed: 1.0,
    boosts: [0.1, 0.36, 0.6, 0.88],
    solids: [
      { u: 0.05, side: -1, off: 0.95, r: 24, kind: 'cheese' },
      { u: 0.3, side: 1, off: 0.95, r: 22, kind: 'ham' },
      { u: 0.72, side: -1, off: 0.95, r: 24, kind: 'cheese' },
    ],
    zones: [
      { u: 0.2, lane: 0.1, r: 24, kind: 'oil' },
      { u: 0.8, lane: -0.15, r: 24, kind: 'oil' },
    ],
    sweepers: [{ u: 0.52, side: 1, off: 0.95, orbit: 18, r: 14, period: 150 }],
    points: [
      [200, 200],
      [500, 200],
      [800, 200],
      [1100, 200],
      [1340, 250],
      [1450, 430],
      [1330, 600],
      [1080, 620],
      [860, 730],
      [950, 880],
      [700, 940],
      [450, 940],
      [250, 840],
      [160, 640],
      [160, 400],
    ],
  },
]

export const TRACK_COUNT = TRACK_DEFS.length
/** Distancia entre muestras del eje. */
export const SPACING = 10
const X_STRETCH = 1.35

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
  /** Obstáculos fijos (en coordenadas del mundo). */
  solids: { x: number; y: number; r: number; kind: SolidKind }[]
  zones: { x: number; y: number; r: number; kind: ZoneKind }[]
  sweepers: { cx: number; cy: number; orbit: number; r: number; period: number; phase: number }[]
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
  // Las pistas se estiran a lo ancho para ganar rectas largas sin cerrar las curvas.
  const pts: Pt[] = def.points.map(([x, y]) => [x * X_STRETCH, y])
  const n = pts.length
  const dense: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n]!
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!
    const p3 = pts[(i + 2) % n]!
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
  // Los obstáculos se ubican a partir del eje: así siempre dejan libre un corredor del lado opuesto.
  const at = (u: number) => Math.floor(u * count) % count
  const beside = (u: number, side: number, off: number) => {
    const i = at(u)
    return {
      x: xs[i]! + -ty[i]! * side * (def.width / 2) * off,
      y: ys[i]! + tx[i]! * side * (def.width / 2) * off,
    }
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
    solids: def.solids.map((d) => ({ ...beside(d.u, d.side, d.off), r: d.r, kind: d.kind })),
    zones: def.zones.map((d) => {
      const i = at(d.u)
      return {
        x: xs[i]! + -ty[i]! * d.lane * (def.width / 2),
        y: ys[i]! + tx[i]! * d.lane * (def.width / 2),
        r: d.r,
        kind: d.kind,
      }
    }),
    sweepers: def.sweepers.map((d, k) => ({
      cx: beside(d.u, d.side, d.off).x,
      cy: beside(d.u, d.side, d.off).y,
      orbit: d.orbit,
      r: d.r,
      period: d.period,
      phase: k * 1.7,
    })),
  }
  cache.set(def.id, track)
  return track
}

export function trackAt(index: number): Track {
  return buildTrack(TRACK_DEFS[Math.min(TRACK_COUNT, Math.max(1, index)) - 1]!)
}
