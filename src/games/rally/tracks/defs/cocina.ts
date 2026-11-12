import type { TrackDef } from '../types.ts'
import { pickupRows } from './helpers.ts'

/** La pista original: un óvalo irregular que pasa bajo la mesa grande de la cocina. Plana. */
export const COCINA: TrackDef = {
  version: 1,
  id: 'cocina',
  name: 'La Cocina',
  description: 'La pista de siempre: pasa bajo la mesa grande, con dos rampas-libro.',
  theme: 'cocina',
  difficulty: 2,
  halfWidth: 5.2,
  laps: 3,
  samples: 700,
  start: { x: -12, z: 56 },
  controlPoints: [
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
  ].map(([x, z]) => ({ x: x!, z: z!, y: 0 })),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.4 },
  ramps: [
    { s: 60 / 700, lat: -1.6, length: 9, width: 4.4, height: 1.9, color: 0xb8324a },
    { s: 532 / 700, lat: 1.4, length: 9, width: 4.4, height: 1.9, color: 0x2f7d5b },
  ],
  pickups: pickupRows([140 / 700, 301 / 700, 448 / 700, 602 / 700], [-3.2, 0, 3.2]),
  zones: [],
  ai: { speed: 1, cornerBrake: 0.45, lookahead: 8, slopeCare: 1 },
}
