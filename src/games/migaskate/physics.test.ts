import {
  applyGesture,
  createSkater,
  heightAt,
  profileHeight,
  quarterRun,
  STEP,
  stepSkater,
  type SimEvent,
  type Skater,
  type WorldDef,
} from './physics.ts'
import { SPOTS } from './spots.ts'

const FLAT: WorldDef = {
  halfX: 60,
  halfZ: 60,
  surfaces: [],
  rails: [],
  start: { x: 0, z: 0, heading: 0 },
}

function run(world: WorldDef, sk: Skater, seconds: number, steer = 0, events: SimEvent[] = []) {
  for (let t = 0; t < seconds; t += STEP) {
    events.push(...stepSkater(world, sk, { steer, balance: 0 }, STEP))
  }
  return events
}

describe('mapa de alturas', () => {
  it('rampa lineal, cuarto de pipa y escalones', () => {
    const ramp = { type: 'ramp', x: 0, z: 0, w: 4, d: 4, height: 1, dir: 'pz' } as const
    expect(profileHeight(ramp, 0)).toBe(0)
    expect(profileHeight(ramp, 2)).toBeCloseTo(0.5)
    expect(profileHeight(ramp, 4)).toBeCloseTo(1)
    const q = { type: 'quarter', x: 0, z: 0, w: 4, d: 8, height: 1.5, dir: 'pz' } as const
    expect(profileHeight(q, 0)).toBe(0)
    expect(profileHeight(q, quarterRun(1.5))).toBeCloseTo(1.5, 5)
    expect(profileHeight(q, 7)).toBe(1.5)
    const st = { type: 'stairs', x: 0, z: 0, w: 4, d: 5, height: 1.5, dir: 'pz', steps: 5 } as const
    expect(profileHeight(st, 0.1)).toBeCloseTo(0.3)
    expect(profileHeight(st, 4.9)).toBeCloseTo(1.5)
  })

  it('la altura es el maximo de las superficies que cubren el punto', () => {
    const world: WorldDef = {
      ...FLAT,
      surfaces: [
        { type: 'box', x: 0, z: 0, w: 4, d: 4, height: 0.5, dir: 'pz' },
        { type: 'box', x: 0, z: 0, w: 1, d: 1, height: 1.2, dir: 'pz' },
      ],
    }
    expect(heightAt(world, 0, 0)).toBe(1.2)
    expect(heightAt(world, 1.5, 0)).toBe(0.5)
    expect(heightAt(world, 5, 0)).toBe(0)
  })
})

describe('rodar y saltar', () => {
  it('rueda hacia adelante y dobla segun el dedo', () => {
    const sk = createSkater(FLAT)
    run(FLAT, sk, 1)
    expect(sk.z).toBeGreaterThan(2.5)
    const before = sk.heading
    run(FLAT, sk, 0.5, 1)
    expect(sk.heading).toBeLessThan(before)
  })

  it('el ollie mas fuerte salta mas alto y aterriza limpio', () => {
    const heights: number[] = []
    for (const power of [0.1, 1]) {
      const sk = createSkater(FLAT)
      applyGesture(sk, { k: 'ollie', power, nollie: false })
      expect(sk.mode).toBe('air')
      const events = run(FLAT, sk, 1.6)
      const land = events.find((e) => e.t === 'land')
      expect(land).toBeDefined()
      expect(sk.mode).toBe('ground')
      heights.push(land?.t === 'land' && land.trick ? land.trick.height : 0)
    }
    expect(heights[1]!).toBeGreaterThan(heights[0]! + 0.4)
  })

  it('no se puede saltar dos veces en el aire', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'ollie', power: 0.5, nollie: false })
    run(FLAT, sk, 0.3)
    const vy = sk.vy
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    expect(sk.vy).toBe(vy)
  })

  it('un salto pedido justo antes de aterrizar se aprovecha', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'ollie', power: 0.3, nollie: false })
    // Cae casi hasta el suelo y recien ahi pide otro.
    for (let i = 0; i < 400 && !(sk.vy < 0 && sk.y < 0.25); i++)
      stepSkater(FLAT, sk, { steer: 0, balance: 0 }, STEP)
    expect(sk.mode).toBe('air')
    applyGesture(sk, { k: 'ollie', power: 0.5, nollie: false })
    const events = run(FLAT, sk, 0.1)
    expect(events.filter((e) => e.t === 'pop')).toHaveLength(1)
  })
})

describe('trucos', () => {
  it('un kickflip fuerte con salto fuerte aterriza limpio y cuenta un giro completo', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'flip', power: 0.5, dir: 1 })
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    const events = run(FLAT, sk, 1.6)
    const land = events.find((e) => e.t === 'land')
    expect(land?.t === 'land' && land.trick?.roll).toBe(1)
    expect(events.some((e) => e.t === 'bail')).toBe(false)
  })

  it('el pop shove-it gira la tabla media vuelta hacia el lado del latigazo', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'popShuvit', power: 1, dir: -1, nollie: false })
    const events = run(FLAT, sk, 1.6)
    const land = events.find((e) => e.t === 'land')
    expect(land?.t === 'land' && land.trick?.yaw).toBe(-1)
  })

  it('un flip doble en un salto bajito no se completa: caida amable, no un error', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'flip', power: 1, dir: 1 })
    applyGesture(sk, { k: 'ollie', power: 0, nollie: false })
    const events = run(FLAT, sk, 1.6)
    expect(events.some((e) => e.t === 'bail')).toBe(true)
    expect(sk.mode).toBe('ground')
  })

  it('el giro del cuerpo en el aire queda registrado', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    run(FLAT, sk, 0.1)
    applyGesture(sk, { k: 'spin', power: 0.3, dir: 1 })
    const events = run(FLAT, sk, 1.6)
    const land = events.find((e) => e.t === 'land')
    expect(land?.t === 'land' && land.trick?.spin).toBe(1)
  })

  it('el agarre se suelta solo antes de caer y se registra', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    run(FLAT, sk, 0.1)
    applyGesture(sk, { k: 'grab', name: 'indy' })
    const events = run(FLAT, sk, 1.6)
    const land = events.find((e) => e.t === 'land')
    expect(land?.t === 'land' && land.trick?.grab).toBe('indy')
  })
})

describe('obstaculos', () => {
  it('una rampa te despega con la velocidad que traias', () => {
    const world: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'ramp', x: 0, z: 4, w: 4, d: 3.4, height: 0.9, dir: 'pz' }],
    }
    const sk = createSkater(world)
    sk.speed = 8
    let maxY = 0
    let wasAir = false
    for (let t = 0; t < 2.5; t += STEP) {
      stepSkater(world, sk, { steer: 0, balance: 0 }, STEP)
      maxY = Math.max(maxY, sk.y)
      if (sk.mode === 'air') wasAir = true
    }
    expect(wasAir).toBe(true)
    expect(maxY).toBeGreaterThan(0.9)
  })

  it('un cajon bajo de frente rebota pero con un ollie se sube', () => {
    const world: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'box', x: 0, z: 6, w: 4, d: 4, height: 0.4, dir: 'pz' }],
    }
    const blocked = createSkater(world)
    const events = run(world, blocked, 3)
    expect(events.some((e) => e.t === 'bump')).toBe(true)
    expect(blocked.z).toBeLessThan(4.2)

    const jumper = createSkater(world)
    jumper.z = 3.5
    applyGesture(jumper, { k: 'ollie', power: 1, nollie: false })
    run(world, jumper, 1)
    expect(jumper.z).toBeGreaterThan(4)
  })

  it('un riel se engancha en el aire alineado y sale al final', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 9, by: 0.5 }],
    }
    const sk = createSkater(world)
    sk.z = 1.5
    sk.speed = 4
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    const events = run(world, sk, 3)
    expect(events.some((e) => e.t === 'grindStart')).toBe(true)
    const end = events.find((e) => e.t === 'grindEnd')
    expect(end?.t === 'grindEnd' && end.seconds).toBeGreaterThan(0.5)
  })

  it('un riel perpendicular no te engancha', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: -4, az: 3, ay: 0.5, bx: 4, bz: 3, by: 0.5 }],
    }
    const sk = createSkater(world)
    sk.z = 1.5
    applyGesture(sk, { k: 'ollie', power: 1, nollie: false })
    const events = run(world, sk, 2)
    expect(events.some((e) => e.t === 'grindStart')).toBe(false)
  })

  it('el manual se mantiene con el dedo y se cae solo si te desequilibras', () => {
    const sk = createSkater(FLAT)
    applyGesture(sk, { k: 'manual', nose: false })
    expect(sk.manual).not.toBeNull()
    const events = run(FLAT, sk, 6)
    // Sin corregir el equilibrio, tarde o temprano se cae (con caida amable).
    expect(events.some((e) => e.t === 'bail')).toBe(true)
  })
})

describe('los spots', () => {
  it('todos los obstaculos y rieles caben en el mapa y el punto de salida esta libre', () => {
    for (const spot of SPOTS) {
      const { world } = spot
      expect(heightAt(world, world.start.x, world.start.z)).toBe(0)
      for (const s of world.surfaces) {
        expect(Math.abs(s.x) + s.w / 2).toBeLessThanOrEqual(world.halfX + 0.001)
        expect(Math.abs(s.z) + s.d / 2).toBeLessThanOrEqual(world.halfZ + 0.001)
      }
      for (const r of world.rails) {
        expect(Math.max(Math.abs(r.ax), Math.abs(r.bx))).toBeLessThanOrEqual(world.halfX)
        expect(Math.max(Math.abs(r.az), Math.abs(r.bz))).toBeLessThanOrEqual(world.halfZ)
      }
    }
  })
})
