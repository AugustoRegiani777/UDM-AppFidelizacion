// Rally de Cocina: geometría de la pista (puntos, tangentes, normales), rampas y cajas sorpresa.
// Es matemática pura: se calcula una sola vez al cargar el módulo y no toca el DOM.
import { CatmullRomCurve3, Vector3 } from 'three'
import { HW, N, clamp } from './data.ts'

export interface Pt {
  x: number
  z: number
}

const CTRL: [number, number][] = [
  [-50, 55],
  [10, 57],
  [55, 52],
  [78, 35],
  [80, 5],
  [68, -18],
  [45, -25],
  [25, -15],
  [0, -9],
  [-25, -15],
  [-45, -30],
  [-55, -52],
  [-75, -56],
  [-88, -35],
  [-84, -5],
  [-74, 22],
  [-65, 45],
]

const curve = new CatmullRomCurve3(
  CTRL.map(([x, z]) => new Vector3(x, 0, z)),
  true,
  'centripetal',
)
const rawPts: Pt[] = curve
  .getSpacedPoints(N)
  .slice(0, N)
  .map((p) => ({ x: p.x, z: p.z }))
let s0 = 0
{
  let bd = 1e9
  rawPts.forEach((p, i) => {
    const d = (p.x + 12) ** 2 + (p.z - 56) ** 2
    if (d < bd) {
      bd = d
      s0 = i
    }
  })
}
/** Puntos del eje de la pista, empezando en la meta. */
export const TP: Pt[] = rawPts.slice(s0).concat(rawPts.slice(0, s0))
export const TAN: Pt[] = []
/** Normal hacia la izquierda del sentido de marcha. */
export const NRM: Pt[] = []
export const DIST: number[] = []
let len = 0
for (let i = 0; i < N; i++) {
  const a = TP[(i - 1 + N) % N]!
  const b = TP[(i + 1) % N]!
  let tx = b.x - a.x
  let tz = b.z - a.z
  const l = Math.hypot(tx, tz) || 1
  tx /= l
  tz /= l
  TAN.push({ x: tx, z: tz })
  NRM.push({ x: tz, z: -tx })
}
for (let i = 0; i < N; i++) {
  DIST.push(len)
  const b = TP[(i + 1) % N]!
  len += Math.hypot(b.x - TP[i]!.x, b.z - TP[i]!.z)
}
export const LEN = len

/** Números de sanidad de la pista: largo, separación mínima entre tramos lejanos y radio mínimo de curva. */
export const trackCheck = (() => {
  let minSep = 1e9
  for (let i = 0; i < N; i += 2)
    for (let j = i + 2; j < N; j += 2) {
      const dd = Math.abs(DIST[j]! - DIST[i]!)
      const arc = Math.min(dd, LEN - dd)
      if (arc < 35) continue
      const d = Math.hypot(TP[i]!.x - TP[j]!.x, TP[i]!.z - TP[j]!.z)
      if (d < minSep) minSep = d
    }
  let minR = 1e9
  for (let i = 0; i < N; i++) {
    const a = TAN[(i - 4 + N) % N]!
    const b = TAN[(i + 4) % N]!
    const ang = Math.acos(clamp(a.x * b.x + a.z * b.z, -1, 1))
    const arc = (8 * LEN) / N
    if (ang > 1e-4) minR = Math.min(minR, arc / ang)
  }
  return { length: LEN, minSep, minRadius: minR }
})()

export function nearestGlobal(x: number, z: number) {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < N; i++) {
    const d = (TP[i]!.x - x) ** 2 + (TP[i]!.z - z) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}
export function nearestIdx(x: number, z: number, start: number) {
  let best = start
  let bd = Infinity
  for (let k = -14; k <= 26; k++) {
    const i = (start + k + N) % N
    const p = TP[i]!
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  if (bd > (HW + 4) ** 2) return nearestGlobal(x, z)
  return best
}
export function distToTrack(x: number, z: number) {
  const i = nearestGlobal(x, z)
  return Math.hypot(TP[i]!.x - x, TP[i]!.z - z) - HW
}
/** Revisa que un objeto de decoración no pise la pista: devuelve un aviso o null. */
export function chk(name: string, x: number, z: number, r: number): string | null {
  const d = distToTrack(x, z) - r - 0.7
  return d < 0.6 ? name + ' ' + d.toFixed(1) : null
}
export function idxBack(dist: number) {
  for (let i = N - 1; i > 0; i--) {
    if (LEN - DIST[i]! >= dist) return i
  }
  return N - 1
}

/* ============ rampas (libros) ============ */
export interface Ramp {
  x: number
  z: number
  ux: number
  uz: number
  vx: number
  vz: number
  len: number
  w: number
  h: number
  idx: number
  color: number
}
const RAMP_SPECS: [number, number, number, number][] = [
  [30, 55, -1.6, 0xb8324a],
  [-85, -12, 1.4, 0x2f7d5b],
]
export const ramps: Ramp[] = RAMP_SPECS.map(([px, pz, off, color]) => {
  const i = nearestGlobal(px, pz)
  const p = TP[i]!
  const t = TAN[i]!
  const n = NRM[i]!
  return {
    x: p.x + n.x * off,
    z: p.z + n.z * off,
    ux: t.x,
    uz: t.z,
    vx: n.x,
    vz: n.z,
    len: 9,
    w: 4.4,
    h: 1.9,
    idx: i,
    color,
  }
})

export function groundAt(x: number, z: number) {
  let h = 0
  for (const r of ramps) {
    const dx = x - r.x
    const dz = z - r.z
    const u = dx * r.ux + dz * r.uz
    const v = dx * r.vx + dz * r.vz
    if (Math.abs(v) <= r.w / 2 && u >= -r.len / 2 && u <= r.len / 2) {
      const hh = (r.h * (u + r.len / 2)) / r.len
      if (hh > h) h = hh
    }
  }
  return h
}

/** Posiciones de las cajas sorpresa: cuatro filas de tres, esquivando las rampas. */
export const pickupSpots: Pt[] = (() => {
  const out: Pt[] = []
  for (const f of [0.2, 0.43, 0.64, 0.86]) {
    let i = Math.round(f * N) % N
    for (const r of ramps) {
      const d = Math.abs(i - r.idx)
      if (Math.min(d, N - d) < 30) i = (i + 40) % N
    }
    for (const off of [-3.2, 0, 3.2]) {
      const p = TP[i]!
      const n = NRM[i]!
      out.push({ x: p.x + n.x * off, z: p.z + n.z * off })
    }
  }
  return out
})()
