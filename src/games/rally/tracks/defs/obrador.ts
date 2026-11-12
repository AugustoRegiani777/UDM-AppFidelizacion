import type { TrackDef } from '../types.ts'
import { pickupRows, pts } from './helpers.ts'

/** Mesada de acero del obrador: dos rectas largas con chicanas, entre rodillos y bolsas de harina. */
export const OBRADOR: TrackDef = {
  version: 1,
  id: 'obrador',
  name: 'El Obrador',
  description: 'Mesada de acero con chicanas entre rodillos y harina derramada que frena.',
  theme: 'obrador',
  difficulty: 2,
  halfWidth: 5,
  laps: 3,
  start: { x: -55, z: 62 },
  controlPoints: pts([
    [-82, 62],
    [-50, 62],
    [-18, 62],
    [8, 49],
    [36, 64],
    [64, 62],
    [88, 44],
    [95, 12],
    [86, -25],
    [62, -52],
    [35, -42],
    [10, -58],
    [-20, -50],
    [-48, -60],
    [-80, -52],
    [-96, -22],
    [-96, 20],
  ]),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.4 },
  ramps: [
    { s: 0.3, lat: 0, length: 9, width: 4.6, height: 1.8, color: 0xd9573a },
    { s: 0.78, lat: 0, length: 9, width: 4.6, height: 1.8, color: 0x3a7fd9 },
  ],
  pickups: pickupRows([0.1, 0.45, 0.6, 0.9], [-3, 0, 3]),
  zones: [
    { kind: 'sand', s: 0.2, lat: 0, length: 16, width: 6 },
    { kind: 'sand', s: 0.66, lat: -1.5, length: 14, width: 5 },
  ],
  ai: { speed: 0.98, cornerBrake: 0.5, lookahead: 8, slopeCare: 1 },
}
