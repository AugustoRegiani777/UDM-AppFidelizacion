import type { TrackDef } from '../types.ts'
import { pickupRows, pts } from './helpers.ts'

/** La barra del café: una gota con horquilla cerrada entre tazas gigantes, con café derramado que resbala. */
export const BARRA: TrackDef = {
  version: 1,
  id: 'barra',
  name: 'La Barra',
  description:
    'Una horquilla cerrada entre tazas gigantes y la cafetera. El café derramado hace patinar.',
  theme: 'barra',
  difficulty: 3,
  halfWidth: 4.8,
  laps: 3,
  start: { x: -50, z: 58 },
  controlPoints: pts([
    [-70, 56],
    [-35, 58],
    [0, 52],
    [30, 38],
    [58, 28],
    [80, 18],
    [93, 6],
    [90, -8],
    [72, -14],
    [45, -24],
    [15, -42],
    [-20, -52],
    [-55, -52],
    [-84, -40],
    [-98, -12],
    [-96, 22],
    [-88, 44],
  ]),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.3 },
  ramps: [
    { s: 0.12, lat: 0, length: 8, width: 4.2, height: 1.6, color: 0x7a3b16 },
    { s: 0.5, lat: 0, length: 8, width: 4.2, height: 1.6, color: 0xc0392b },
  ],
  pickups: pickupRows([0.06, 0.3, 0.42, 0.62, 0.82], [-3, 0, 3]),
  zones: [
    { kind: 'slick', s: 0.24, lat: -1, length: 12, width: 5 },
    { kind: 'slick', s: 0.55, lat: 1, length: 12, width: 5 },
    { kind: 'slick', s: 0.9, lat: 0, length: 10, width: 5 },
  ],
  ai: { speed: 0.96, cornerBrake: 0.55, lookahead: 9, slopeCare: 1 },
}
