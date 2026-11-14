// @vitest-environment node
import {
  ANT_COOLDOWN,
  ANT_HIT_RADIUS,
  ANT_MIN_SEP,
  ANT_WARNING,
  FIELD_W,
  HIT_RADIUS,
  ITEM_RADIUS,
  antRamp,
  createGame,
  distSqToSegment,
  endStroke,
  goalProgress,
  resultOf,
  slash,
  starsOf,
  stepGame,
  type GameState,
  type Item,
} from './engine.ts'
import { LEVELS, LEVEL_COUNT, levelAt, type LevelDef } from './levels.ts'

/** Un jugador de prueba: corta cada objeto bueno con cierta probabilidad y esquiva las hormigas. */
function play(level: LevelDef, seed: number, skill: number, maxSeconds = 200): GameState {
  const s = createGame(level, seed)
  const cutAt = new Set<number>()
  const decided = new Set<number>()
  let luck = seed * 7919 + 13
  const roll = () => {
    luck = (Math.imul(luck, 1103515245) + 12345) | 0
    return ((luck >>> 8) & 0xffff) / 0x10000
  }
  for (let i = 0; i < maxSeconds * 60 && s.status === 'playing'; i++) {
    stepGame(s)
    s.events.length = 0
    for (const item of s.items) {
      if (!item.active || item.kind === 'ant' || cutAt.has(item.id)) continue
      if (item.y > s.height * 0.8 || item.vy < -s.height * 0.35) continue
      if (!decided.has(item.id)) {
        decided.add(item.id)
        if (roll() > skill) cutAt.add(item.id)
      }
      if (cutAt.has(item.id)) continue
      const r = ITEM_RADIUS * 1.4
      const dirs = [
        [1, 1],
        [1, -1],
        [1, 0],
        [0, 1],
      ] as const
      const safe = dirs.find(([dx, dy]) => {
        const [x0, y0, x1, y1] = [
          item.x - dx * r,
          item.y - dy * r,
          item.x + dx * r,
          item.y + dy * r,
        ]
        return !s.items.some(
          (o) =>
            o.active &&
            o.kind === 'ant' &&
            distSqToSegment(o.x, o.y, x0, y0, x1, y1) < (ITEM_RADIUS * 1.2) ** 2,
        )
      })
      if (!safe) continue
      slash(
        s,
        item.x - safe[0] * r,
        item.y - safe[1] * r,
        item.x + safe[0] * r,
        item.y + safe[1] * r,
      )
      endStroke(s)
      s.events.length = 0
    }
  }
  return s
}

function item(partial: Partial<Item>): Item {
  return {
    active: true,
    id: 1,
    kind: 'sandwich',
    x: 50,
    y: 80,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    ...partial,
  }
}

function arena(levelId = 1, seed = 1): GameState {
  const s = createGame(levelAt(levelId), seed)
  s.nextWave = 1e9 // sin lanzamientos automáticos: se arma la escena a mano
  return s
}

describe('niveles', () => {
  it('hay al menos 8 niveles, con objetivos y estrellas crecientes', () => {
    expect(LEVEL_COUNT).toBeGreaterThanOrEqual(8)
    LEVELS.forEach((level, i) => {
      expect(level.id).toBe(i + 1)
      expect(level.stars[0]).toBeGreaterThan(0)
      expect(level.stars[1]).toBeGreaterThan(level.stars[0])
    })
    // La dificultad sube de verdad.
    expect(LEVELS[LEVEL_COUNT - 1]!.speed).toBeGreaterThan(LEVELS[0]!.speed)
    expect(LEVELS[LEVEL_COUNT - 1]!.bombChance).toBeGreaterThan(LEVELS[0]!.bombChance)
    expect(LEVELS[LEVEL_COUNT - 1]!.waveMax).toBeGreaterThan(LEVELS[0]!.waveMax)
    expect(LEVELS[LEVEL_COUNT - 1]!.interval).toBeLessThan(LEVELS[0]!.interval)
  })

  it('la progresión guardada tiene la misma cantidad de niveles', async () => {
    const { NINJA_LEVELS } = await import('../../features/arcade/progress.ts')
    expect(NINJA_LEVELS).toBe(LEVEL_COUNT)
  })
})

describe('lanzamientos y física', () => {
  it('es determinista: misma semilla, mismo juego', () => {
    const a = play(levelAt(4), 99, 0.8)
    const b = play(levelAt(4), 99, 0.8)
    expect(resultOf(a)).toEqual(resultOf(b))
    expect(a.tick).toBe(b.tick)
    const c = play(levelAt(4), 100, 0.8)
    expect(c.tick === a.tick && c.score === a.score && c.cuts === a.cuts).toBe(false)
  })

  it('los objetos salen por debajo, suben en arco, alcanzan una cima y caen', () => {
    const s = createGame(levelAt(1), 5)
    let maxHigh = Infinity
    let launched = false
    let spawnY = 0
    for (let i = 0; i < 60 * 12 && !launched; i++) {
      stepGame(s)
      const it = s.items.find((o) => o.active)
      if (it) {
        launched = true
        spawnY = it.y
        expect(it.y).toBeGreaterThan(s.height)
        expect(it.vy).toBeLessThan(0)
        let fell = false
        for (let k = 0; k < 60 * 6; k++) {
          const before = it.vy
          stepGame(s)
          maxHigh = Math.min(maxHigh, it.y)
          if (before < 0 && it.vy >= 0) fell = true
          if (!it.active) break
        }
        expect(fell).toBe(true)
      }
    }
    expect(launched).toBe(true)
    expect(maxHigh).toBeLessThan(s.height * 0.7)
    expect(maxHigh).toBeLessThan(spawnY)
  })

  it('los objetos se quedan dentro del ancho del campo en toda su trayectoria', () => {
    const s = createGame(levelAt(10), 3)
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < 60 * 30 && s.status === 'playing'; i++) {
      stepGame(s)
      s.events.length = 0
      for (const it of s.items) {
        if (!it.active) continue
        minX = Math.min(minX, it.x)
        maxX = Math.max(maxX, it.x)
      }
    }
    expect(minX).toBeGreaterThan(-ITEM_RADIUS)
    expect(maxX).toBeLessThan(FIELD_W + ITEM_RADIUS)
  })

  it('el café frío hace más lento el tiempo y no mueve el límite del nivel', () => {
    const s = arena()
    s.items[0] = item({ vy: -50, y: 100 })
    stepGame(s)
    const normal = s.items[0]!.y
    const f = arena()
    f.freezeTicks = 100
    f.items[0] = item({ vy: -50, y: 100 })
    stepGame(f)
    expect(100 - f.items[0]!.y).toBeLessThan((100 - normal) * 0.5)
  })
})

describe('cortes', () => {
  it('un segmento que pasa por el círculo corta; uno que pasa lejos no', () => {
    const s = arena()
    s.items[0] = item({ x: 50, y: 80 })
    expect(slash(s, 10, 120, 30, 140)).toBe(0)
    expect(slash(s, 50, 75, 50, 75)).toBe(0) // un toque sin recorrido no corta
    expect(slash(s, 30, 80, 70, 80)).toBe(1)
    expect(s.items[0]!.active).toBe(false)
    expect(s.cuts).toBe(1)
    expect(s.score).toBe(10)
    expect(s.events[0]).toMatchObject({ t: 'cut', kind: 'sandwich', angle: 0 })
  })

  it('el segmento también corta si solo roza el borde y no cuando termina antes', () => {
    const s = arena()
    s.items[0] = item({ x: 50, y: 80 })
    expect(slash(s, 20, 80 - ITEM_RADIUS * 1.1, 80, 80 - ITEM_RADIUS * 1.1)).toBe(1)
    const t = arena()
    t.items[0] = item({ x: 50, y: 80 })
    expect(slash(t, 0, 80, 30, 80)).toBe(0)
  })

  it('cortar varios de un tajo da combo y bonus; levantar el dedo reinicia el tajo', () => {
    const s = arena()
    s.items[0] = item({ id: 1, x: 30, y: 80 })
    s.items[1] = item({ id: 2, x: 50, y: 80, kind: 'medialuna' })
    s.items[2] = item({ id: 3, x: 70, y: 80, kind: 'chipa' })
    expect(slash(s, 20, 80, 80, 80)).toBe(3)
    const combo = s.events.find((e) => e.t === 'combo')
    expect(combo).toMatchObject({ t: 'combo', n: 3, bonus: 20 })
    expect(s.score).toBe(30 + 20)
    expect(s.bestStroke).toBe(3)
    endStroke(s)
    expect(s.strokeCuts).toBe(0)
  })

  it('la racha multiplica el puntaje y se corta si pasa mucho tiempo', () => {
    const s = arena()
    for (let i = 0; i < 5; i++) {
      s.items[0] = item({ id: i + 1, x: 50, y: 80 })
      slash(s, 30, 80, 70, 80)
      endStroke(s)
      stepGame(s)
      s.events.length = 0
    }
    expect(s.combo).toBe(5)
    const before = s.score
    s.items[0] = item({ id: 9, x: 50, y: 80 })
    slash(s, 30, 80, 70, 80)
    expect(s.score - before).toBe(20) // 10 x2
    for (let i = 0; i < 100; i++) stepGame(s)
    s.items[0] = item({ id: 10, x: 50, y: 80 })
    slash(s, 30, 80, 70, 80)
    expect(s.combo).toBe(1)
  })

  it('cortar una hormiga cuesta una vida y reinicia la racha, pero no resta puntos', () => {
    const s = arena()
    s.items[0] = item({ id: 1, x: 40, y: 80 })
    slash(s, 20, 80, 60, 80)
    s.items[1] = item({ id: 2, x: 50, y: 80, kind: 'ant' })
    const lives = s.lives
    const score = s.score
    slash(s, 30, 80, 70, 80)
    expect(s.lives).toBe(lives - 1)
    expect(s.combo).toBe(0)
    expect(s.score).toBe(score)
    expect(s.bombHits).toBe(1)
    expect(s.events.some((e) => e.t === 'bomb')).toBe(true)
  })

  it('dejar caer algo bueno cuesta una vida; una hormiga o un especial que caen no', () => {
    const s = arena()
    s.items[0] = item({ id: 1, y: s.height + 30, vy: 20, x: 20 })
    s.items[1] = item({ id: 2, y: s.height + 30, vy: 20, x: 50, kind: 'ant' })
    s.items[2] = item({ id: 3, y: s.height + 30, vy: 20, x: 80, kind: 'golden' })
    stepGame(s)
    expect(s.lives).toBe(levelAt(1).lives - 1)
    expect(s.misses).toBe(1)
    expect(s.items.every((o) => !o.active)).toBe(true)
  })

  it('sin vidas termina el nivel; si ya se cumplió el objetivo, es victoria', () => {
    const lost = arena()
    lost.lives = 1
    lost.items[0] = item({ y: lost.height + 30, vy: 20 })
    stepGame(lost)
    expect(lost.status).toBe('ended')
    expect(lost.win).toBe(false)
    expect(starsOf(lost)).toBe(0)

    const won = arena()
    won.score = levelAt(1).goal.target
    won.lives = 1
    won.items[0] = item({ y: won.height + 30, vy: 20 })
    stepGame(won)
    expect(won.status).toBe('ended')
    expect(won.win).toBe(true)
  })

  it('no se corta nada después de terminar', () => {
    const s = arena()
    s.status = 'ended'
    s.items[0] = item({})
    expect(slash(s, 30, 80, 70, 80)).toBe(0)
  })
})

describe('vidas', () => {
  it('una racha larga devuelve una vida, nunca más que las del nivel', () => {
    const s = arena()
    s.lives = 2
    for (let i = 0; i < 12; i++) {
      s.items[0] = item({ id: i + 1, x: 50, y: 80 })
      slash(s, 30, 80, 70, 80)
      endStroke(s)
      stepGame(s)
    }
    expect(s.lives).toBe(3)
    expect(s.events.some((e) => e.t === 'life')).toBe(true)
    s.lives = levelAt(1).lives
    for (let i = 0; i < 12; i++) {
      s.items[0] = item({ id: 100 + i, x: 50, y: 80 })
      slash(s, 30, 80, 70, 80)
      endStroke(s)
      stepGame(s)
    }
    expect(s.lives).toBe(levelAt(1).lives)
  })
})

describe('especiales', () => {
  it('el cinnamon dorado da frenesí: puntos dobles y las caídas no cuestan vidas', () => {
    const s = arena(3)
    s.items[0] = item({ id: 1, kind: 'golden', x: 50, y: 80 })
    slash(s, 30, 80, 70, 80)
    expect(s.frenzyTicks).toBeGreaterThan(0)
    expect(s.events.some((e) => e.t === 'frenzy')).toBe(true)
    s.items[0] = item({ id: 2, x: 50, y: 80 })
    const before = s.score
    slash(s, 30, 80, 70, 80)
    expect(s.score - before).toBe(20)
    const lives = s.lives
    s.items[0] = item({ id: 3, y: s.height + 30, vy: 20 })
    stepGame(s)
    expect(s.lives).toBe(lives)
  })

  it('durante el frenesí llueven cosas buenas y ninguna hormiga', () => {
    const s = createGame(levelAt(10), 7)
    s.frenzyTicks = 60 * 6
    let ants = 0
    let spawned = 0
    const seen = new Set<number>()
    for (let i = 0; i < 60 * 5; i++) {
      stepGame(s)
      s.events.length = 0
      for (const it of s.items) {
        if (it.active && !seen.has(it.id)) {
          seen.add(it.id)
          spawned++
          if (it.kind === 'ant') ants++
        }
      }
    }
    expect(spawned).toBeGreaterThan(10)
    expect(ants).toBe(0)
  })

  it('el café frío activa la cámara lenta', () => {
    const s = arena(4)
    s.items[0] = item({ kind: 'ice' })
    slash(s, 30, 80, 70, 80)
    expect(s.freezeTicks).toBeGreaterThan(0)
    expect(s.events.some((e) => e.t === 'freeze')).toBe(true)
  })
})

describe('objetivos y estrellas', () => {
  it('cumplir el objetivo avisa una sola vez y suma las estrellas por puntaje', () => {
    const s = arena(1)
    s.score = levelAt(1).goal.target - 10
    s.items[0] = item({})
    slash(s, 30, 80, 70, 80)
    expect(s.events.filter((e) => e.t === 'goal')).toHaveLength(1)
    expect(goalProgress(s)).toBe(1)
    expect(starsOf(s)).toBe(1)
    s.score = levelAt(1).stars[0]
    expect(starsOf(s)).toBe(2)
    s.score = levelAt(1).stars[1]
    expect(starsOf(s)).toBe(3)
  })

  it('los niveles de cortes se miden en cortes, no en puntos', () => {
    const level = levelAt(2)
    expect(level.goal.type).toBe('cuts')
    const s = arena(2)
    s.score = 99999
    expect(starsOf(s)).toBe(0)
    s.cuts = level.goal.target
    expect(starsOf(s)).toBe(3)
  })
})

describe('hormigas justas', () => {
  /** Recorre una partida sin cortar nada y junta las medidas de justicia. */
  function audit(level: LevelDef, seed: number) {
    const s = createGame(level, seed)
    s.lives = 9999
    let minSep = Infinity
    let antsSeen = 0
    let minSpawnGap = Infinity
    let lastAnt = -Infinity
    let maxOnScreen = 0
    const seen = new Set<number>()
    let unwarned = 0
    for (let i = 0; i < 60 * level.seconds && s.status === 'playing'; i++) {
      const warnedBefore = s.launches.filter((l) => l.used && l.kind === 'ant' && l.warn > 0).length
      stepGame(s)
      s.events.length = 0
      let ants = 0
      for (const a of s.items) {
        if (!a.active || a.kind !== 'ant') continue
        if (!seen.has(a.id)) {
          seen.add(a.id)
          antsSeen++
          minSpawnGap = Math.min(minSpawnGap, s.clock - lastAnt)
          lastAnt = s.clock
          // Tuvo que haber una señal de aviso pendiente un paso antes.
          if (warnedBefore === 0) unwarned++
        }
        if (a.y < s.height) ants++
        for (const o of s.items) {
          if (!o.active || o === a || a.y > s.height || o.y > s.height) continue
          minSep = Math.min(minSep, Math.hypot(a.x - o.x, a.y - o.y))
        }
      }
      maxOnScreen = Math.max(maxOnScreen, ants)
    }
    return { antsSeen, minSep, minSpawnGap, maxOnScreen, unwarned }
  }

  const withAnts = LEVELS.filter((l) => l.bombChance > 0)

  it.each(withAnts.map((l) => [l.id, l] as const))(
    'nivel %i: ninguna hormiga es inevitable (separada de todo, con aviso y sin dos a la vez)',
    (_, level) => {
      let total = 0
      for (let seed = 1; seed <= 12; seed++) {
        const r = audit(level, seed)
        total += r.antsSeen
        // Se puede cortar lo bueno sin rozarlas: queda margen más allá de las dos zonas de golpe.
        expect(r.minSep).toBeGreaterThan(ANT_MIN_SEP * 0.8)
        expect(r.minSpawnGap).toBeGreaterThanOrEqual(ANT_COOLDOWN)
        expect(r.unwarned).toBe(0)
        // Nunca dos peligros a la vista juntos, y por eso nunca dos que haya que esquivar a la vez.
        expect(r.maxOnScreen).toBeLessThanOrEqual(1)
      }
      expect(total).toBeGreaterThan(0)
    },
  )

  it('el aviso dura lo suficiente para reaccionar y la zona de la hormiga es más chica que la de lo bueno', () => {
    expect(ANT_WARNING).toBeGreaterThanOrEqual(0.8)
    expect(ANT_HIT_RADIUS).toBeLessThan(ITEM_RADIUS)
    expect(HIT_RADIUS).toBeGreaterThan(ITEM_RADIUS * 1.3)
    const s = arena()
    s.items[0] = item({ kind: 'ant', x: 50, y: 80 })
    // Pasar rozando el borde del dibujo no cuesta una vida.
    expect(slash(s, 20, 80 - ITEM_RADIUS * 1.05, 80, 80 - ITEM_RADIUS * 1.05)).toBe(0)
    expect(s.lives).toBe(levelAt(1).lives)
  })

  it('la frecuencia de hormigas arranca baja y sube suave hasta el ritmo del nivel', () => {
    const s = createGame(levelAt(6), 1)
    const ramps: number[] = []
    for (let p = 0; p <= 10; p++) {
      s.ticksLeft = Math.round(s.level.seconds * 60 * (1 - p / 10))
      ramps.push(antRamp(s))
    }
    expect(ramps[0]).toBeCloseTo(0.3, 5)
    expect(ramps[10]).toBe(1)
    for (let i = 1; i < ramps.length; i++) expect(ramps[i]!).toBeGreaterThanOrEqual(ramps[i - 1]!)
  })
})

describe('equilibrio de los niveles', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))(
    'nivel %i: un jugador bueno lo pasa con estrellas y quedarse quieto no',
    (_, level) => {
      const idle = play(level, 11, 0)
      expect(idle.win).toBe(false)
      const results = [1, 2, 3, 4].map((seed) => play(level, seed, 0.94))
      results.forEach((r) => expect(r.status).toBe('ended'))
      // Con ese pulso se pasa casi siempre (alguna partida mala puede quedarse sin vidas).
      expect(results.filter((r) => starsOf(r) >= 1).length).toBeGreaterThanOrEqual(3)
      const best = Math.max(...results.map((r) => starsOf(r)))
      expect(best).toBeGreaterThanOrEqual(2)
    },
  )

  it('los niveles altos son de verdad más difíciles que los primeros', () => {
    const average = (level: LevelDef) =>
      [1, 2, 3, 4].reduce((sum, seed) => sum + play(level, seed, 0.9).score, 0) / 4
    expect(average(LEVELS[9]!)).toBeGreaterThan(average(LEVELS[0]!) * 2)
  })
})
