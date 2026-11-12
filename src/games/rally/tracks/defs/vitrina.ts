import type { TrackDef } from '../types.ts'
import { pickupRows, pts } from './helpers.ts'

/** La vitrina de pastelería: rectas largas y curvas anchas, con charcos de dulce de leche que resbalan. */
export const VITRINA: TrackDef = {
  version: 1,
  id: 'vitrina',
  name: 'La Vitrina',
  description:
    'Rectas largas entre medialunas gigantes. Los charcos de dulce de leche te hacen patinar.',
  theme: 'vitrina',
  difficulty: 3,
  halfWidth: 5.6,
  laps: 3,
  start: { x: -35, z: 59 },
  controlPoints: pts([
    [-70, 55],
    [-35, 59],
    [5, 60],
    [45, 57],
    [78, 48],
    [96, 25],
    [94, -10],
    [72, -34],
    [42, -46],
    [14, -32],
    [-14, -30],
    [-40, -50],
    [-76, -57],
    [-97, -32],
    [-98, 6],
    [-92, 34],
  ]),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.6 },
  ramps: [
    { s: 0.14, lat: 1.2, length: 9, width: 4.8, height: 1.9, color: 0xe05a8a },
    { s: 0.62, lat: -1.2, length: 9, width: 4.8, height: 1.9, color: 0x3bb0b8 },
  ],
  pickups: pickupRows([0.07, 0.3, 0.45, 0.78, 0.9], [-3.4, 0, 3.4]),
  zones: [
    { kind: 'slick', s: 0.22, lat: 1.5, length: 14, width: 6 },
    { kind: 'slick', s: 0.4, lat: -1.5, length: 12, width: 6 },
    { kind: 'slick', s: 0.84, lat: 1, length: 12, width: 6 },
  ],
  ai: { speed: 0.97, cornerBrake: 0.48, lookahead: 8, slopeCare: 1 },
}
