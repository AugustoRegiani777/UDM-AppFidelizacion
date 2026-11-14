// Rally de Cocina: puntuación para el ranking casual (no oficial), calculada a partir de los récords de vuelta.
//
// Conversión: por cada pista del juego se toma la MEJOR vuelta (en segundos) entre todos los autos y vale
// round(LAP_POINTS / segundos) puntos; el puntaje es la suma de todas las pistas. Una vuelta más rápida
// siempre da más puntos y correr una pista nueva siempre suma. Las pistas propias del editor y la de prueba
// no cuentan (se podrían hacer cortísimas). Con vueltas de ~20 s una pista vale ~500 puntos.
// El servidor igual se queda con el mayor valor y rechaza lo que pase de 100000.

import { isCustomTrackId } from './tracks/types.ts'

export const LAP_POINTS = 10000
export const RALLY_SCORE_MAX = 100000

/** Claves de récord de vuelta: `best:<pista>:<auto>` (las viejas `best:<auto>` no tienen pista y se ignoran). */
export function rallyScore(records: Iterable<readonly [string, unknown]>): number {
  const bestByTrack = new Map<string, number>()
  for (const [key, value] of records) {
    const parts = key.split(':')
    if (parts.length !== 3 || parts[0] !== 'best') continue
    const track = parts[1]!
    if (isCustomTrackId(track)) continue // incluye la pista de prueba del editor
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    const prev = bestByTrack.get(track)
    if (prev === undefined || value < prev) bestByTrack.set(track, value)
  }
  let total = 0
  for (const t of bestByTrack.values()) total += Math.round(LAP_POINTS / t)
  return Math.min(RALLY_SCORE_MAX, total)
}

/** Lee los récords guardados en este celular (claves `rdc:best:...`). Sin almacenamiento devuelve 0. */
export function storedRallyScore(): number {
  try {
    const entries: [string, unknown][] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('rdc:best:')) continue
      entries.push([k.slice(4), JSON.parse(localStorage.getItem(k) ?? 'null')])
    }
    return rallyScore(entries)
  } catch {
    return 0
  }
}
