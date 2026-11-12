// El mundo de "Miga Skate": rampas, cajones, escaleras, cuartos de pipa y rieles. TypeScript puro.
// Es un mapa de alturas por obstaculo (cada superficie tiene su propio perfil), pero las consultas que
// usa la fisica son raycasts verticales y normales analiticas, asi la suspension de la tabla ve la
// geometria como si fuera mallas: `raycastDown` devuelve el primer techo por debajo del origen del rayo
// (un cajon sobre el piso, una cornisa encima de una rampa) y su normal exacta.

import { clamp, type V3 } from './vec.ts'

export type Dir = 'px' | 'nx' | 'pz' | 'nz'

export interface Surface {
  type: 'box' | 'ramp' | 'quarter' | 'stairs'
  /** Centro y tamano (w a lo largo de x, d a lo largo de z). */
  x: number
  z: number
  w: number
  d: number
  height: number
  /** Hacia donde sube (rampas, cuartos y escaleras). */
  dir: Dir
  steps?: number
}

export interface Rail {
  ax: number
  az: number
  ay: number
  bx: number
  bz: number
  by: number
  /** Cornisa: se dibuja como un bloque y no como un cano. */
  ledge?: boolean
}

export interface WorldDef {
  halfX: number
  halfZ: number
  surfaces: Surface[]
  rails: Rail[]
  start: { x: number; z: number; heading: number }
}

// --- Perfiles ---------------------------------------------------------------------------------------

const QUARTER_ALPHA = (65 * Math.PI) / 180

export const quarterRadius = (height: number) => height / (1 - Math.cos(QUARTER_ALPHA))
/** Largo horizontal de la curva de un cuarto de pipa de esa altura. */
export const quarterRun = (height: number) => quarterRadius(height) * Math.sin(QUARTER_ALPHA)

export function surfaceLength(s: Surface): number {
  return s.dir === 'px' || s.dir === 'nx' ? s.w : s.d
}

/** Altura de la superficie a una distancia `along` desde su borde bajo. */
export function profileHeight(s: Surface, along: number): number {
  const len = surfaceLength(s)
  const a = Math.max(0, Math.min(len, along))
  switch (s.type) {
    case 'box':
      return s.height
    case 'ramp':
      return (s.height * a) / len
    case 'quarter': {
      const run = quarterRun(s.height)
      if (a >= run) return s.height
      const r = quarterRadius(s.height)
      return r * (1 - Math.cos(Math.asin(a / r)))
    }
    case 'stairs': {
      const n = s.steps ?? 6
      const k = Math.min(n, Math.floor((a / len) * n) + 1)
      return (s.height * k) / n
    }
  }
}

/** Pendiente dh/dalong (los escalones y cajones son planos arriba: sus paredes las maneja `wallPush`). */
export function profileSlope(s: Surface, along: number): number {
  const len = surfaceLength(s)
  const a = Math.max(0, Math.min(len, along))
  switch (s.type) {
    case 'ramp':
      return s.height / len
    case 'quarter': {
      const run = quarterRun(s.height)
      if (a >= run) return 0
      const r = quarterRadius(s.height)
      const k = Math.min(0.999, a / r)
      return k / Math.sqrt(1 - k * k)
    }
    default:
      return 0
  }
}

function along(s: Surface, x: number, z: number): number | null {
  const hx = s.w / 2
  const hz = s.d / 2
  if (Math.abs(x - s.x) > hx || Math.abs(z - s.z) > hz) return null
  switch (s.dir) {
    case 'px':
      return x - (s.x - hx)
    case 'nx':
      return s.x + hx - x
    case 'pz':
      return z - (s.z - hz)
    case 'nz':
      return s.z + hz - z
  }
}

const DIRS: Record<Dir, { x: number; z: number }> = {
  px: { x: 1, z: 0 },
  nx: { x: -1, z: 0 },
  pz: { x: 0, z: 1 },
  nz: { x: 0, z: -1 },
}

/** Altura maxima de todas las superficies bajo el punto (el techo del mundo). */
export function heightAt(world: WorldDef, x: number, z: number): number {
  let h = 0
  for (const s of world.surfaces) {
    const a = along(s, x, z)
    if (a === null) continue
    const v = profileHeight(s, a)
    if (v > h) h = v
  }
  return h
}

// --- Raycast vertical ------------------------------------------------------------------------------

export interface GroundHit {
  /** Altura del punto de impacto. */
  y: number
  nx: number
  ny: number
  nz: number
  /** Indice de la superficie (-1 = el piso). */
  surface: number
}

/**
 * Lanza un rayo hacia abajo desde (x, y, z) y devuelve el primer techo que toca dentro de `maxDist`:
 * el mas alto de los que quedan por debajo del origen. Los techos por encima del origen se ignoran,
 * por eso una tabla que viene de costado a baja altura no "salta" sobre un cajon (choca con su pared).
 */
export function raycastDown(
  world: WorldDef,
  x: number,
  y: number,
  z: number,
  maxDist: number,
): GroundHit | null {
  let best: GroundHit | null = y >= 0 ? { y: 0, nx: 0, ny: 1, nz: 0, surface: -1 } : null
  for (let i = 0; i < world.surfaces.length; i++) {
    const s = world.surfaces[i]!
    const a = along(s, x, z)
    if (a === null) continue
    const h = profileHeight(s, a)
    if (h > y || (best && h <= best.y)) continue
    const slope = profileSlope(s, a)
    const d = DIRS[s.dir]
    const inv = 1 / Math.sqrt(1 + slope * slope)
    best = { y: h, nx: -slope * d.x * inv, ny: inv, nz: -slope * d.z * inv, surface: i }
  }
  if (!best || y - best.y > maxDist) return null
  return best
}

/** Normal del suelo bajo un punto (arriba si no hay nada). */
export function groundNormal(world: WorldDef, x: number, z: number): V3 {
  const hit = raycastDown(world, x, heightAt(world, x, z) + 0.01, z, 0.5)
  return hit ? { x: hit.nx, y: hit.ny, z: hit.nz } : { x: 0, y: 1, z: 0 }
}

// --- Paredes -----------------------------------------------------------------------------------------

/**
 * Si un punto de la tabla (a la altura de la rueda, `bottom` = parte baja) quedo metido dentro de un
 * obstaculo, devuelve la normal horizontal hacia afuera y cuanto hay que sacarlo. Se usa en cada
 * subpaso (el desplazamiento por subpaso es menor que el ancho de la tabla: no hay tunneling).
 */
export function wallPush(
  world: WorldDef,
  x: number,
  z: number,
  bottom: number,
  tolerance: number,
  fallback: { x: number; z: number },
): { nx: number; nz: number; depth: number } | null {
  const top = heightAt(world, x, z)
  // El piso no es una pared: solo cuentan los obstaculos.
  if (top < 0.02 || top <= bottom + tolerance) return null
  const e = 0.12
  let gx = -(heightAt(world, x + e, z) - heightAt(world, x - e, z))
  let gz = -(heightAt(world, x, z + e) - heightAt(world, x, z - e))
  let len = Math.hypot(gx, gz)
  if (len < 1e-6) {
    // Dentro de un bloque (entro de golpe): se saca por donde vino.
    gx = -fallback.x
    gz = -fallback.z
    len = Math.hypot(gx, gz)
    if (len < 1e-6) return null
  }
  const nx = gx / len
  const nz = gz / len
  let depth = 0
  for (let i = 1; i <= 10; i++) {
    depth = i * 0.025
    if (heightAt(world, x + nx * depth, z + nz * depth) <= bottom + tolerance) break
  }
  return { nx, nz, depth }
}

// --- Rieles --------------------------------------------------------------------------------------------

export interface RailPoint {
  /** Posicion 0..1 a lo largo del riel. */
  t: number
  x: number
  y: number
  z: number
  /** Distancia horizontal al riel. */
  lateral: number
  /** Direccion unitaria horizontal del riel (a -> b). */
  ux: number
  uz: number
  length: number
}

export function closestOnRail(r: Rail, x: number, z: number): RailPoint {
  const dx = r.bx - r.ax
  const dz = r.bz - r.az
  const length = Math.hypot(dx, dz)
  const ux = dx / length
  const uz = dz / length
  const t = clamp(((x - r.ax) * ux + (z - r.az) * uz) / length, 0, 1)
  const px = r.ax + dx * t
  const pz = r.az + dz * t
  return {
    t,
    x: px,
    y: r.ay + (r.by - r.ay) * t,
    z: pz,
    lateral: Math.hypot(x - px, z - pz),
    ux,
    uz,
    length,
  }
}
