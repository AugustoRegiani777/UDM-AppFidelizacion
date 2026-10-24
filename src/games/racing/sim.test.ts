// @vitest-environment node
import { TRACK_COUNT, TRACK_DEFS, trackAt } from './tracks.ts'
import { autopilot, createRace, playerOf, stepRace, type RaceState } from './sim.ts'

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

  it('hay tres pistas', () => {
    expect(TRACK_COUNT).toBe(3)
  })
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

  it.each([1, 2, 3])('un buen piloto completa la pista %i', (index) => {
    const state = drive(index, 11, 0.97)
    expect(state.status).toBe('finished')
    expect(state.position).toBeGreaterThanOrEqual(1)
    expect(state.position).toBeLessThanOrEqual(4)
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
