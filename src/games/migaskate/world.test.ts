import { SPOTS } from './spots.ts'
import {
  closestOnRail,
  groundNormal,
  heightAt,
  profileHeight,
  profileSlope,
  quarterRun,
  raycastDown,
  wallPush,
  type WorldDef,
} from './world.ts'

const FLAT: WorldDef = {
  halfX: 60,
  halfZ: 60,
  surfaces: [],
  rails: [],
  start: { x: 0, z: 0, heading: 0 },
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

describe('raycast vertical y normales', () => {
  const ramp = { type: 'ramp', x: 0, z: 0, w: 4, d: 4, height: 1, dir: 'pz' } as const
  const world: WorldDef = { ...FLAT, surfaces: [ramp] }

  it('la normal de una rampa es perpendicular a su pendiente y apunta hacia arriba y atras', () => {
    const hit = raycastDown(world, 0, 5, 0, 10)!
    const slope = profileSlope(ramp, 2)
    expect(slope).toBeCloseTo(0.25)
    expect(hit.y).toBeCloseTo(0.5)
    expect(hit.nz).toBeCloseTo(-slope / Math.hypot(1, slope), 6)
    expect(hit.ny).toBeCloseTo(1 / Math.hypot(1, slope), 6)
    expect(Math.hypot(hit.nx, hit.ny, hit.nz)).toBeCloseTo(1, 9)
  })

  it('el piso tiene normal (0, 1, 0) y un rayo desde abajo del piso no pega', () => {
    expect(raycastDown(FLAT, 3, 1, 3, 5)).toMatchObject({ y: 0, ny: 1, surface: -1 })
    expect(raycastDown(FLAT, 3, -0.5, 3, 5)).toBeNull()
  })

  it('un rayo respeta el alcance maximo', () => {
    expect(raycastDown(FLAT, 0, 0.5, 0, 0.3)).toBeNull()
    expect(raycastDown(FLAT, 0, 0.5, 0, 0.6)).not.toBeNull()
  })

  it('un techo por encima del origen del rayo se ignora (de costado se choca contra la pared)', () => {
    const box: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'box', x: 0, z: 0, w: 2, d: 2, height: 1, dir: 'pz' }],
    }
    expect(raycastDown(box, 0, 0.5, 0, 2)).toMatchObject({ y: 0, surface: -1 })
    expect(raycastDown(box, 0, 1.4, 0, 2)).toMatchObject({ y: 1, surface: 0 })
  })

  it('la normal del cuarto de pipa se parece mas a una pared cuanto mas arriba', () => {
    const q: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'quarter', x: 0, z: 5, w: 6, d: 8, height: 1.5, dir: 'pz' }],
    }
    const low = groundNormal(q, 0, 1.2)
    const high = groundNormal(q, 0, 1.2 + quarterRun(1.5) - 0.3)
    expect(high.y).toBeLessThan(low.y)
    expect(high.z).toBeLessThan(low.z)
  })

  it('los escalones tienen normal arriba en cada escalon', () => {
    const st: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'stairs', x: 0, z: 0, w: 4, d: 5, height: 1.5, dir: 'pz', steps: 5 }],
    }
    const n = groundNormal(st, 0, 0.5)
    expect(n.y).toBeCloseTo(1)
  })
})

describe('paredes y rieles', () => {
  it('un punto metido en un cajon recibe la normal horizontal hacia afuera y la profundidad', () => {
    const box: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'box', x: 0, z: 5, w: 4, d: 2, height: 0.5, dir: 'pz' }],
    }
    const push = wallPush(box, 0, 4.1, 0.05, 0, { x: 0, z: 1 })!
    expect(push.nz).toBeLessThan(-0.9)
    expect(push.depth).toBeGreaterThan(0.05)
    expect(wallPush(box, 0, 2, 0.05, 0, { x: 0, z: 1 })).toBeNull()
    // Por encima del cajon no es pared.
    expect(wallPush(box, 0, 5, 0.6, 0, { x: 0, z: 1 })).toBeNull()
    // El piso solo no cuenta como pared.
    expect(wallPush(FLAT, 0, 0, -0.1, 0, { x: 0, z: 1 })).toBeNull()
  })

  it('el punto mas cercano de un riel y su distancia lateral', () => {
    const r = { ax: 0, az: 0, ay: 0.5, bx: 0, bz: 10, by: 1 }
    const c = closestOnRail(r, 0.3, 4)
    expect(c.t).toBeCloseTo(0.4)
    expect(c.y).toBeCloseTo(0.7)
    expect(c.lateral).toBeCloseTo(0.3)
    expect(c.uz).toBeCloseTo(1)
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

  it('hay un spot con piscina (bowl) y un riel largo', () => {
    const bowl = SPOTS.find((s) => s.id === 'bowl')!
    expect(bowl.world.surfaces.filter((s) => s.type === 'quarter').length).toBeGreaterThanOrEqual(4)
    const longest = Math.max(
      ...SPOTS.flatMap((s) => s.world.rails.map((r) => Math.hypot(r.bx - r.ax, r.bz - r.az))),
    )
    expect(longest).toBeGreaterThanOrEqual(9)
    expect(bowl.world.rails.some((r) => Math.hypot(r.bx - r.ax, r.bz - r.az) >= 9)).toBe(true)
  })
})
