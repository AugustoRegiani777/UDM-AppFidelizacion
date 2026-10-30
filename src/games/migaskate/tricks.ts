// Nombres y puntos de los trucos de "Miga Skate". Se juzgan al aterrizar, segun cuanto giraron la tabla
// (roll = flip, yaw = shove-it) y el cuerpo (spin) durante el salto. Los nombres para mostrar viven en
// src/copy/es.ts; aca solo hay claves.

import type { GrabName } from './gestures.ts'
import type { LandedTrick } from './physics.ts'

export type TrickKey =
  | 'ollie'
  | 'kickflip'
  | 'heelflip'
  | 'doubleKickflip'
  | 'doubleHeelflip'
  | 'varialKickflip'
  | 'varialHeelflip'
  | 'flip360'
  | 'laserflip'
  | 'shuvit'
  | 'shuvit360'
  | 'spin180'
  | 'spin360'
  | 'air'
  | 'indy'
  | 'melon'
  | 'noseGrab'
  | 'tailGrab'
  | 'grind'
  | 'boardslide'
  | 'manual'
  | 'noseManual'

/** Etiquetas que usan los objetivos de cada spot. */
export type TrickTag =
  | 'ollie'
  | 'nollie'
  | 'flip'
  | 'kickflip'
  | 'heelflip'
  | 'doubleflip'
  | 'flip360'
  | 'shuvit'
  | 'shuvit360'
  | 'spin180'
  | 'spin360'
  | 'grab'
  | 'grind'
  | 'boardslide'
  | 'manual'
  | 'air'

export interface TrickItem {
  key: TrickKey
  nollie: boolean
  points: number
  tags: TrickTag[]
}

export const GRAB_KEYS: Record<GrabName, TrickKey> = {
  indy: 'indy',
  melon: 'melon',
  nose: 'noseGrab',
  tail: 'tailGrab',
}

const item = (key: TrickKey, points: number, tags: TrickTag[], nollie = false): TrickItem => ({
  key,
  nollie,
  points: Math.round(nollie ? points * 1.25 : points),
  tags: nollie ? [...tags, 'nollie'] : tags,
})

/** Trucos que sumo un aterrizaje limpio. Vacio si fue un salto sin gracia (un escalon, una caidita). */
export function itemsFromLanding(t: LandedTrick): TrickItem[] {
  const items: TrickItem[] = []
  const r = Math.abs(t.roll)
  const y = Math.abs(t.yaw)

  if (r >= 2) {
    items.push(
      t.roll > 0
        ? item('doubleKickflip', 560, ['flip', 'kickflip', 'doubleflip'], t.nollie)
        : item('doubleHeelflip', 560, ['flip', 'heelflip', 'doubleflip'], t.nollie),
    )
  } else if (r === 1) {
    if (y >= 2) {
      items.push(
        t.roll > 0
          ? item('flip360', 480, ['flip', 'kickflip', 'flip360', 'shuvit'], t.nollie)
          : item('laserflip', 480, ['flip', 'heelflip', 'flip360', 'shuvit'], t.nollie),
      )
    } else if (y === 1) {
      items.push(
        t.roll > 0
          ? item('varialKickflip', 380, ['flip', 'kickflip', 'shuvit'], t.nollie)
          : item('varialHeelflip', 380, ['flip', 'heelflip', 'shuvit'], t.nollie),
      )
    } else {
      items.push(
        t.roll > 0
          ? item('kickflip', 250, ['flip', 'kickflip'], t.nollie)
          : item('heelflip', 250, ['flip', 'heelflip'], t.nollie),
      )
    }
  } else if (y >= 2) {
    items.push(item('shuvit360', 320, ['shuvit', 'shuvit360'], t.nollie))
  } else if (y === 1) {
    items.push(item('shuvit', 140, ['shuvit'], t.nollie))
  } else if (t.popped) {
    items.push(item('ollie', 50, t.nollie ? ['ollie', 'nollie'] : ['ollie']))
  }

  const s = Math.abs(t.spin)
  if (s >= 2) items.push(item('spin360', 260, ['spin360', 'spin180']))
  else if (s === 1) items.push(item('spin180', 110, ['spin180']))

  if (t.grab) items.push(item(GRAB_KEYS[t.grab], 130, ['grab']))

  if (items.length === 0 && (t.height > 0.8 || t.airTime > 0.6)) {
    items.push(item('air', Math.round(t.height * 45), ['air']))
  }
  // Un salto con giros tambien cuenta como ollie para los objetivos.
  if (t.popped && !items.some((i) => i.tags.includes('ollie'))) {
    items[0]?.tags.push('ollie')
  }
  return items
}

export const GRIND_BASE = 100
export const GRIND_PER_SECOND = 220
export const BOARDSLIDE_FACTOR = 1.3
export const MANUAL_PER_SECOND = 90

/** Multiplicador del combo: cada truco encadenado suma medio punto de multiplicador (tope x5). */
export const comboMultiplier = (count: number) => Math.min(5, 1 + 0.5 * Math.max(0, count - 1))
