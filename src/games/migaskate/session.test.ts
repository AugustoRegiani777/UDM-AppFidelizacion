import { objectiveDone, SkateSession, type SessionEvent } from './session.ts'
import { SPOTS, spotAt } from './spots.ts'
import { itemsFromLanding } from './tricks.ts'

function collect(session: SkateSession, seconds: number, out: SessionEvent[] = []) {
  const step = 1 / 60
  for (let t = 0; t < seconds; t += step) {
    session.update(step, { steer: 0, balance: 0 })
    out.push(...session.drain())
  }
  return out
}

const base = {
  roll: 0,
  yaw: 0,
  spin: 0,
  nollie: false,
  grab: null,
  popped: true,
  airTime: 0.6,
  height: 0.8,
}

describe('nombres de trucos', () => {
  it('un ollie liso, un kickflip, un heelflip doble y un 360 flip', () => {
    expect(itemsFromLanding(base).map((i) => i.key)).toEqual(['ollie'])
    expect(itemsFromLanding({ ...base, roll: 1 }).map((i) => i.key)).toEqual(['kickflip'])
    expect(itemsFromLanding({ ...base, roll: -2 }).map((i) => i.key)).toEqual(['doubleHeelflip'])
    expect(itemsFromLanding({ ...base, roll: 1, yaw: 2 }).map((i) => i.key)).toEqual(['flip360'])
    expect(itemsFromLanding({ ...base, roll: 1, yaw: -1 }).map((i) => i.key)).toEqual([
      'varialKickflip',
    ])
  })

  it('shove-its, giros del cuerpo y agarres suman trucos aparte', () => {
    expect(itemsFromLanding({ ...base, yaw: 1 })[0]?.key).toBe('shuvit')
    expect(itemsFromLanding({ ...base, yaw: -2 })[0]?.key).toBe('shuvit360')
    const keys = itemsFromLanding({ ...base, spin: 1, grab: 'indy' }).map((i) => i.key)
    expect(keys).toContain('spin180')
    expect(keys).toContain('indy')
  })

  it('el nollie vale mas y un salto de rampa sin trucos es solo "aire"', () => {
    const plain = itemsFromLanding({ ...base, roll: 1 })[0]!
    const nollie = itemsFromLanding({ ...base, roll: 1, nollie: true })[0]!
    expect(nollie.points).toBeGreaterThan(plain.points)
    expect(nollie.tags).toContain('nollie')
    const air = itemsFromLanding({ ...base, popped: false, height: 1.4 })
    expect(air.map((i) => i.key)).toEqual(['air'])
    expect(itemsFromLanding({ ...base, popped: false, height: 0.2, airTime: 0.2 })).toEqual([])
  })
})

describe('sesion de juego', () => {
  it('hay al menos 5 spots, cada uno con 3 objetivos y un mapa jugable', () => {
    expect(SPOTS.length).toBeGreaterThanOrEqual(5)
    for (const spot of SPOTS) {
      expect(spot.objectives).toHaveLength(3)
      expect(spot.seconds).toBeGreaterThanOrEqual(90)
    }
  })

  it('un ollie suma un truco al combo y el combo se cobra al rato', () => {
    const session = new SkateSession(spotAt(0))
    session.gesture({ k: 'ollie', power: 1, nollie: false })
    const events = collect(session, 1.2)
    expect(events.some((e) => e.t === 'trick' && e.item.key === 'ollie')).toBe(true)
    expect(session.stats.score).toBe(0)
    collect(session, 2, events)
    expect(events.some((e) => e.t === 'bank')).toBe(true)
    expect(session.stats.score).toBeGreaterThan(0)
    expect(session.stats.tags.ollie).toBe(1)
  })

  it('encadenar trucos sube el multiplicador', () => {
    const session = new SkateSession(spotAt(0))
    session.gesture({ k: 'ollie', power: 1, nollie: false })
    collect(session, 1.3)
    // Sin esperar el tiempo de gracia, otro salto con flip.
    session.gesture({ k: 'flip', power: 0.4, dir: 1 })
    session.gesture({ k: 'ollie', power: 1, nollie: false })
    collect(session, 1.3)
    expect(session.comboCount).toBe(2)
    expect(session.comboMult).toBeCloseTo(1.5)
  })

  it('una caida pierde el combo pero nunca resta del puntaje ya cobrado', () => {
    const session = new SkateSession(spotAt(0))
    session.stats.score = 500
    session.gesture({ k: 'flip', power: 1, dir: 1 })
    session.gesture({ k: 'ollie', power: 0, nollie: false })
    const events = collect(session, 2)
    expect(events.some((e) => e.t === 'bail')).toBe(true)
    expect(session.stats.score).toBe(500)
    expect(session.comboCount).toBe(0)
    expect(session.skater.mode).not.toBe('bail')
  })

  it('al terminar el tiempo la sesion se cierra y cobra lo que quedaba', () => {
    const session = new SkateSession(spotAt(0))
    session.gesture({ k: 'ollie', power: 1, nollie: false })
    collect(session, 1.2)
    session.finish()
    expect(session.finished).toBe(true)
    expect(session.stats.score).toBeGreaterThan(0)
    const events = session.drain()
    expect(events.some((e) => e.t === 'end')).toBe(true)
  })

  it('cada objetivo cumplido es una estrella', () => {
    const session = new SkateSession(spotAt(0))
    expect(session.stars).toBe(0)
    session.stats.tags.ollie = 3
    expect(objectiveDone(session.spot.objectives[0], session.stats)).toBe(true)
    expect(objectiveDone(session.spot.objectives[1], session.stats)).toBe(false)
  })

  it('el tiempo corre y se acaba', () => {
    const session = new SkateSession(spotAt(0))
    collect(session, session.spot.seconds + 1)
    expect(session.finished).toBe(true)
    expect(session.timeLeft).toBe(0)
  })
})
