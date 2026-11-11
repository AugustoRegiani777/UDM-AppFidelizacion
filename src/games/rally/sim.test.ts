import { afterEach, describe, expect, it } from 'vitest'
import { ZERO, setRandom, type Control } from './data.ts'
import { NOOP_HOOKS, RallySim, type Car } from './sim.ts'

const H = 0.0125
const SETTINGS = { car: 'chispa', laps: 3, rivals: 3, diff: 'normal' as const }

function race() {
  const sim = new RallySim(NOOP_HOOKS, SETTINGS)
  sim.startRace(false)
  sim.state = 'race'
  return { sim, car: sim.player! }
}
const run = (sim: RallySim, car: Car, ctrl: Control, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / H); i++) sim.stepCar(car, H, ctrl)
}
/** Pone al auto yendo a `speed` hacia adelante (y `side` de costado) en su dirección actual. */
function drive(car: Car, speed: number, side = 0) {
  const fx = Math.sin(car.heading)
  const fz = Math.cos(car.heading)
  car.vx = fx * speed + fz * side
  car.vz = fz * speed - fx * side
  car.vf = speed
}

afterEach(() => setRandom(null))

describe('física del auto', () => {
  it('acelerar sube la velocidad y no pasa la máxima del auto', () => {
    const { sim, car } = race()
    run(sim, car, { ...ZERO, throttle: 1 }, 1)
    const v1 = car.vf
    expect(v1).toBeGreaterThan(10)
    run(sim, car, { ...ZERO, throttle: 1 }, 1.5) // sigue por la recta de largada
    expect(car.vf).toBeGreaterThan(v1)
    expect(car.vf).toBeLessThanOrEqual(car.def.maxSpeed * 1.02)
  })

  it('frenar baja la velocidad y, ya detenido, mete marcha atrás', () => {
    const { sim, car } = race()
    drive(car, 20)
    run(sim, car, { ...ZERO, brake: 1 }, 0.35)
    expect(car.vf).toBeLessThan(10)
    run(sim, car, { ...ZERO, brake: 1 }, 2)
    expect(car.vf).toBeLessThan(0)
  })

  it('sin tocar nada el auto se va frenando solo', () => {
    const { sim, car } = race()
    drive(car, 20)
    run(sim, car, ZERO, 1)
    expect(car.vf).toBeGreaterThan(2)
    expect(car.vf).toBeLessThan(20)
  })

  it('el freno de mano reduce el agarre lateral (el auto sigue deslizando)', () => {
    const grip = race()
    const slide = race()
    drive(grip.car, 15, 3)
    drive(slide.car, 15, 3)
    run(grip.sim, grip.car, ZERO, 0.15)
    run(slide.sim, slide.car, { ...ZERO, handbrake: true }, 0.15)
    expect(Math.abs(slide.car.vl)).toBeGreaterThan(Math.abs(grip.car.vl) * 1.8)
  })

  it('doblar con el volante cambia el rumbo (steer > 0 gira a la izquierda)', () => {
    const { sim, car } = race()
    drive(car, 15)
    const h0 = car.heading
    run(sim, car, { ...ZERO, throttle: 1, steer: 1 }, 0.3)
    expect(car.heading).toBeGreaterThan(h0)
    const other = race()
    drive(other.car, 15)
    const h1 = other.car.heading
    run(other.sim, other.car, { ...ZERO, throttle: 1, steer: -1 }, 0.3)
    expect(other.car.heading).toBeLessThan(h1)
  })

  it('aturdido, el auto no responde al acelerador', () => {
    const { sim, car } = race()
    car.stun = 5
    run(sim, car, { ...ZERO, throttle: 1 }, 1)
    expect(Math.abs(car.vf)).toBeLessThan(1)
  })
})

describe('carrera e ítems', () => {
  it('la cuenta regresiva pasa a carrera y el jugador arranca al final de la parrilla', () => {
    const sim = new RallySim(NOOP_HOOKS, SETTINGS)
    sim.startRace(false)
    expect(sim.state).toBe('countdown')
    expect(sim.cars).toHaveLength(4)
    expect(sim.player!.pos).toBe(4)
    for (let i = 0; i < 60 * 4.2; i++) sim.update(1 / 60, ZERO)
    expect(sim.state).toBe('race')
  })

  it('el ítem solo se usa en carrera y se consume', () => {
    const { sim, car } = race()
    car.item = 'turbo'
    sim.tryUseItem()
    expect(car.turbo).toBeGreaterThan(2)
    expect(car.item).toBeNull()
    car.item = 'oil'
    sim.state = 'paused'
    sim.tryUseItem()
    expect(car.item).toBe('oil')
    sim.state = 'race'
    sim.tryUseItem()
    expect(sim.oils).toHaveLength(1)
  })

  it('un cohete sale y persigue; el aceite hace patinar', () => {
    const { sim, car } = race()
    car.item = 'rocket'
    sim.tryUseItem()
    expect(sim.rockets).toHaveLength(1)
    const rival = sim.cars.find((c) => !c.isPlayer)!
    sim.hitCar(rival, 'oil')
    expect(rival.slip).toBeGreaterThan(0)
    expect(rival.stun).toBeGreaterThan(0)
  })

  it('con el azar fijo, el sorteo de ítems es válido', () => {
    setRandom(() => 0.5)
    const { sim, car } = race()
    expect(['turbo', 'rocket', 'oil', 'pulse']).toContain(sim.rollItem(car))
  })
})

describe('IA', () => {
  it('los rivales dan vueltas a la pista sin quedarse trabados', () => {
    const sim = new RallySim(NOOP_HOOKS, SETTINGS)
    sim.startRace(true) // demo del menú: los 6 autos manejados por la IA
    expect(sim.cars).toHaveLength(6)
    for (let i = 0; i < 60 * 90; i++) sim.update(1 / 60, ZERO)
    for (const c of sim.cars) {
      expect(c.lapsDone, c.def.name).toBeGreaterThanOrEqual(2)
      expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true)
    }
  })

  it('en una carrera de 1 vuelta los rivales terminan y el jugador parado queda último', () => {
    const sim = new RallySim(NOOP_HOOKS, { ...SETTINGS, laps: 1, rivals: 2 })
    sim.startRace(false)
    for (let i = 0; i < 60 * 80; i++) sim.update(1 / 60, ZERO)
    const rivals = sim.cars.filter((c) => !c.isPlayer)
    expect(rivals.every((c) => c.finished)).toBe(true)
    expect(sim.player!.finished).toBe(false)
    expect(sim.player!.pos).toBe(3)
  })
})
