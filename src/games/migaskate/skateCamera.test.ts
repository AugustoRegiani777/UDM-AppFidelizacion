import {
  MAX_YAW_RATE,
  MAX_YAW_RATE_REDUCED,
  SkateCamera,
  smoothDamp,
  smoothDampAngle,
} from './skateCamera.ts'
import { v3 } from './vec.ts'

describe('SmoothDamp', () => {
  it('converge al objetivo sin pasarse', () => {
    const vel = { v: 0 }
    let x = 0
    let max = 0
    for (let i = 0; i < 240; i++) {
      x = smoothDamp(x, 10, vel, 0.3, 1000, 1 / 60)
      max = Math.max(max, x)
    }
    expect(x).toBeCloseTo(10, 3)
    expect(max).toBeLessThanOrEqual(10)
  })

  it('el tiempo de suavizado manda: con 0.1 llega antes que con 0.5', () => {
    const at = (smooth: number) => {
      const vel = { v: 0 }
      let x = 0
      for (let i = 0; i < 12; i++) x = smoothDamp(x, 1, vel, smooth, 1000, 1 / 60)
      return x
    }
    expect(at(0.1)).toBeGreaterThan(at(0.5))
  })

  it('respeta la velocidad maxima', () => {
    const vel = { v: 0 }
    let x = 0
    for (let i = 0; i < 60; i++) x = smoothDamp(x, 100, vel, 0.3, 2, 1 / 60)
    expect(x).toBeLessThan(2.2)
  })

  it('el angulo toma el camino corto (de 170 a -170 grados)', () => {
    const vel = { v: 0 }
    let a = (170 * Math.PI) / 180
    const target = (-170 * Math.PI) / 180
    for (let i = 0; i < 30; i++) {
      a = smoothDampAngle(a, target, vel, 0.2, 10, 1 / 60)
      expect(Math.abs(Math.cos(a) - Math.cos(target))).toBeLessThan(0.5)
    }
  })
})

describe('SkateCamera', () => {
  const target = (x: number, z: number, vx: number, vz: number, state = 'grounded') => ({
    position: v3(x, 0.1, z),
    velocity: v3(vx, 0, vz),
    state,
  })

  it('sigue la posicion de la tabla con retraso suave (no clava la tabla en el centro)', () => {
    const cam = new SkateCamera({ reduced: false, portrait: true })
    cam.update(1 / 60, target(0, 0, 0, 3))
    let pose = cam.update(1 / 60, target(0, 0.05, 0, 3))
    for (let i = 0; i < 6; i++) pose = cam.update(1 / 60, target(0, 0.05 + i * 0.05, 0, 3))
    const z = pose.lookAt.z
    // Va atras de la tabla un instante despues de moverse, pero se acerca.
    expect(z).toBeLessThan(1.6 + 0.3 + 0.1)
    for (let i = 0; i < 180; i++) pose = cam.update(1 / 60, target(0, 4, 0, 3))
    expect(pose.lookAt.z).toBeGreaterThan(4)
  })

  it('rota solo en Y hacia el vector velocidad: la altura de la camara no depende del rumbo', () => {
    const cam = new SkateCamera({ reduced: false, portrait: true })
    cam.update(1 / 60, target(0, 0, 0, 3))
    let yBefore = 0
    for (let i = 0; i < 120; i++) {
      const pose = cam.update(1 / 60, target(0, 0, 3, 0))
      if (i === 0) yBefore = pose.position.y
    }
    const pose = cam.update(1 / 60, target(0, 0, 3, 0))
    expect(cam.yaw).toBeCloseTo(Math.PI / 2, 1) // mira hacia +X
    expect(pose.position.y).toBeCloseTo(yBefore, 1)
  })

  it('no sigue la orientacion de la tabla: solo cuenta la velocidad (flips y shove-its no la marean)', () => {
    const cam = new SkateCamera({ reduced: false, portrait: true })
    cam.update(1 / 60, target(0, 0, 0, 3))
    for (let i = 0; i < 120; i++) cam.update(1 / 60, target(0, i * 0.05, 0, 3))
    expect(Math.abs(cam.yaw)).toBeLessThan(0.05)
  })

  it('limita la velocidad angular aunque la velocidad de la tabla cambie de golpe', () => {
    const fast = new SkateCamera({ reduced: false, portrait: true })
    const calm = new SkateCamera({ reduced: true, portrait: true })
    for (const cam of [fast, calm]) cam.update(1 / 60, target(0, 0, 0, 3))
    let maxFast = 0
    let maxCalm = 0
    for (let i = 0; i < 120; i++) {
      fast.update(1 / 60, target(0, 0, -3, -0.1)) // dar la vuelta
      calm.update(1 / 60, target(0, 0, -3, -0.1))
      maxFast = Math.max(maxFast, Math.abs(fast.yawRate))
      maxCalm = Math.max(maxCalm, Math.abs(calm.yawRate))
    }
    expect(maxFast).toBeLessThanOrEqual(MAX_YAW_RATE + 1e-6)
    expect(maxCalm).toBeLessThanOrEqual(MAX_YAW_RATE_REDUCED + 1e-6)
    expect(maxCalm).toBeLessThan(maxFast)
  })

  it('con movimiento reducido no hay sacudidas ni cambio de fov', () => {
    const calm = new SkateCamera({ reduced: true, portrait: true })
    calm.shake(0.4)
    const a = calm.update(1 / 60, target(0, 0, 0, 9))
    const b = calm.update(1 / 60, target(0, 0, 0, 9))
    expect(a.position.x).toBeCloseTo(b.position.x, 6)
    expect(a.fov).toBe(66)
    const lively = new SkateCamera({ reduced: false, portrait: true })
    expect(lively.update(1 / 60, target(0, 0, 0, 9)).fov).toBeGreaterThan(66)
  })

  it('la sacudida se apaga sola', () => {
    const cam = new SkateCamera({ reduced: false, portrait: true })
    cam.update(1 / 60, target(0, 0, 0, 3))
    cam.shake(0.5)
    let moved = 0
    let base = cam.update(1 / 60, target(0, 0, 0, 3)).position.x
    for (let i = 0; i < 90; i++) {
      const x = cam.update(1 / 60, target(0, 0, 0, 3)).position.x
      moved = Math.max(moved, Math.abs(x - base))
      base = x
    }
    const settled = cam.update(1 / 60, target(0, 0, 0, 3)).position.x
    expect(Math.abs(settled - base)).toBeLessThan(0.01)
    expect(moved).toBeGreaterThan(0)
  })
})
