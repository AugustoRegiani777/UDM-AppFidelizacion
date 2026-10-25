// @vitest-environment node
import {
  buildPark,
  createPark,
  groundAt,
  LEVEL_COUNT,
  LEVELS,
  RAIL_HEIGHT,
  starsFor,
  stepPark,
  type ParkInput,
  type ParkState,
} from './sim.ts'
import { playWithBot } from './testing.ts'

const NONE: ParkInput = { stick: 0, right: false }

/** Parque vacío salvo lo que se le ponga (para probar una cosa por vez). */
function emptyPark(obstacles: ParkState['obstacles'] = []): ParkState {
  const s = createPark(1, 1)
  s.obstacles = [...obstacles]
  s.speedFactor = 1
  return s
}

function run(s: ParkState, ticks: number, input: ParkInput | ((s: ParkState) => ParkInput) = NONE) {
  for (let i = 0; i < ticks && s.status === 'playing'; i++) {
    stepPark(s, typeof input === 'function' ? input(s) : input)
  }
}

/** Salta (carga `charge` ticks) y devuelve el estado ya en el aire. */
function jump(s: ParkState, charge = 6) {
  for (let i = 0; i < charge; i++) stepPark(s, { stick: 0, right: true })
  stepPark(s, NONE)
}

describe('parque', () => {
  it('es reproducible con la misma semilla y distinto con otra', () => {
    expect(buildPark(2, 7).obstacles).toEqual(buildPark(2, 7).obstacles)
    expect(buildPark(2, 7).obstacles).not.toEqual(buildPark(2, 8).obstacles)
  })

  it('tiene obstáculos ordenados, sin pisarse y con lugar para respirar', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const { obstacles } = buildPark(level, 5)
      expect(obstacles.length).toBeGreaterThan(10)
      for (let i = 1; i < obstacles.length; i++) {
        const a = obstacles[i - 1]!
        expect(obstacles[i]!.x).toBeGreaterThan(a.x + a.w + 200)
      }
    }
  })

  it('la altura del suelo: rampa que sube, cajón y pozo', () => {
    const obs = [
      { kind: 'ramp', x: 100, w: 100, h: 32 },
      { kind: 'box', x: 400, w: 150, h: 24 },
      { kind: 'gap', x: 800, w: 100, h: 0 },
    ] as const
    expect(groundAt(obs, 50)).toBe(0)
    expect(groundAt(obs, 150)).toBeGreaterThan(5)
    expect(groundAt(obs, 200)).toBeCloseTo(32, 5)
    expect(groundAt(obs, 205)).toBe(0)
    expect(groundAt(obs, 450)).toBe(24)
    expect(groundAt(obs, 850)).toBe(-Infinity)
  })

  it('los niveles son cada vez más exigentes', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.target).toBeGreaterThan(LEVELS[i - 1]!.target)
      expect(LEVELS[i]!.cruise).toBeGreaterThan(LEVELS[i - 1]!.cruise)
    }
  })

  it('las estrellas salen del puntaje', () => {
    const target = LEVELS[0]!.target
    expect(starsFor(0, 1)).toBe(0)
    expect(starsFor(target, 1)).toBe(1)
    expect(starsFor(target * 1.8, 1)).toBe(2)
    expect(starsFor(target * 3, 1)).toBe(3)
  })
})

describe('trucos y combos', () => {
  it('un salto limpio con un truco cobra puntos al aterrizar', () => {
    const s = emptyPark()
    jump(s, 8)
    run(s, 8)
    // Toque corto del derecho en el aire = kickflip.
    stepPark(s, { stick: 0, right: true })
    stepPark(s, { stick: 0, right: true })
    stepPark(s, NONE)
    run(s, 120)
    expect(s.mode).toBe('roll')
    expect(s.score).toBeGreaterThanOrEqual(80)
    expect(s.landed).toBeGreaterThanOrEqual(1)
  })

  it('caer con el truco a medias es una caída y se pierde el combo', () => {
    const s = emptyPark()
    jump(s, 1)
    run(s, 10)
    // Truco difícil (tre flip) tarde, con poco aire: no llega a completarlo.
    stepPark(s, { stick: 8, right: true })
    stepPark(s, { stick: 8, right: false })
    run(s, 80)
    expect(s.bails).toBe(1)
    expect(s.score).toBe(0)
  })

  it('aterrizar de costado (giro a medias) es una caída', () => {
    const s = emptyPark()
    jump(s, 18)
    for (let i = 0; i < 18; i++) stepPark(s, { stick: 1, right: false }) // gira ~160° y suelta
    run(s, 4)
    // Frena el giro cerca de 90°: ni de frente ni de espaldas.
    s.spin = 95
    run(s, 80)
    expect(s.bails).toBe(1)
  })

  it('girar 180 y aterrizar limpio suma el giro', () => {
    const s = emptyPark()
    jump(s, 18)
    run(s, 2)
    s.spin = 178
    run(s, 80)
    expect(s.bails).toBe(0)
    expect(s.score).toBeGreaterThanOrEqual(90)
  })

  it('el multiplicador sube con cada truco distinto y repetirlo vale poco', () => {
    const s = emptyPark()
    s.mode = 'air'
    s.y = 40
    s.vy = 0
    s.combo = { points: 0, mult: 1, names: [] }
    // Dos trucos distintos en el mismo salto.
    s.flip = { kind: 'kickflip', t: 37, ticks: 38, points: 80 }
    run(s, 2)
    s.flip = { kind: 'heelflip', t: 37, ticks: 38, points: 80 }
    run(s, 2)
    expect(s.combo.mult).toBe(2)
    const before = s.combo.points
    s.flip = { kind: 'kickflip', t: 37, ticks: 38, points: 80 }
    run(s, 2)
    expect(s.combo.mult).toBe(2)
    expect(s.combo.points - before).toBe(Math.round(80 * 0.4))
  })

  it('un agarre se cobra al soltarlo, pero aterrizar agarrado es una caída', () => {
    const ok = emptyPark()
    jump(ok, 18)
    run(ok, 2)
    for (let i = 0; i < 20; i++) stepPark(ok, { stick: 0, right: true })
    run(ok, 1, NONE)
    run(ok, 90)
    expect(ok.bails).toBe(0)
    expect(ok.score).toBeGreaterThan(40)

    const bad = emptyPark()
    jump(bad, 6)
    run(bad, 2)
    for (let i = 0; i < 80 && bad.mode === 'air'; i++) stepPark(bad, { stick: 0, right: true })
    run(bad, 5, { stick: 0, right: true })
    expect(bad.bails).toBe(1)
  })
})

describe('obstáculos', () => {
  it('chocar de frente con un cajón es una caída', () => {
    const s = emptyPark([{ kind: 'box', x: 200, w: 150, h: 24 }])
    for (let i = 0; i < 200 && s.bails === 0; i++) stepPark(s, NONE)
    expect(s.bails).toBe(1)
    expect(s.bailReason).toBe('wall')
  })

  it('saltar el cajón y rodar encima es válido', () => {
    const s = emptyPark([{ kind: 'box', x: 220, w: 220, h: 24 }])
    s.x = 130
    run(s, 4)
    let guard = 0
    // Saltar cuando faltan ~50 unidades.
    while (s.x < 165 && guard++ < 200) stepPark(s, NONE)
    jump(s, 8)
    run(s, 260)
    expect(s.bails).toBe(0)
  })

  it('caer en un pozo es una caída y vuelve a apoyarse más adelante', () => {
    const s = emptyPark([{ kind: 'gap', x: 200, w: 110, h: 0 }])
    run(s, 160)
    expect(s.bails).toBe(1)
    expect(s.x).toBeGreaterThan(310)
  })

  it('saltar un pozo suma el bonus de gap', () => {
    const s = emptyPark([{ kind: 'gap', x: 260, w: 100, h: 0 }])
    s.x = 190
    for (let i = 0; i < 18; i++) stepPark(s, { stick: 0, right: true })
    stepPark(s, NONE)
    run(s, 160)
    expect(s.bails).toBe(0)
    expect(s.score).toBeGreaterThanOrEqual(150)
  })

  it('caer sobre un riel con la tabla derecha agarra el grind y avanza solo hasta el final', () => {
    const rail = { kind: 'rail', x: 100, w: 600, h: RAIL_HEIGHT } as const
    const s = emptyPark([rail])
    s.mode = 'air'
    s.x = 130
    s.y = 40
    s.vy = 0
    run(s, 10)
    expect(s.mode).toBe('grind')
    // Sin equilibrio que cuidar: no hace falta tocar nada y nunca se cae del riel.
    run(s, 400)
    expect(s.bails).toBe(0)
    expect(s.mode).not.toBe('grind')
    expect(s.score).toBeGreaterThan(60)
  })

  it('caer sobre el riel de costado (giro a medias) sigue siendo una caída', () => {
    const rail = { kind: 'rail', x: 100, w: 300, h: RAIL_HEIGHT } as const
    const s = emptyPark([rail])
    s.mode = 'air'
    s.x = 130
    s.y = 40
    s.vy = 0
    s.spin = 45
    run(s, 10)
    expect(s.bails).toBe(1)
    expect(s.bailReason).toBe('grind')
  })

  it('un giro de 90° al caer sobre el riel hace boardslide (vale más que el 50-50)', () => {
    const rail = { kind: 'rail', x: 100, w: 220, h: RAIL_HEIGHT } as const
    const a = emptyPark([rail])
    a.mode = 'air'
    a.x = 118
    a.y = 40
    a.vy = 0
    a.spin = 90
    run(a, 6)
    expect(a.grind?.kind).toBe('boardslide')
    const b = emptyPark([rail])
    b.mode = 'air'
    b.x = 118
    b.y = 40
    b.vy = 0
    run(b, 6)
    expect(b.grind?.kind).toBe('5050')
  })
})

describe('turbo', () => {
  const HOLD: ParkInput = { stick: 1, right: false }

  it('con el pulgar izquierdo apretado en el suelo se avanza más rápido', () => {
    const slow = emptyPark()
    const fast = emptyPark()
    run(slow, 90)
    run(fast, 90, HOLD)
    expect(fast.turboOn).toBe(true)
    expect(fast.x).toBeGreaterThan(slow.x * 1.25)
  })

  it('gasta energía, se vacía y se bloquea hasta recargar un poco', () => {
    const s = emptyPark()
    run(s, 200, HOLD)
    expect(s.turboLock).toBe(true)
    expect(s.turbo).toBeLessThan(0.25)
    expect(s.turboOn).toBe(false)
    // Aunque siga apretando, no vuelve a prender enseguida.
    run(s, 20, HOLD)
    expect(s.turboOn).toBe(false)
    // Soltando se recarga y se desbloquea.
    run(s, 200)
    expect(s.turbo).toBeGreaterThan(0.4)
    run(s, 2, HOLD)
    expect(s.turboOn).toBe(true)
  })

  it('en el aire el pulgar izquierdo no da turbo (sirve para girar), pero la velocidad ganada se conserva un rato', () => {
    const s = emptyPark()
    run(s, 80, HOLD)
    const boosted = s.speedMul
    expect(boosted).toBeGreaterThan(1.3)
    jump(s, 8)
    run(s, 20, HOLD)
    expect(s.mode).toBe('air')
    expect(s.turboOn).toBe(false)
    // Decae despacio: a los 20 ticks sigue bien por encima de la velocidad normal.
    expect(s.speedMul).toBeGreaterThan(1.15)
    expect(s.speedMul).toBeLessThan(boosted)
  })

  it('un combo bien aterrizado devuelve energía', () => {
    const s = emptyPark()
    s.turbo = 0.3
    s.mode = 'air'
    s.y = 30
    s.vy = 0
    s.combo = { points: 100, mult: 2, names: ['Kickflip'] }
    run(s, 60)
    expect(s.score).toBeGreaterThan(0)
    expect(s.turbo).toBeGreaterThan(0.5)
  })

  it('el turbo trae el cartel TURBO en el aviso del juego', () => {
    const s = emptyPark()
    stepPark(s, HOLD)
    expect(s.events.some((e) => e.t === 'turbo')).toBe(true)
  })
})

describe('balance', { timeout: 120_000 }, () => {
  const seeds = [1, 2, 3, 4, 5, 6]

  it('quedarse quieto no suma casi nada y se choca', () => {
    for (const level of [1, 3, 5]) {
      const runs = seeds.map((seed) => playWithBot(level, seed, { skill: 0, tricks: false }))
      for (const r of runs) {
        expect(r.score).toBeLessThan(LEVELS[level - 1]!.target)
        expect(r.bails).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('un jugador que salta y hace trucos saca estrellas en el primer nivel', () => {
    const runs = seeds.map((seed) => playWithBot(1, seed, { skill: 1, tricks: true }))
    const average = runs.reduce((sum, r) => sum + r.score, 0) / runs.length
    expect(average).toBeGreaterThan(LEVELS[0]!.target)
  })

  it('hacer trucos rinde más que solo saltar', () => {
    const total = (tricks: boolean) =>
      seeds.reduce((sum, seed) => sum + playWithBot(2, seed, { skill: 1, tricks }).score, 0)
    expect(total(true)).toBeGreaterThan(total(false))
  })
})
