// Los niveles de "Entregas de Miga": cada mapa (levels.data.ts, generado y resuelto por el solver) con su
// escenario y su vehículo (themes.ts).

import { parseLevel, type Layout } from './engine.ts'
import { LEVEL_DATA } from './levels.data.ts'
import { THEMES, type Theme } from './themes.ts'

export interface Level {
  /** 1, 2, 3… */
  id: number
  theme: Theme
  layout: Layout
  /** Movimientos de la solución de referencia (base de las estrellas). */
  par: number
  /** Empujes mínimos. */
  pushes: number
  /** Solución de referencia ('UDLR'). */
  keys: string
}

export const LEVELS: readonly Level[] = LEVEL_DATA.map((data, index) => ({
  id: index + 1,
  theme: THEMES[index % THEMES.length]!,
  layout: parseLevel(data.rows),
  par: data.moves,
  pushes: data.pushes,
  keys: data.keys,
}))

export const LEVEL_COUNT = LEVELS.length

export const levelAt = (id: number): Level => LEVELS[Math.min(LEVEL_COUNT, Math.max(1, id)) - 1]!
