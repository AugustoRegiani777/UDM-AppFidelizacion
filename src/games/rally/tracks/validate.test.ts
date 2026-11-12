import { describe, expect, it } from 'vitest'
import { COCINA } from './defs/cocina.ts'
import { HARINA } from './defs/harina.ts'
import { TERRAZA } from './defs/terraza.ts'
import { checkStructure, parseTrackDef, TRACK_LIMITS, validateTrack } from './validate.ts'
import type { ControlPoint, TrackDef } from './types.ts'

const clone = (d: TrackDef): TrackDef => JSON.parse(JSON.stringify(d)) as TrackDef
const codes = (d: unknown) => validateTrack(d).errors.map((e) => e.code)
const circle = (r: number, n = 10, y = 0): ControlPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    x: Math.cos((i / n) * Math.PI * 2) * r,
    z: Math.sin((i / n) * Math.PI * 2) * r,
    y,
  }))

/** Una pista mínima y válida: un óvalo liso sin objetos. */
function base(): TrackDef {
  return {
    ...clone(TERRAZA),
    id: 'prueba',
    name: 'Prueba',
    controlPoints: circle(60, 12).map((p) => ({ ...p, x: p.x * 1.4 })),
    start: { x: 0, z: 60 },
    ramps: [],
    pickups: [],
    zones: [],
  }
}

describe('validador de pistas: casos buenos', () => {
  it('acepta La Cocina, La Terraza y la Montaña de Harina, y devuelve los números de sanidad', () => {
    for (const def of [COCINA, TERRAZA, HARINA]) {
      const r = validateTrack(def)
      expect(r.errors, def.id).toEqual([])
      expect(r.ok).toBe(true)
      expect(r.metrics!.length).toBeGreaterThan(400)
      expect(r.metrics!.minSep).toBeGreaterThan(2 * def.halfWidth)
    }
    expect(validateTrack(HARINA).metrics!.maxY).toBeGreaterThan(8)
    expect(validateTrack(COCINA).metrics!.maxSlope).toBe(0)
  })

  it('un óvalo mínimo sin objetos es válido (con aviso por pocas cajas)', () => {
    const r = validateTrack(base())
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.code)).toContain('few-pickups')
  })

  it('los errores de límite exponen los valores que usa el editor', () => {
    expect(TRACK_LIMITS.maxSlope).toBeGreaterThan(0.15)
    expect(TRACK_LIMITS.minControlPoints).toBeGreaterThanOrEqual(4)
  })
})

describe('validador de pistas: casos malos', () => {
  it('rechaza estructuras rotas con mensajes claros', () => {
    expect(codes(null)).toEqual(['schema'])
    expect(codes('no es una pista')).toEqual(['schema'])
    const d = base() as unknown as Record<string, unknown>
    d.halfWidth = 'ancho'
    d.theme = 'marte'
    const msgs = checkStructure(d).map((e) => e.message)
    expect(msgs.some((m) => m.includes('halfWidth'))).toBe(true)
    expect(msgs.some((m) => m.includes('theme'))).toBe(true)
    expect(validateTrack(d).metrics).toBeNull()
  })

  it('pide al menos 6 puntos de control', () => {
    const d = base()
    d.controlPoints = d.controlPoints.slice(0, 4)
    expect(codes(d)).toContain('points-min')
  })

  it('detecta el circuito que se cruza a sí mismo (un ocho)', () => {
    const d = base()
    d.controlPoints = [
      [0, 0],
      [40, 30],
      [80, 0],
      [40, -30],
      [0, 0.5],
      [-40, 30],
      [-80, 0],
      [-40, -30],
    ].map(([x, z]) => ({ x: x!, z: z!, y: 0 }))
    d.start = { x: 80, z: 0 }
    expect(codes(d)).toContain('self-intersection')
  })

  it('detecta tramos lejanos demasiado pegados', () => {
    const d = base()
    // una "U" cerrada: las dos ramas quedan a 8 m una de la otra
    d.controlPoints = [
      [-80, -4],
      [-30, -4],
      [30, -4],
      [80, -4],
      [96, 0],
      [80, 4],
      [30, 4],
      [-30, 4],
      [-80, 4],
      [-96, 0],
    ].map(([x, z]) => ({ x: x!, z: z!, y: 0 }))
    d.start = { x: 0, z: -4 }
    expect(codes(d)).toContain('separation')
  })

  it('detecta una curva más cerrada que el ancho de la pista', () => {
    const d = base()
    d.controlPoints = circle(60, 12).map((p) => ({ ...p, x: p.x * 1.4 }))
    d.controlPoints[3] = { x: d.controlPoints[2]!.x + 1, z: d.controlPoints[2]!.z + 3, y: 0 }
    expect(codes(d)).toEqual(expect.arrayContaining(['radius']))
  })

  it('detecta pendientes imposibles, alturas fuera de rango y puntos bajo el piso', () => {
    const steep = base()
    steep.controlPoints = steep.controlPoints.map((p, i) => ({ ...p, y: i === 3 ? 12 : 0 }))
    expect(codes(steep)).toContain('slope')
    const high = base()
    high.controlPoints = high.controlPoints.map((p) => ({ ...p, y: 30 }))
    expect(codes(high)).toContain('too-high')
    const under = base()
    under.controlPoints = under.controlPoints.map((p) => ({ ...p, y: -2 }))
    expect(codes(under)).toContain('below-floor')
  })

  it('valida el ancho', () => {
    const narrow = base()
    narrow.halfWidth = 2
    expect(codes(narrow)).toContain('width')
    const wide = base()
    wide.halfWidth = 12
    expect(codes(wide)).toContain('width')
  })

  it('detecta una pista que se sale del cuarto', () => {
    const d = base()
    d.controlPoints = d.controlPoints.map((p) => ({ ...p, x: p.x * 1.6 }))
    d.start = { x: 134, z: 0 }
    expect(codes(d)).toContain('bounds')
  })

  it('detecta puntos de control encimados (el cierre manual de la curva)', () => {
    const d = base()
    d.controlPoints = [...d.controlPoints, { ...d.controlPoints[0]! }]
    expect(codes(d)).toContain('duplicate-points')
  })

  it('mantiene la parrilla libre: sin rampas, cajas ni zonas encima, y en recta', () => {
    const d = base()
    d.ramps = [{ s: 0.985, lat: 0, length: 8, width: 4, height: 1.5, color: 0xff0000 }]
    d.pickups = [{ s: 0.99, lat: 0 }]
    d.zones = [{ kind: 'slick', s: 0.98, lat: 0, length: 10, width: 4 }]
    const c = codes(d)
    expect(c.filter((x) => x === 'grid-obstacle').length).toBeGreaterThanOrEqual(3)
    const curved = base()
    curved.start = { x: 0, z: 60 } // en lo alto del óvalo: una curva
    curved.controlPoints = circle(40, 12) // círculo chico: la largada queda en plena curva
    expect(codes(curved)).toContain('grid-curve')
  })

  it('exige las rampas, cajas y zonas sobre la pista y bien formadas', () => {
    const d = base()
    d.ramps = [
      { s: 0.3, lat: 4.5, length: 8, width: 5, height: 1.5, color: 0 }, // se sale del asfalto
      { s: 0.5, lat: 0, length: 30, width: 4, height: 1.5, color: 0 }, // demasiado larga
    ]
    d.pickups = [
      { s: 0.4, lat: 9 }, // fuera de la pista
      { s: 0.7, lat: 0 },
      { s: 0.7, lat: 0.5 }, // encimada con la anterior
    ]
    d.zones = [
      { kind: 'sand', s: 0.6, lat: 4.4, length: 10, width: 5 }, // fuera
      { kind: 'sand', s: 0.2, lat: 0, length: 60, width: 4 }, // muy larga
    ]
    const c = codes(d)
    expect(c).toEqual(
      expect.arrayContaining([
        'ramp-off-track',
        'ramp-size',
        'pickup-off-track',
        'pickup-overlap',
        'zone-off-track',
        'zone-size',
      ]),
    )
  })

  it('no deja una caja sorpresa sobre una rampa ni dos zonas superpuestas', () => {
    const d = base()
    d.ramps = [{ s: 0.5, lat: 0, length: 8, width: 4, height: 1.5, color: 0 }]
    d.pickups = [{ s: 0.5, lat: 0 }]
    d.zones = [
      { kind: 'slick', s: 0.3, lat: 0, length: 10, width: 4 },
      { kind: 'sand', s: 0.3, lat: 0, length: 10, width: 4 },
    ]
    expect(codes(d)).toEqual(expect.arrayContaining(['pickup-on-ramp', 'zone-overlap']))
  })

  it('cada error trae un mensaje en español y, si se puede, dónde ocurre', () => {
    const d = base()
    d.controlPoints = d.controlPoints.map((p, i) => ({ ...p, y: i === 3 ? 12 : 0 }))
    const e = validateTrack(d).errors.find((x) => x.code === 'slope')!
    expect(e.severity).toBe('error')
    expect(e.message).toMatch(/pendiente/)
    expect(e.at).toBeDefined()
  })
})

describe('leer una pista de un JSON', () => {
  it('el round-trip JSON de una pista queda idéntico y sigue siendo válido', () => {
    for (const def of [COCINA, HARINA]) {
      const text = JSON.stringify(def)
      const back = parseTrackDef(text)
      expect(back.errors).toEqual([])
      expect(back.def).toEqual(def)
      expect(validateTrack(back.def).ok).toBe(true)
    }
  })

  it('un texto que no es JSON da un error claro', () => {
    const r = parseTrackDef('{ roto')
    expect(r.def).toBeNull()
    expect(r.errors[0]!.code).toBe('json')
  })
})
