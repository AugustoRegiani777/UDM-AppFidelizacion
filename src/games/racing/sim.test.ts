// @vitest-environment node
import { TRACK_COUNT, TRACK_DEFS, trackAt } from './tracks.ts'
import { CAR_RADIUS, autopilot, createRace, playerOf, stepRace, type RaceState } from './sim.ts'

function drive(trackIndex: number, seed: number, skill: number, maxSeconds = 240): RaceState {
  const state = createRace(trackIndex, seed)
  for (let i = 0; i < maxSeconds * 60 && state.status !== 'finished'; i++) {
    stepRace(state, skill > 0 ? autopilot(state, skill) : { steer: 0, brake: false })
  }
  return state
}

describe('pistas', () => {
  it.each(TRACK_DEFS.map((d, i) => [d.id, i + 1] as const))(
    '%s: circuito cerrado y sin cruces',
    (_, index) => {
      const track = trackAt(index)
      expect(track.count).toBeGreaterThan(100)
      const gap = Math.hypot(
        track.xs[0]! - track.xs[track.count - 1]!,
        track.ys[0]! - track.ys[track.count - 1]!,
      )
      expect(gap).toBeLessThan(25)
      // Dos tramos lejanos del circuito nunca se pisan: queda lugar para el ancho de la pista.
      let minGap = Infinity
      for (let i = 0; i < track.count; i++) {
        for (let j = i + 1; j < track.count; j++) {
          const apart = Math.min(j - i, track.count - (j - i))
          if (apart < 30) continue
          minGap = Math.min(
            minGap,
            Math.hypot(track.xs[i]! - track.xs[j]!, track.ys[i]! - track.ys[j]!),
          )
        }
      }
      expect(minGap).toBeGreaterThan(track.def.width * 1.05)
    },
  )

  it('hay cinco pistas, cada una en un lugar distinto del local', () => {
    expect(TRACK_COUNT).toBe(5)
    expect(new Set(TRACK_DEFS.map((d) => d.scene)).size).toBe(5)
  })

  it.each(TRACK_DEFS.map((d, i) => [d.id, i + 1] as const))(
    '%s: los obstáculos dejan un corredor libre y no tapan la largada',
    (_, index) => {
      const track = trackAt(index)
      const corridor = CAR_RADIUS * 2 * 1.8
      for (const s of track.solids) {
        let near = Infinity
        for (let i = 0; i < track.count; i++) {
          near = Math.min(near, Math.hypot(s.x - track.xs[i]!, s.y - track.ys[i]!))
        }
        // Del eje al borde del obstáculo hay lugar de sobra para pasar por el otro lado.
        expect(track.half + near - s.r, `${s.kind}`).toBeGreaterThan(corridor)
        // Nada en la grilla de largada.
        for (let k = 0; k < 14; k++) {
          const i = (track.count - k) % track.count
          expect(Math.hypot(s.x - track.xs[i]!, s.y - track.ys[i]!)).toBeGreaterThan(s.r + 20)
        }
      }
      for (const sw of track.sweepers) {
        let near = Infinity
        for (let i = 0; i < track.count; i++) {
          near = Math.min(near, Math.hypot(sw.cx - track.xs[i]!, sw.cy - track.ys[i]!))
        }
        // Aun en lo más adentro que llega la hoja, queda lugar para pasar por el otro lado.
        expect(track.half + near - sw.orbit - sw.r).toBeGreaterThan(CAR_RADIUS * 3)
      }
    },
  )
})

describe('carrera', () => {
  it('la cuenta regresiva deja los autos quietos y después arranca', () => {
    const state = createRace(1, 5)
    for (let i = 0; i < 170; i++) stepRace(state, { steer: 0, brake: false })
    expect(state.status).toBe('countdown')
    expect(playerOf(state).progress).toBeLessThan(0)
    for (let i = 0; i < 20; i++) stepRace(state, { steer: 0, brake: false })
    expect(state.status).toBe('racing')
  })

  it('quedarse quieto no termina la carrera', () => {
    const state = drive(1, 7, 0, 60)
    expect(state.status).not.toBe('finished')
  })

  it.each([1, 2, 3, 4, 5])('un buen piloto completa la pista %i', (index) => {
    const state = drive(index, 11, 0.97)
    expect(state.status).toBe('finished')
    expect(state.position).toBeGreaterThanOrEqual(1)
    expect(state.position).toBeLessThanOrEqual(4)
  })

  it.each([1, 2, 3, 4, 5])('en la pista %i ningún rival se queda trabado', (index) => {
    const state = createRace(index, 21)
    for (let i = 0; i < 300 * 60 && state.status !== 'finished'; i++) {
      stepRace(state, autopilot(state, 0.97))
    }
    // Un rato más para que los rivales terminen.
    for (let i = 0; i < 40 * 60; i++) stepRace(state, { steer: 0, brake: false })
    const total = state.track.def.laps * state.track.length
    for (const car of state.cars) expect(car.progress).toBeGreaterThan(total * 0.85)
  })

  it('un charco frena: pasar por el dulce de leche tarda más que por el costado', () => {
    const state = createRace(4, 5)
    const car = playerOf(state)
    const zone = state.track.zones[0]!
    // Se lo pone sobre el charco, ubicado también en el eje (si no, la pista lo trae de vuelta a la largada).
    let nearest = 0
    for (let i = 0; i < state.track.count; i++) {
      const best = Math.hypot(zone.x - state.track.xs[i]!, zone.y - state.track.ys[i]!)
      if (best < Math.hypot(zone.x - state.track.xs[nearest]!, zone.y - state.track.ys[nearest]!))
        nearest = i
    }
    car.idx = nearest
    car.x = zone.x
    car.y = zone.y
    state.status = 'racing'
    stepRace(state, { steer: 0, brake: false })
    expect(car.inZone).toBe(true)
    car.x = zone.x + 90
    car.y = zone.y + 90
    stepRace(state, { steer: 0, brake: false })
    expect(car.inZone).toBe(false)
  })

  it('un obstáculo hace rebotar al auto en vez de atravesarlo', () => {
    const state = createRace(1, 5)
    const car = playerOf(state)
    const solid = state.track.solids[0]!
    state.status = 'racing'
    car.x = solid.x - solid.r
    car.y = solid.y
    car.vx = 200
    car.vy = 0
    stepRace(state, { steer: 0, brake: false })
    const d = Math.hypot(car.x - solid.x, car.y - solid.y)
    expect(d).toBeGreaterThanOrEqual(solid.r + CAR_RADIUS * 0.85 - 0.5)
  })

  it('manejar peor tarda más que manejar bien', () => {
    const good = drive(2, 3, 0.97)
    const slow = drive(2, 3, 0.7)
    expect(slow.raceTick).toBeGreaterThan(good.raceTick)
  })

  it('es reproducible con la misma semilla', () => {
    const a = drive(2, 99, 0.9)
    const b = drive(2, 99, 0.9)
    expect(a.raceTick).toBe(b.raceTick)
    expect(a.position).toBe(b.position)
  })

  it('un piloto casi perfecto gana más seguido en la pista fácil que en la difícil', () => {
    const seeds = [1, 2, 3, 4, 5, 6]
    const wins = (index: number) => seeds.filter((s) => drive(index, s, 1).position === 1).length
    expect(wins(1)).toBeGreaterThanOrEqual(wins(3))
  })
})
