// Rally de Cocina: récords por pista y por auto, y desbloqueo de pistas. Todo se guarda en el celular
// con las claves `rdc:` (ver `store` en data.ts). Son funciones puras sobre un almacén chico: se testean
// con un Map en vez de localStorage.

export interface KV {
  get<T>(k: string, d: T): T
  set(k: string, v: unknown): void
}

/** La pista que ya existía antes de que hubiera varias: sus récords viejos pasan a ella. */
export const LEGACY_TRACK = 'cocina'

export const lapKey = (track: string, car: string) => `best:${track}:${car}`
export const raceKey = (track: string, car: string, laps: number) => `race:${track}:${car}:${laps}`
const PODIUMS_KEY = 'podiums'

/**
 * Los récords de vuelta de antes (`rdc:best:<auto>`) eran de la única pista: se copian a
 * `rdc:best:cocina:<auto>` sin tocar los viejos y sin pisar un récord nuevo ya guardado.
 * Devuelve cuántos copió.
 */
export function migrateRecords(kv: KV, carIds: string[]): number {
  let moved = 0
  for (const id of carIds) {
    const old = kv.get<number | null>(`best:${id}`, null)
    if (typeof old !== 'number' || !Number.isFinite(old)) continue
    const k = lapKey(LEGACY_TRACK, id)
    const cur = kv.get<number | null>(k, null)
    if (typeof cur === 'number' && Number.isFinite(cur) && cur <= old) continue
    kv.set(k, old)
    moved++
  }
  return moved
}

function readTime(kv: KV, key: string): number | null {
  const v = kv.get<number | null>(key, null)
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

export const getLapRecord = (kv: KV, track: string, car: string) => readTime(kv, lapKey(track, car))
export const getRaceRecord = (kv: KV, track: string, car: string, laps: number) =>
  readTime(kv, raceKey(track, car, laps))

/** Guarda la mejor vuelta si es récord; devuelve true si lo es. */
export function recordLap(kv: KV, track: string, car: string, lap: number): boolean {
  if (!Number.isFinite(lap) || lap <= 0) return false
  const prev = getLapRecord(kv, track, car)
  if (prev !== null && lap >= prev) return false
  kv.set(lapKey(track, car), lap)
  return true
}

/** Guarda el tiempo total de la carrera (por cantidad de vueltas) si es récord. */
export function recordRace(
  kv: KV,
  track: string,
  car: string,
  time: number,
  laps: number,
): boolean {
  if (!Number.isFinite(time) || time <= 0) return false
  const prev = getRaceRecord(kv, track, car, laps)
  if (prev !== null && time >= prev) return false
  kv.set(raceKey(track, car, laps), time)
  return true
}

/* ---------- desbloqueos ---------- */

/** Subir al podio: entre los tres primeros, pero nunca último (con pocos autos, hay que ser mejor). */
export function earnsPodium(place: number, cars: number): boolean {
  return place >= 1 && place <= Math.min(3, cars - 1)
}

export function getPodiums(kv: KV): string[] {
  const v = kv.get<unknown>(PODIUMS_KEY, [])
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Anota que subiste al podio en esa pista. Devuelve el id de la pista que se abre, si se abre una nueva. */
export function markPodium(kv: KV, trackIds: string[], trackId: string, open = 2): string | null {
  const before = unlockedIds(kv, trackIds, open)
  const podiums = getPodiums(kv)
  if (!podiums.includes(trackId)) {
    podiums.push(trackId)
    kv.set(PODIUMS_KEY, podiums)
  }
  const after = unlockedIds(kv, trackIds, open)
  return after.find((id) => !before.includes(id)) ?? null
}

/** Las primeras `open` pistas están abiertas; cada una de las siguientes, al subir al podio en la anterior. */
export function unlockedIds(kv: KV, trackIds: string[], open = 2): string[] {
  const podiums = getPodiums(kv)
  const out: string[] = []
  trackIds.forEach((id, i) => {
    if (i < open || podiums.includes(trackIds[i - 1]!)) out.push(id)
  })
  return out
}

export const isUnlocked = (kv: KV, trackIds: string[], id: string, open = 2) =>
  unlockedIds(kv, trackIds, open).includes(id)
