import type { TrackDef } from '../types.ts'
import { pickupRows, pts } from './helpers.ts'

/** La más fácil: un óvalo ancho y rápido entre las mesas de la terraza, con un par de manchas de arena. */
export const TERRAZA: TrackDef = {
  version: 1,
  id: 'terraza',
  name: 'La Terraza',
  description:
    'Óvalo ancho y rápido entre mesas y sillas de bar, con sol de tarde. Ideal para empezar.',
  theme: 'terraza',
  difficulty: 1,
  halfWidth: 6,
  laps: 3,
  start: { x: -20, z: 64 },
  controlPoints: pts([
    [-55, 60],
    [0, 64],
    [55, 60],
    [88, 38],
    [92, 0],
    [80, -30],
    [50, -52],
    [10, -45],
    [-20, -58],
    [-60, -60],
    [-90, -38],
    [-95, 0],
    [-85, 35],
  ]),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.8 },
  ramps: [{ s: 0.1, lat: 0, length: 9, width: 5, height: 1.7, color: 0x2f8f6b }],
  pickups: pickupRows([0.2, 0.4, 0.62, 0.85], [-3.6, 0, 3.6]),
  zones: [
    { kind: 'sand', s: 0.25, lat: 2.5, length: 14, width: 5 },
    { kind: 'sand', s: 0.75, lat: -2.5, length: 14, width: 5 },
  ],
  ai: { speed: 0.97, cornerBrake: 0.4, lookahead: 8, slopeCare: 1 },
}
