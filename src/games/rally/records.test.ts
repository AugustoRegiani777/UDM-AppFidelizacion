import { describe, expect, it } from 'vitest'
import {
  earnsPodium,
  getLapRecord,
  getPodiums,
  getRaceRecord,
  isUnlocked,
  lapKey,
  markPodium,
  migrateRecords,
  raceKey,
  recordLap,
  recordRace,
  unlockedIds,
  type KV,
} from './records.ts'

/** Un almacén en memoria con las mismas claves que localStorage (`rdc:` va aparte, en `store`). */
function memory(init: Record<string, unknown> = {}): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(init))
  return {
    data,
    get<T>(k: string, d: T): T {
      return data.has(k) ? (data.get(k) as T) : d
    },
    set(k, v) {
      data.set(k, v)
    },
  }
}
const CARS = ['chispa', 'rayo', 'grillo']
const TRACKS = ['cocina', 'terraza', 'obrador', 'barra']

describe('récords por pista y por auto', () => {
  it('guarda la mejor vuelta y el mejor tiempo de carrera por separado para cada pista y auto', () => {
    const kv = memory()
    expect(recordLap(kv, 'cocina', 'chispa', 21.5)).toBe(true)
    expect(recordLap(kv, 'cocina', 'chispa', 22)).toBe(false)
    expect(recordLap(kv, 'cocina', 'chispa', 20.9)).toBe(true)
    expect(recordLap(kv, 'terraza', 'chispa', 25)).toBe(true) // otra pista: no compite
    expect(recordLap(kv, 'cocina', 'rayo', 30)).toBe(true) // otro auto: no compite
    expect(getLapRecord(kv, 'cocina', 'chispa')).toBe(20.9)
    expect(getLapRecord(kv, 'terraza', 'chispa')).toBe(25)
    expect(getLapRecord(kv, 'barra', 'chispa')).toBeNull()

    expect(recordRace(kv, 'cocina', 'chispa', 70, 3)).toBe(true)
    expect(recordRace(kv, 'cocina', 'chispa', 71, 3)).toBe(false)
    expect(recordRace(kv, 'cocina', 'chispa', 25, 1)).toBe(true) // otra cantidad de vueltas
    expect(getRaceRecord(kv, 'cocina', 'chispa', 3)).toBe(70)
    expect(getRaceRecord(kv, 'cocina', 'chispa', 5)).toBeNull()
    expect(kv.data.has(raceKey('cocina', 'chispa', 3))).toBe(true)
  })

  it('ignora tiempos inválidos', () => {
    const kv = memory()
    expect(recordLap(kv, 'cocina', 'chispa', Infinity)).toBe(false)
    expect(recordLap(kv, 'cocina', 'chispa', 0)).toBe(false)
    expect(recordRace(kv, 'cocina', 'chispa', NaN, 3)).toBe(false)
    expect(kv.data.size).toBe(0)
    const dirty = memory({ [lapKey('cocina', 'chispa')]: 'roto' })
    expect(getLapRecord(dirty, 'cocina', 'chispa')).toBeNull()
  })
})

describe('migración de los récords de cuando había una sola pista', () => {
  it('copia rdc:best:<auto> a la Cocina sin perder nada ni pisar un récord nuevo mejor', () => {
    const kv = memory({
      'best:chispa': 21.4,
      'best:rayo': 19.8,
      [lapKey('cocina', 'rayo')]: 18.5, // ya había uno nuevo, mejor
      'best:grillo': 'basura',
    })
    expect(migrateRecords(kv, CARS)).toBe(1)
    expect(getLapRecord(kv, 'cocina', 'chispa')).toBe(21.4)
    expect(getLapRecord(kv, 'cocina', 'rayo')).toBe(18.5)
    expect(getLapRecord(kv, 'cocina', 'grillo')).toBeNull()
    // los viejos siguen ahí (por si se vuelve a una versión anterior)
    expect(kv.get('best:chispa', 0)).toBe(21.4)
  })

  it('si el récord viejo es mejor que el nuevo, gana el viejo; y repetirla no cambia nada', () => {
    const kv = memory({ 'best:chispa': 20, [lapKey('cocina', 'chispa')]: 23 })
    expect(migrateRecords(kv, CARS)).toBe(1)
    expect(getLapRecord(kv, 'cocina', 'chispa')).toBe(20)
    expect(migrateRecords(kv, CARS)).toBe(0)
    expect(getLapRecord(kv, 'cocina', 'chispa')).toBe(20)
  })
})

describe('desbloqueo de pistas', () => {
  it('las dos primeras están abiertas y cada una de las demás se abre al subir al podio en la anterior', () => {
    const kv = memory()
    expect(unlockedIds(kv, TRACKS)).toEqual(['cocina', 'terraza'])
    expect(isUnlocked(kv, TRACKS, 'obrador')).toBe(false)
    // el podio en la Cocina no abre nada nuevo (ya estaba abierta la 2ª)
    expect(markPodium(kv, TRACKS, 'cocina')).toBeNull()
    // el podio en la 2ª abre la 3ª
    expect(markPodium(kv, TRACKS, 'terraza')).toBe('obrador')
    expect(unlockedIds(kv, TRACKS)).toEqual(['cocina', 'terraza', 'obrador'])
    // repetirlo no abre otra
    expect(markPodium(kv, TRACKS, 'terraza')).toBeNull()
    expect(getPodiums(kv)).toEqual(['cocina', 'terraza'])
    expect(markPodium(kv, TRACKS, 'obrador')).toBe('barra')
    expect(isUnlocked(kv, TRACKS, 'barra')).toBe(true)
  })

  it('el podio son los tres primeros, pero nunca el último lugar', () => {
    expect(earnsPodium(1, 4)).toBe(true)
    expect(earnsPodium(3, 4)).toBe(true)
    expect(earnsPodium(4, 4)).toBe(false)
    expect(earnsPodium(2, 3)).toBe(true)
    expect(earnsPodium(3, 3)).toBe(false)
    expect(earnsPodium(1, 2)).toBe(true)
    expect(earnsPodium(2, 2)).toBe(false)
    expect(earnsPodium(0, 6)).toBe(false)
  })

  it('tolera datos guardados rotos', () => {
    const kv = memory({ podiums: 'nada' })
    expect(unlockedIds(kv, TRACKS)).toEqual(['cocina', 'terraza'])
    const mixed = memory({ podiums: ['terraza', 7, null] })
    expect(getPodiums(mixed)).toEqual(['terraza'])
  })
})
