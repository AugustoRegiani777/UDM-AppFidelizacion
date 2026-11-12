// Rally de Cocina: registro de pistas. El orden de la lista es el orden del menú y de los desbloqueos.
import { buildRuntime, type TrackRuntime } from './runtime.ts'
import type { TrackDef } from './types.ts'
import { BARRA } from './defs/barra.ts'
import { COCINA } from './defs/cocina.ts'
import { FALLAS } from './defs/fallas.ts'
import { HARINA } from './defs/harina.ts'
import { OBRADOR } from './defs/obrador.ts'
import { TERRAZA } from './defs/terraza.ts'
import { VITRINA } from './defs/vitrina.ts'

/** Todas las pistas, de la primera a la última. Las dos primeras están abiertas desde el principio. */
export const TRACKS: TrackDef[] = [COCINA, TERRAZA, OBRADOR, BARRA, VITRINA, HARINA, FALLAS]

/** Cuántas pistas están abiertas sin haber ganado nada. */
export const OPEN_TRACKS = 2

export function getTrackDef(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!
}

const cache = new Map<string, TrackRuntime>()
/** El cálculo de una pista (curva, tangentes, alturas…) se hace una sola vez y se reutiliza. */
export function getTrack(id: string): TrackRuntime {
  const def = getTrackDef(id)
  let rt = cache.get(def.id)
  if (!rt) {
    rt = buildRuntime(def)
    cache.set(def.id, rt)
  }
  return rt
}
