import type { TrackDef } from '../types.ts'
import { pickupRows, pts } from './helpers.ts'

/** La montaña de harina: la pista con relieve. Subida larga, crestas, una joroba para saltar y bajada. */
export const HARINA: TrackDef = {
  version: 1,
  id: 'harina',
  name: 'La Montaña de Harina',
  description:
    'Una montaña de harina con subidas largas, crestas y bajadas. Con turbo, la joroba te hace volar.',
  theme: 'harina',
  difficulty: 4,
  halfWidth: 5.4,
  laps: 3,
  start: { x: -35, z: 59 },
  controlPoints: pts([
    [-70, 57, 0.3],
    [-35, 60, 0.3],
    [0, 60, 0.3],
    [32, 58, 0.6],
    [66, 47, 2],
    [90, 27, 4.4],
    [96, -2, 7],
    [86, -32, 9],
    [60, -52, 9.4],
    [28, -60, 8.6],
    [14, -57, 8.6],
    [2, -52, 10.2],
    [-10, -50, 8.4],
    [-30, -60, 8],
    [-62, -56, 6.6],
    [-88, -38, 4.4],
    [-98, -8, 2.6],
    [-94, 24, 1.1],
    [-88, 44, 0.4],
  ]),
  grid: { firstRow: 6, rowGap: 7, lateral: 2.5 },
  ramps: [
    { s: 0.08, lat: 0, length: 9, width: 4.8, height: 1.8, color: 0xc0572f },
    { s: 0.74, lat: 0, length: 9, width: 4.8, height: 1.8, color: 0x6b8f5a },
  ],
  pickups: pickupRows([0.15, 0.32, 0.48, 0.64, 0.9], [-3.2, 0, 3.2]),
  zones: [
    { kind: 'sand', s: 0.24, lat: 0, length: 16, width: 6 },
    { kind: 'sand', s: 0.58, lat: 1.5, length: 12, width: 5 },
  ],
  ai: { speed: 0.97, cornerBrake: 0.5, lookahead: 10, slopeCare: 1 },
}
