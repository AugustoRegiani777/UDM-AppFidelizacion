import { SkateJuice, type JuiceSinks } from './juice.ts'
import { SkatePhysics, STEP } from './skatePhysics.ts'
import type { WorldDef } from './world.ts'

const FLAT: WorldDef = {
  halfX: 80,
  halfZ: 80,
  surfaces: [],
  rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 12, by: 0.5 }],
  start: { x: 0, z: 0, heading: 0 },
}

function sinks() {
  const calls: Record<string, unknown[][]> = {}
  const spy =
    (name: string) =>
    (...args: unknown[]) => {
      ;(calls[name] ??= []).push(args)
    }
  const s: JuiceSinks = {
    sfx: {
      pop: spy('pop'),
      land: spy('land'),
      flip: spy('flip'),
      grind: spy('grind'),
      grindLoop: spy('grindLoop'),
      grab: spy('grab'),
      bump: spy('bump'),
      bail: spy('bail'),
      push: spy('push'),
      catch: spy('catch'),
    },
    haptic: spy('haptic'),
    particles: { burst: spy('burst'), trail: spy('trail') },
    shake: spy('shake'),
    hitStop: spy('hitStop'),
  }
  return { s, calls }
}

function settled() {
  const p = new SkatePhysics(FLAT)
  p.placeFlat(0, 0, Math.PI / 2, 3.2)
  for (let i = 0; i < 60; i++) p.step()
  return p
}

const run = (p: SkatePhysics, seconds: number) => {
  for (let t = 0; t < seconds; t += STEP) p.step()
}

describe('SkateJuice: game feel conectado a los hooks de la fisica', () => {
  it('OnPop: sonido, haptica, estiramiento de la mascota y polvo', () => {
    const p = settled()
    const { s, calls } = sinks()
    const juice = new SkateJuice(p, s, { reduced: false })
    p.applyGesture({ k: 'ollie', power: 0.8, nollie: false })
    expect(calls.pop).toHaveLength(1)
    expect(calls.pop![0]![0]).toBe(0.8)
    expect(calls.haptic).toBeDefined()
    expect(juice.squash).toBeGreaterThan(0.3) // estira
    expect(calls.burst![0]![0]).toMatchObject({ kind: 'dust' })
  })

  it('OnLand: sonido segun el impacto, polvo, aplastamiento y vibracion', () => {
    const p = settled()
    const { s, calls } = sinks()
    const juice = new SkateJuice(p, s, { reduced: false })
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    run(p, 1.6)
    expect(calls.land).toHaveLength(1)
    const [intensity, sloppy] = calls.land![0]!
    expect(intensity as number).toBeGreaterThan(0.3)
    expect(sloppy).toBe(false)
    const dust = calls.burst!.filter((c) => (c[0] as { kind: string }).kind === 'dust')
    expect(dust.length).toBeGreaterThanOrEqual(2)
    void juice
  })

  it('un aterrizaje muy fuerte congela un instante (hit-stop) y sacude la camara; con movimiento reducido no', () => {
    const run1 = (reduced: boolean) => {
      const p = settled()
      const { s, calls } = sinks()
      new SkateJuice(p, s, { reduced })
      p.body.setPose({ x: 0, y: 4, z: 0 }, p.body.rotation)
      p.machine.reset('airborne')
      p.body.velocity = { x: 0, y: -14, z: 0 }
      run(p, 1)
      return calls
    }
    const lively = run1(false)
    expect(lively.hitStop?.[0]?.[0]).toBeGreaterThan(0)
    expect(lively.shake).toBeDefined()
    const calm = run1(true)
    expect(calm.hitStop).toBeUndefined()
  })

  it('OnGrindStart y OnGrindStay: chispas, raspado y desgaste del riel', () => {
    const p = new SkatePhysics(FLAT)
    p.placeFlat(0, 1.5, 0, 4)
    const { s, calls } = sinks()
    const juice = new SkateJuice(p, s, { reduced: false })
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    run(p, 3)
    expect(calls.grind).toHaveLength(1)
    const sparks = calls.burst!.filter((c) => (c[0] as { kind: string }).kind === 'spark')
    expect(sparks.length).toBeGreaterThan(5)
    expect(calls.grindLoop!.length).toBeGreaterThan(3)
    expect(juice.railWear[0]).toBeGreaterThan(0.1)
    // Sin patinar encima, el desgaste vuelve a enfriarse.
    const before = juice.railWear[0]!
    const view = p.view(1)
    for (let i = 0; i < 60; i++) juice.update(1 / 60, view)
    expect(juice.railWear[0]).toBeLessThan(before)
  })

  it('el squash/stretch se apaga solo', () => {
    const p = settled()
    const { s } = sinks()
    const juice = new SkateJuice(p, s, { reduced: false })
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    const view = p.view(1)
    for (let i = 0; i < 120; i++) juice.update(1 / 60, view)
    expect(juice.squash).toBe(0)
  })

  it('con movimiento reducido no hay squash ni estela', () => {
    const p = settled()
    const { s, calls } = sinks()
    const juice = new SkateJuice(p, s, { reduced: true })
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    p.applyGesture({ k: 'flip', power: 1, dir: 1 })
    expect(juice.squash).toBe(0)
    for (let i = 0; i < 30; i++) {
      p.step()
      juice.update(1 / 60, p.view(1))
    }
    expect(calls.trail).toBeUndefined()
  })

  it('dispose corta las suscripciones', () => {
    const p = settled()
    const { s, calls } = sinks()
    const juice = new SkateJuice(p, s, { reduced: false })
    juice.dispose()
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    expect(calls.pop).toBeUndefined()
  })
})
