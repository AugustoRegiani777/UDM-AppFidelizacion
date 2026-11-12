// Rally de Cocina: de una `TrackDef` (datos) a lo que usan la física, la IA, el minimapa y el mundo 3D
// (puntos del eje, tangentes, normales, alturas, pendientes, rampas, cajas y zonas).
// Es matemática pura: no toca el DOM ni el WebGL, así que se puede correr en tests y en el editor.
import { CatmullRomCurve3, Vector3 } from 'three'
import { clamp } from '../data.ts'
import type { TrackDef, ZoneKind } from './types.ts'

export interface Pt {
  x: number
  z: number
}

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

export interface PickupSpot extends Pt {
  /** Altura del asfalto en ese punto. */
  y: number
  idx: number
}

export interface Zone {
  kind: ZoneKind
  /** Primer punto del eje que cubre y cuántos puntos seguidos. */
  i0: number
  count: number
  /** Rango lateral cubierto (lat0 < lat1). */
  lat0: number
  lat1: number
}

export interface GridSlot {
  x: number
  z: number
  y: number
  heading: number
  idx: number
  lat: number
}

/** Separación aproximada entre puntos del eje, en metros. */
export const SAMPLE_SPACING = 0.7

export interface TrackRuntime {
  readonly def: TrackDef
  readonly id: string
  readonly name: string
  /** Cantidad de puntos del eje. */
  readonly n: number
  /** Mitad del ancho del asfalto. */
  readonly hw: number
  readonly len: number
  /** Eje empezando en la meta. */
  readonly TP: Pt[]
  readonly TAN: Pt[]
  /** Normal hacia la izquierda del sentido de marcha. */
  readonly NRM: Pt[]
  /** Distancia recorrida hasta cada punto (horizontal). */
  readonly DIST: number[]
  /** Altura del asfalto en cada punto. */
  readonly Y: number[]
  /** Pendiente en cada punto: positiva = sube en el sentido de marcha. */
  readonly SLOPE: number[]
  /** `true` si todo el eje está a ras del piso (el cálculo de altura se saltea). */
  readonly flat: boolean
  readonly maxY: number
  readonly ramps: Ramp[]
  readonly pickupSpots: PickupSpot[]
  readonly zones: Zone[]
  nearestGlobal(x: number, z: number): number
  nearestIdx(x: number, z: number, start: number): number
  /** Distancia del punto al borde del asfalto (negativa = adentro). */
  distToTrack(x: number, z: number): number
  /** Avisa si un objeto de decorado de radio `r` pisa la pista; devuelve un aviso o null. */
  chk(name: string, x: number, z: number, r: number): string | null
  idxBack(dist: number): number
  /** Índice del eje para una fracción `s` (0..1) de la vuelta. */
  idxAt(s: number): number
  /** Altura del asfalto (sin rampas). `hint` = índice cercano, evita buscar en toda la pista. */
  baseAt(x: number, z: number, hint?: number): number
  /** Altura del suelo transitable: asfalto más rampas. */
  groundAt(x: number, z: number, hint?: number): number
  /** Qué zona especial hay en un punto del eje y a esa distancia lateral. */
  zoneAt(idx: number, lat: number): ZoneKind | null
  /** Posición `k` de la parrilla (0 = primera fila, columna izquierda). */
  gridSlot(k: number): GridSlot
  /** Posición lateral de un punto respecto del eje en `idx`. */
  latOf(x: number, z: number, idx: number): number
}

/** Cuántos puntos del eje usar para la curva (para que valga ~0,7 m entre puntos). */
export function sampleCountFor(def: TrackDef): number {
  if (def.samples && def.samples >= 100) return Math.round(def.samples)
  const curve = curveOf(def)
  return Math.max(200, Math.round(curve.getLength() / SAMPLE_SPACING))
}

function curveOf(def: TrackDef) {
  return new CatmullRomCurve3(
    def.controlPoints.map((p) => new Vector3(p.x, p.y, p.z)),
    true,
    'centripetal',
  )
}

/** Arma todo lo que se calcula de una pista. Tira un error si tiene menos de 4 puntos de control. */
export function buildRuntime(def: TrackDef): TrackRuntime {
  if (def.controlPoints.length < 4) throw new Error(`Pista ${def.id}: faltan puntos de control`)
  const curve = curveOf(def)
  const n = sampleCountFor(def)
  const raw = curve.getSpacedPoints(n).slice(0, n)
  // La meta: el punto del eje más cercano a `start`.
  let s0 = 0
  {
    let bd = Infinity
    raw.forEach((p, i) => {
      const d = (p.x - def.start.x) ** 2 + (p.z - def.start.z) ** 2
      if (d < bd) {
        bd = d
        s0 = i
      }
    })
  }
  const pts = raw.slice(s0).concat(raw.slice(0, s0))
  const TP: Pt[] = pts.map((p) => ({ x: p.x, z: p.z }))
  const Y: number[] = pts.map((p) => p.y)
  const TAN: Pt[] = []
  const NRM: Pt[] = []
  const DIST: number[] = []
  const SEG: number[] = []
  let len = 0
  for (let i = 0; i < n; i++) {
    const a = TP[(i - 1 + n) % n]!
    const b = TP[(i + 1) % n]!
    let tx = b.x - a.x
    let tz = b.z - a.z
    const l = Math.hypot(tx, tz) || 1
    tx /= l
    tz /= l
    TAN.push({ x: tx, z: tz })
    NRM.push({ x: tz, z: -tx })
  }
  for (let i = 0; i < n; i++) {
    DIST.push(len)
    const b = TP[(i + 1) % n]!
    const seg = Math.hypot(b.x - TP[i]!.x, b.z - TP[i]!.z)
    SEG.push(seg || 1e-6)
    len += seg
  }
  const SLOPE: number[] = []
  let maxY = 0
  let flat = true
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n
    const b = (i + 1) % n
    SLOPE.push((Y[b]! - Y[a]!) / (SEG[a]! + SEG[i]!))
    if (Math.abs(Y[i]!) > 1e-6) flat = false
    if (Y[i]! > maxY) maxY = Y[i]!
  }
  const hw = def.halfWidth

  const nearestGlobal = (x: number, z: number) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < n; i++) {
      const d = (TP[i]!.x - x) ** 2 + (TP[i]!.z - z) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }
  const nearestIdx = (x: number, z: number, start: number) => {
    let best = start
    let bd = Infinity
    for (let k = -14; k <= 26; k++) {
      const i = (start + k + n) % n
      const p = TP[i]!
      const d = (p.x - x) ** 2 + (p.z - z) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (bd > (hw + 4) ** 2) return nearestGlobal(x, z)
    return best
  }
  const distToTrack = (x: number, z: number) => {
    const i = nearestGlobal(x, z)
    return Math.hypot(TP[i]!.x - x, TP[i]!.z - z) - hw
  }
  const chk = (name: string, x: number, z: number, r: number) => {
    const d = distToTrack(x, z) - r - 0.7
    return d < 0.6 ? name + ' ' + d.toFixed(1) : null
  }
  const idxBack = (dist: number) => {
    for (let i = n - 1; i > 0; i--) if (len - DIST[i]! >= dist) return i
    return n - 1
  }
  const idxAt = (s: number) => (((Math.round(s * n) % n) + n) % n) as number

  const baseAt = (x: number, z: number, hint?: number) => {
    if (flat) return 0
    const i = hint === undefined ? nearestGlobal(x, z) : nearestIdx(x, z, hint)
    const t = TAN[i]!
    const p = TP[i]!
    const along = (x - p.x) * t.x + (z - p.z) * t.z
    if (along >= 0) {
      const j = (i + 1) % n
      return Y[i]! + (Y[j]! - Y[i]!) * clamp(along / SEG[i]!, 0, 1)
    }
    const j = (i - 1 + n) % n
    return Y[i]! + (Y[j]! - Y[i]!) * clamp(-along / SEG[j]!, 0, 1)
  }

  const ramps: Ramp[] = def.ramps.map((r) => {
    const i = idxAt(r.s)
    const p = TP[i]!
    const t = TAN[i]!
    const nr = NRM[i]!
    return {
      x: p.x + nr.x * r.lat,
      z: p.z + nr.z * r.lat,
      ux: t.x,
      uz: t.z,
      vx: nr.x,
      vz: nr.z,
      len: r.length,
      w: r.width,
      h: r.height,
      idx: i,
      color: r.color,
    }
  })

  const groundAt = (x: number, z: number, hint?: number) => {
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
    return h + baseAt(x, z, hint)
  }

  const spacing = len / n
  const pickupSpots: PickupSpot[] = def.pickups.map((pk) => {
    const i = idxAt(pk.s)
    const p = TP[i]!
    const nr = NRM[i]!
    return { x: p.x + nr.x * pk.lat, z: p.z + nr.z * pk.lat, y: Y[i]!, idx: i }
  })

  const zones: Zone[] = def.zones.map((zn) => {
    const half = Math.max(1, Math.round(zn.length / 2 / spacing))
    return {
      kind: zn.kind,
      i0: (idxAt(zn.s) - half + n) % n,
      count: half * 2 + 1,
      lat0: zn.lat - zn.width / 2,
      lat1: zn.lat + zn.width / 2,
    }
  })
  const zoneAt = (idx: number, lat: number): ZoneKind | null => {
    for (const zn of zones) {
      const d = (idx - zn.i0 + n) % n
      if (d < zn.count && lat >= zn.lat0 && lat <= zn.lat1) return zn.kind
    }
    return null
  }

  const gridSlot = (k: number): GridSlot => {
    const row = Math.floor(k / 2)
    const col = k % 2
    const i = idxBack(def.grid.firstRow + row * def.grid.rowGap)
    const p = TP[i]!
    const nr = NRM[i]!
    const t = TAN[i]!
    const lat = (col ? -1 : 1) * def.grid.lateral
    return {
      x: p.x + nr.x * lat,
      z: p.z + nr.z * lat,
      y: Y[i]!,
      heading: Math.atan2(t.x, t.z),
      idx: i,
      lat,
    }
  }
  const latOf = (x: number, z: number, idx: number) => {
    const p = TP[idx]!
    const nr = NRM[idx]!
    return (x - p.x) * nr.x + (z - p.z) * nr.z
  }

  return {
    def,
    id: def.id,
    name: def.name,
    n,
    hw,
    len,
    TP,
    TAN,
    NRM,
    DIST,
    Y,
    SLOPE,
    flat,
    maxY,
    ramps,
    pickupSpots,
    zones,
    nearestGlobal,
    nearestIdx,
    distToTrack,
    chk,
    idxBack,
    idxAt,
    baseAt,
    groundAt,
    zoneAt,
    gridSlot,
    latOf,
  }
}
