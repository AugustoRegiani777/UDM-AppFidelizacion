// Los spots de "Miga Skate": cada uno es un mapa (ver physics.ts) con tres objetivos. Cada objetivo
// cumplido es una estrella. Los textos de los spots viven en src/copy/es.ts.

import {
  quarterRun,
  surfaceLength,
  type Dir,
  type Rail,
  type Surface,
  type WorldDef,
} from './physics.ts'
import type { TrickTag } from './tricks.ts'

export type Objective =
  | { kind: 'score'; target: number }
  | { kind: 'combo'; target: number }
  | { kind: 'comboLen'; target: number }
  | { kind: 'trick'; tag: TrickTag; count: number }
  | { kind: 'grindSeconds'; target: number }
  | { kind: 'manualSeconds'; target: number }
  | { kind: 'height'; target: number }

export interface SpotTheme {
  sky: number
  fog: number
  ground: number
  line: number
  wall: number
  accent: number
}

export interface SpotDef {
  id: string
  seconds: number
  world: WorldDef
  objectives: [Objective, Objective, Objective]
  theme: SpotTheme
}

// --- Constructores de obstaculos ----------------------------------------------------------------

const box = (x: number, z: number, w: number, d: number, height: number): Surface => ({
  type: 'box',
  x,
  z,
  w,
  d,
  height,
  dir: 'pz',
})

const kicker = (
  x: number,
  z: number,
  w: number,
  len: number,
  height: number,
  dir: Dir,
): Surface => ({
  type: 'ramp',
  x,
  z,
  w: dir === 'px' || dir === 'nx' ? len : w,
  d: dir === 'pz' || dir === 'nz' ? len : w,
  height,
  dir,
})

const stairs = (
  x: number,
  z: number,
  w: number,
  len: number,
  height: number,
  steps: number,
  dir: Dir,
): Surface => ({
  ...kicker(x, z, w, len, height, dir),
  type: 'stairs',
  steps,
})

/** Cuarto de pipa pegado a un borde `edge`: sube hacia afuera. `width` es el ancho a lo largo del borde. */
function quarter(edge: number, across: number, width: number, height: number, dir: Dir): Surface {
  const len = quarterRun(height) + 2
  switch (dir) {
    case 'pz':
      return { type: 'quarter', x: across, z: edge + len / 2, w: width, d: len, height, dir }
    case 'nz':
      return { type: 'quarter', x: across, z: edge - len / 2, w: width, d: len, height, dir }
    case 'px':
      return { type: 'quarter', x: edge + len / 2, z: across, w: len, d: width, height, dir }
    case 'nx':
      return { type: 'quarter', x: edge - len / 2, z: across, w: len, d: width, height, dir }
  }
}

const rail = (ax: number, az: number, ay: number, bx: number, bz: number, by: number): Rail => ({
  ax,
  az,
  ay,
  bx,
  bz,
  by,
})

/** Cornisa: un bloque bajo y largo con un riel por encima. */
function ledge(x: number, z: number, length: number, height: number, alongZ: boolean) {
  const w = alongZ ? 0.9 : length
  const d = alongZ ? length : 0.9
  return {
    surface: box(x, z, w, d, height),
    rail: {
      ...(alongZ
        ? rail(x, z - length / 2, height, x, z + length / 2, height)
        : rail(x - length / 2, z, height, x + length / 2, z, height)),
      ledge: true,
    },
  }
}

const SPOT_START = { x: 0, z: -11, heading: 0 }

function plaza(): SpotDef {
  const l = ledge(-8, 3, 6, 0.55, true)
  return {
    id: 'plaza',
    seconds: 120,
    theme: {
      sky: 0x9fd8ff,
      fog: 0xcfeaff,
      ground: 0xd9d2c3,
      line: 0xbdb5a4,
      wall: 0xf0e2c0,
      accent: 0xc8102e,
    },
    world: {
      halfX: 20,
      halfZ: 16,
      start: SPOT_START,
      surfaces: [
        kicker(6, 2, 4, 3.4, 0.9, 'pz'),
        box(-1, 9, 3, 2, 0.4),
        box(12, -4, 2.5, 4, 0.35),
        l.surface,
      ],
      rails: [rail(-2, -2, 0.55, -2, 5, 0.55), l.rail],
    },
    objectives: [
      { kind: 'trick', tag: 'ollie', count: 3 },
      { kind: 'score', target: 400 },
      { kind: 'trick', tag: 'kickflip', count: 1 },
    ],
  }
}

function museum(): SpotDef {
  return {
    id: 'museum',
    seconds: 120,
    theme: {
      sky: 0xffd9a8,
      fog: 0xffe9cc,
      ground: 0xcfc6b8,
      line: 0xaaa090,
      wall: 0xe8c9a0,
      accent: 0x8a5a2b,
    },
    world: {
      halfX: 22,
      halfZ: 18,
      start: SPOT_START,
      surfaces: [
        // Escalera de 5 escalones que sube hacia el norte hasta una plataforma.
        stairs(0, 3.5, 6, 5, 1.5, 5, 'pz'),
        box(0, 9.5, 6, 7, 1.5),
        kicker(-9, -2, 4, 3.4, 0.9, 'pz'),
        box(9, 0, 3, 3, 0.45),
      ],
      rails: [
        rail(-3.4, 1, 0.8, -3.4, 6, 2),
        rail(3.4, 1, 0.8, 3.4, 6, 2),
        rail(-9, 6, 0.55, -9, 12, 0.55),
      ],
    },
    objectives: [
      { kind: 'trick', tag: 'grind', count: 1 },
      { kind: 'score', target: 800 },
      { kind: 'trick', tag: 'shuvit', count: 2 },
    ],
  }
}

function boxes(): SpotDef {
  const a = ledge(-9, 0, 8, 0.5, true)
  const b = ledge(9, 3, 8, 0.5, true)
  return {
    id: 'boxes',
    seconds: 120,
    theme: {
      sky: 0xb7e4c7,
      fog: 0xdaf5e2,
      ground: 0xc9cdd2,
      line: 0xa9aeb5,
      wall: 0xdde7df,
      accent: 0x2e8b57,
    },
    world: {
      halfX: 22,
      halfZ: 18,
      start: SPOT_START,
      surfaces: [
        // Funbox con rampas de subida y de bajada.
        kicker(0, 1.7, 6, 3.4, 0.8, 'pz'),
        box(0, 3.4 + 2.5, 6, 5, 0.8),
        kicker(0, 3.4 + 5 + 1.7, 6, 3.4, 0.8, 'nz'),
        a.surface,
        b.surface,
        box(15, -6, 4, 4, 0.55),
      ],
      rails: [a.rail, b.rail, rail(-15, -4, 0.6, -15, 8, 0.6), rail(14, 8, 0.6, 18, 8, 0.6)],
    },
    objectives: [
      { kind: 'comboLen', target: 3 },
      { kind: 'grindSeconds', target: 2 },
      { kind: 'trick', tag: 'heelflip', count: 1 },
    ],
  }
}

function bowl(): SpotDef {
  const h = 1.6
  return {
    id: 'bowl',
    seconds: 120,
    theme: {
      sky: 0xcdb4ff,
      fog: 0xe5d9ff,
      ground: 0xb8b0c8,
      line: 0x9a92ad,
      wall: 0xe2dbf2,
      accent: 0x6d4aff,
    },
    world: {
      halfX: 20,
      halfZ: 15,
      start: { x: 0, z: -4, heading: 0 },
      surfaces: [
        quarter(-8, 0, 40, h, 'nz'),
        quarter(8, 0, 40, h, 'pz'),
        quarter(-12, 0, 16, h, 'nx'),
        quarter(12, 0, 16, h, 'px'),
        kicker(0, 0, 4, 3.4, 0.7, 'pz'),
      ],
      rails: [],
    },
    objectives: [
      { kind: 'height', target: 2.2 },
      { kind: 'trick', tag: 'grab', count: 1 },
      { kind: 'score', target: 1200 },
    ],
  }
}

function park(): SpotDef {
  const l = ledge(-10, 4, 7, 0.55, true)
  return {
    id: 'park',
    seconds: 150,
    theme: {
      sky: 0xffb3a7,
      fog: 0xffd8d0,
      ground: 0xcdc3bd,
      line: 0xaa9f98,
      wall: 0xf3d6cf,
      accent: 0xc8102e,
    },
    world: {
      halfX: 26,
      halfZ: 20,
      start: { x: 0, z: -15, heading: 0 },
      surfaces: [
        quarter(14, -8, 14, 1.5, 'pz'),
        quarter(14, 8, 14, 1.5, 'pz'),
        quarter(-18, 0, 20, 1.4, 'nx'),
        kicker(0, -1.3, 5, 3.6, 0.95, 'pz'),
        box(0, 3, 5, 5, 0.95),
        kicker(0, 7.2, 5, 3.4, 0.95, 'nz'),
        stairs(14, -2, 5, 5, 1.5, 5, 'px'),
        box(19, -2, 5, 5, 1.5),
        l.surface,
      ],
      rails: [
        l.rail,
        rail(8, -8, 0.6, 8, 4, 0.6),
        rail(-15, -10, 0.6, -15, 2, 0.6),
        rail(11.5, -4.9, 0.8, 16.5, -4.9, 2),
      ],
    },
    objectives: [
      { kind: 'combo', target: 1500 },
      { kind: 'trick', tag: 'shuvit360', count: 1 },
      { kind: 'manualSeconds', target: 3 },
    ],
  }
}

export const SPOTS: SpotDef[] = [plaza(), museum(), boxes(), bowl(), park()]
export const SPOT_COUNT = SPOTS.length

export function spotAt(index: number): SpotDef {
  return SPOTS[Math.max(0, Math.min(SPOT_COUNT - 1, Math.floor(index)))]!
}

// Los cuartos y las escaleras deben caber dentro del mapa (se verifica en los tests).
export const surfaceBounds = (s: Surface) => ({
  minX: s.x - s.w / 2,
  maxX: s.x + s.w / 2,
  minZ: s.z - s.d / 2,
  maxZ: s.z + s.d / 2,
  length: surfaceLength(s),
})
