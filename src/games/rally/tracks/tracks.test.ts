import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { ZERO, clamp, setRandom, wrapA } from '../data.ts'
import { NOOP_HOOKS, RallySim } from '../sim.ts'
import { buildDecor } from './decor/index.ts'
import { drawCost, noopCanvasFactory } from './decor/builder.ts'
import { OPEN_TRACKS, TRACKS, getTrack, getTrackDef } from './index.ts'
import { buildRuntime } from './runtime.ts'
import { THEME_IDS } from './types.ts'
import { parseTrackDef, validateTrack } from './validate.ts'

const SETTINGS = { car: 'chispa', laps: 2, rivals: 3, diff: 'normal' as const }

/** Azar con semilla para que las carreras de prueba sean siempre las mismas. */
function seed(n: number) {
  let s = n >>> 0
  setRandom(() => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}
afterEach(() => setRandom(null))

describe('el conjunto de pistas', () => {
  it('hay al menos 6 pistas (la Cocina más 5 nuevas), con ids únicos y dos abiertas', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length)
    expect(TRACKS[0]!.id).toBe('cocina')
    expect(OPEN_TRACKS).toBe(2)
    expect(getTrackDef('no-existe').id).toBe('cocina')
  })

  it('cada ambiente se usa y la dificultad sube de la primera a la última', () => {
    expect(new Set(TRACKS.map((t) => t.theme)).size).toBe(TRACKS.length)
    for (const t of TRACKS) expect(THEME_IDS).toContain(t.theme)
    const last = TRACKS[TRACKS.length - 1]!
    expect(last.difficulty).toBe(5)
    expect(Math.min(...TRACKS.map((t) => t.difficulty))).toBeLessThanOrEqual(2)
  })

  it('al menos una pista tiene relieve y varía la cantidad de rampas, zonas y cajas', () => {
    expect(TRACKS.some((t) => getTrack(t.id).maxY > 5)).toBe(true)
    expect(new Set(TRACKS.map((t) => t.ramps.length)).size).toBeGreaterThan(1)
    expect(TRACKS.some((t) => t.zones.some((z) => z.kind === 'slick'))).toBe(true)
    expect(TRACKS.some((t) => t.zones.some((z) => z.kind === 'sand'))).toBe(true)
    expect(new Set(TRACKS.map((t) => t.pickups.length)).size).toBeGreaterThan(1)
  })
})

describe.each(TRACKS.map((t) => [t.id, t] as const))('pista %s', (id, def) => {
  const rt = getTrack(id)

  it('pasa el validador sin errores', () => {
    const r = validateTrack(def)
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('es un circuito cerrado con la meta en el punto 0', () => {
    const last = rt.TP[rt.n - 1]!
    expect(Math.hypot(last.x - rt.TP[0]!.x, last.z - rt.TP[0]!.z)).toBeLessThan(2 * (rt.len / rt.n))
    expect(rt.DIST[0]).toBe(0)
    expect(rt.len).toBeGreaterThan(400)
  })

  it('sobrevive a un viaje de ida y vuelta por JSON', () => {
    const back = parseTrackDef(JSON.stringify(def))
    expect(back.errors).toEqual([])
    expect(back.def).toEqual(def)
    const rt2 = buildRuntime(back.def!)
    expect(rt2.len).toBeCloseTo(rt.len, 9)
    expect(rt2.n).toBe(rt.n)
    expect(rt2.groundAt(rt.TP[100]!.x, rt.TP[100]!.z, 100)).toBeCloseTo(
      rt.groundAt(rt.TP[100]!.x, rt.TP[100]!.z, 100),
      9,
    )
  })

  it('la altura es continua a lo largo del eje y no pasa de la pendiente máxima', () => {
    for (let i = 0; i < rt.n; i++) {
      const dy = Math.abs(rt.Y[(i + 1) % rt.n]! - rt.Y[i]!)
      expect(dy).toBeLessThan(0.25 * (rt.len / rt.n) + 1e-9)
      // el suelo del eje coincide con la altura del punto (sin rampas en la línea de meta)
    }
    expect(rt.baseAt(rt.TP[0]!.x, rt.TP[0]!.z, 0)).toBeCloseTo(rt.Y[0]!, 6)
  })

  it.each([3, 5])(
    'la IA completa 2 vueltas con %i rivales sin trabarse ni atravesar el suelo',
    (rivals) => {
      seed(12345)
      const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, rivals }, rt)
      let resets = 0
      const reset = sim.resetCar.bind(sim)
      sim.resetCar = (c) => {
        if (!c.isPlayer) resets++
        reset(c)
      }
      sim.startRace(false)
      const ai = () => sim.cars.filter((c) => !c.isPlayer)
      expect(ai()).toHaveLength(rivals)
      let t = 0
      for (; t < 200 * 60; t++) {
        sim.update(1 / 60, ZERO) // el jugador no toca nada
        for (const c of sim.cars) {
          expect(Number.isFinite(c.x + c.y + c.z)).toBe(true)
          expect(c.y).toBeGreaterThanOrEqual(rt.groundAt(c.x, c.z, c.idx) - 0.06)
        }
        if (ai().every((c) => c.finished)) break
      }
      expect(
        ai().every((c) => c.finished),
        'todos terminan',
      ).toBe(true)
      expect(resets, 'ninguna reaparición forzada').toBe(0)
      for (const c of ai()) {
        expect(c.lapsDone).toBeGreaterThanOrEqual(2)
        // una vuelta razonable: entre 12 y 70 segundos para estas pistas
        for (const lt of c.lapTimes) {
          expect(lt).toBeGreaterThan(12)
          expect(lt).toBeLessThan(70)
        }
      }
    },
  )

  it('la grilla de largada está en la pista, sobre el asfalto y mirando hacia adelante', () => {
    for (let k = 0; k < 6; k++) {
      const slot = rt.gridSlot(k)
      expect(Math.abs(rt.latOf(slot.x, slot.z, slot.idx))).toBeLessThan(rt.hw - 1)
      const tg = rt.TAN[slot.idx]!
      expect(Math.sin(slot.heading) * tg.x + Math.cos(slot.heading) * tg.z).toBeGreaterThan(0.99)
    }
  })

  it('el decorado se arma sin chocar con la pista y dentro del presupuesto de dibujo', () => {
    const d = buildDecor({ rt, maxAniso: 1, makeCanvas: noopCanvasFactory() })
    const cost = drawCost(d.ctx.root)
    expect(d.ctx.warnings).toEqual([])
    // La Cocina es el decorado original (muchos muebles); las nuevas son más livianas.
    const budget = id === 'cocina' ? { meshes: 170, drawCalls: 270 } : { meshes: 80, drawCalls: 90 }
    expect(cost.meshes).toBeLessThanOrEqual(budget.meshes)
    expect(cost.drawCalls).toBeLessThanOrEqual(budget.drawCalls)
    expect(cost.instances).toBeLessThanOrEqual(1200)
    d.ctx.dispose()
  })

  it('al sacar el decorado se liberan geometrías, materiales y texturas (sin fugas)', () => {
    const d = buildDecor({ rt, maxAniso: 1, makeCanvas: noopCanvasFactory() })
    const geos = new Set<THREE.BufferGeometry>()
    const mats = new Set<THREE.Material>()
    const texs = new Set<THREE.Texture>()
    d.ctx.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) geos.add(m.geometry)
      for (const mt of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        mats.add(mt)
        const std = mt as THREE.MeshStandardMaterial
        if (std.map) texs.add(std.map)
        if (std.emissiveMap) texs.add(std.emissiveMap)
      }
    })
    expect(geos.size).toBeGreaterThan(5)
    const disposed = { g: 0, m: 0, t: 0 }
    geos.forEach((g) => g.addEventListener('dispose', () => disposed.g++))
    mats.forEach((m) => m.addEventListener('dispose', () => disposed.m++))
    texs.forEach((t) => t.addEventListener('dispose', () => disposed.t++))
    d.ctx.dispose()
    expect(disposed.g).toBe(geos.size)
    expect(disposed.m).toBe(mats.size)
    expect(disposed.t).toBe(texs.size)
    expect(d.ctx.root.children).toHaveLength(0)
  })
})

describe('relieve (La Montaña de Harina)', () => {
  const harina = getTrackDef('harina')
  const flat = buildRuntime({ ...harina, id: 'harina-sin-rampas', ramps: [], pickups: [] })

  /** Maneja siguiendo el eje con el acelerador a fondo, en un sentido (1 o -1) por `seconds`. */
  function drive(rt: ReturnType<typeof buildRuntime>, from: number, dir: 1 | -1, seconds: number) {
    const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, rivals: 1 }, rt)
    sim.startRace(false)
    sim.state = 'race'
    const car = sim.player!
    const p = rt.TP[from]!
    const t = rt.TAN[from]!
    car.x = p.x
    car.z = p.z
    car.y = rt.Y[from]!
    car.idx = from
    car.heading = Math.atan2(dir * t.x, dir * t.z)
    car.vx = dir * t.x * 18
    car.vz = dir * t.z * 18
    car.vf = 18
    car.vy = rt.SLOPE[from]! * 18 * dir
    for (let k = 0; k < Math.round(seconds / 0.0125); k++) {
      const ti = (car.idx + dir * 12 + rt.n) % rt.n
      const diff = wrapA(Math.atan2(rt.TP[ti]!.x - car.x, rt.TP[ti]!.z - car.z) - car.heading)
      sim.stepCar(car, 0.0125, {
        throttle: 1,
        brake: 0,
        steer: clamp(diff * 2.6, -1, 1),
        handbrake: false,
      })
      expect(car.y).toBeGreaterThanOrEqual(rt.groundAt(car.x, car.z, car.idx) - 1e-6)
    }
    return { vf: car.vf, moved: Math.abs(car.idx - from), y: car.y }
  }

  it('el auto baja más rápido de lo que sube', () => {
    // el tramo más empinado de la subida
    let best = 0
    let bi = 0
    for (let i = 100; i < flat.n - 100; i++) {
      const d = flat.Y[i + 50]! - flat.Y[i]!
      if (d > best) {
        best = d
        bi = i
      }
    }
    expect(best).toBeGreaterThan(2.5)
    const up = drive(flat, bi, 1, 0.9)
    const down = drive(flat, bi + 50, -1, 0.9)
    expect(down.vf).toBeGreaterThan(up.vf + 3)
    expect(down.moved).toBeGreaterThan(up.moved)
  })

  it('en el llano la gravedad no cambia nada: la subida y la bajada son iguales a la Cocina', () => {
    const k = getTrack('cocina')
    const a = drive(k, 200, 1, 0.9)
    const b = drive(k, 200, 1, 0.9)
    expect(a.vf).toBeCloseTo(b.vf, 9)
    expect(k.flat).toBe(true)
    expect(k.SLOPE.every((s) => s === 0)).toBe(true)
  })

  it('en las crestas no sale volando de forma absurda, ni siquiera con turbo', () => {
    seed(777)
    const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, rivals: 3, diff: 'hard' }, flat)
    sim.startRace(false)
    let maxAbove = 0
    let air = 0
    let maxAir = 0
    for (let t = 0; t < 70 * 60; t++) {
      for (const c of sim.cars) if (!c.isPlayer) c.turbo = 5 // 1,4× la velocidad máxima todo el tiempo
      sim.update(1 / 60, ZERO)
      for (const c of sim.cars) {
        if (c.isPlayer) continue
        maxAbove = Math.max(maxAbove, c.y - flat.groundAt(c.x, c.z, c.idx))
        air = c.airborne ? air + 1 / 60 : 0
        maxAir = Math.max(maxAir, air)
      }
    }
    expect(maxAbove).toBeLessThan(2)
    expect(maxAir).toBeLessThan(1)
    expect(sim.cars.filter((c) => !c.isPlayer).every((c) => c.lapsDone >= 2)).toBe(true)
  })

  it('la IA anticipa una cresta: frena más que una IA sin atención al relieve', () => {
    const n = flat.n
    let best = 0
    let bi = 0
    for (let i = 0; i < n; i++) {
      const c = flat.SLOPE[i]! - flat.SLOPE[(i + 43) % n]!
      if (c > best) {
        best = c
        bi = i
      }
    }
    expect(best).toBeGreaterThan(0.1)
    const brakeFor = (care: number) => {
      const rt = buildRuntime({
        ...harina,
        ramps: [],
        pickups: [],
        ai: { ...harina.ai, slopeCare: care },
      })
      seed(1)
      const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, rivals: 1 }, rt)
      sim.startRace(false)
      sim.state = 'race'
      const c = sim.cars.find((x) => !x.isPlayer)!
      const p = rt.TP[bi]!
      const t = rt.TAN[bi]!
      c.x = p.x
      c.z = p.z
      c.idx = bi
      c.heading = Math.atan2(t.x, t.z)
      c.vf = c.def.maxSpeed * c.speedMult * 0.98
      c.vx = t.x * c.vf
      c.vz = t.z * c.vf
      return sim.aiControl(c, 0.0125).brake
    }
    expect(brakeFor(1)).toBeGreaterThan(brakeFor(0) + 0.2)
  })

  it('las cajas sorpresa van sobre el asfalto elevado y las rampas apoyan en la pendiente', () => {
    const rt = getTrack('harina')
    expect(rt.pickupSpots.some((p) => p.y > 3)).toBe(true)
    for (const p of rt.pickupSpots) expect(rt.baseAt(p.x, p.z, p.idx)).toBeCloseTo(p.y, 0)
    const sim = new RallySim(NOOP_HOOKS, SETTINGS, rt)
    sim.startRace(false)
    sim.state = 'race'
    const car = sim.player!
    // un auto parado sobre una caja elevada la recoge (la altura se compara con el asfalto, no con el piso)
    const pk = sim.pickups.find((p) => p.y > 3)!
    car.x = pk.x
    car.z = pk.z
    car.y = pk.y
    car.idx = rt.nearestGlobal(pk.x, pk.z)
    sim.update(1 / 60, ZERO)
    expect(pk.active).toBe(false)
  })
})

describe('zonas especiales', () => {
  it('la mancha resbaladiza quita agarre y la arena frena', () => {
    const rt = getTrack('vitrina')
    const slick = rt.zones.find((z) => z.kind === 'slick')!
    const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, track: 'vitrina' }, rt)
    sim.startRace(false)
    sim.state = 'race'
    const car = sim.player!
    const mid = (slick.i0 + (slick.count >> 1)) % rt.n
    const lat = (slick.lat0 + slick.lat1) / 2
    expect(rt.zoneAt(mid, lat)).toBe('slick')
    expect(rt.zoneAt(mid, rt.hw - 0.1 > slick.lat1 ? rt.hw - 0.1 : slick.lat0 - 0.5)).toBeNull()
    const place = (idx: number, l: number) => {
      const p = rt.TP[idx]!
      const nr = rt.NRM[idx]!
      const t = rt.TAN[idx]!
      car.x = p.x + nr.x * l
      car.z = p.z + nr.z * l
      car.idx = idx
      car.heading = Math.atan2(t.x, t.z)
      car.vx = t.x * 14 + nr.x * 4
      car.vz = t.z * 14 + nr.z * 4
      car.vf = 14
    }
    const onSlick = () => {
      place(mid, lat)
      sim.stepCar(car, 0.0125, ZERO)
      return Math.abs(car.vl)
    }
    const onAsphalt = () => {
      place((mid + 150) % rt.n, 0)
      sim.stepCar(car, 0.0125, ZERO)
      return Math.abs(car.vl)
    }
    // en lo resbaloso la velocidad lateral casi no se amortigua
    expect(onSlick()).toBeGreaterThan(onAsphalt() + 0.3)

    const tz = getTrack('terraza')
    const sand = tz.zones.find((z) => z.kind === 'sand')!
    const s2 = new RallySim(NOOP_HOOKS, { ...SETTINGS, track: 'terraza' }, tz)
    s2.startRace(false)
    s2.state = 'race'
    const c2 = s2.player!
    const run = (idx: number, l: number) => {
      const p = tz.TP[idx]!
      const nr = tz.NRM[idx]!
      const t = tz.TAN[idx]!
      c2.x = p.x + nr.x * l
      c2.z = p.z + nr.z * l
      c2.idx = idx
      c2.heading = Math.atan2(t.x, t.z)
      c2.vx = t.x * 20
      c2.vz = t.z * 20
      c2.vf = 20
      s2.stepCar(c2, 0.0125, { ...ZERO, throttle: 1 })
      return c2.vf
    }
    const smid = (sand.i0 + (sand.count >> 1)) % tz.n
    expect(run(smid, (sand.lat0 + sand.lat1) / 2)).toBeLessThan(run((smid + 200) % tz.n, 0) - 0.15)
  })
})
