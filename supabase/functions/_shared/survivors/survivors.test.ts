// @vitest-environment node
import { NORMAL_CONFIG, RELAXED_CONFIG, STAGE_COUNT, resolveConfig } from './config.ts'
import { InputRecorder, isValidLog, replay } from './replay.ts'
import { checksum, createGame, pick, step } from './sim.ts'
import { playWithBot } from './testing.ts'

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919)

describe('simulación determinista', () => {
  it('la misma semilla y las mismas entradas dan exactamente la misma partida', () => {
    const run = () => {
      const state = createGame(NORMAL_CONFIG, 42)
      for (let i = 0; i < 600 && state.status === 'playing' && !state.pending; i++)
        step(state, i % 16)
      return checksum(state)
    }
    expect(run()).toBe(run())
  })

  it('otra semilla da otra partida', () => {
    const a = createGame(NORMAL_CONFIG, 1)
    const b = createGame(NORMAL_CONFIG, 2)
    for (let i = 0; i < 500; i++) {
      step(a, 16)
      step(b, 16)
    }
    expect(checksum(a)).not.toBe(checksum(b))
  })

  it('el replay del servidor reproduce la partida en vivo tick por tick', () => {
    const config = NORMAL_CONFIG
    const live = createGame(config, 77)
    const recorder = new InputRecorder()
    while (live.status === 'playing') {
      if (live.pending) {
        recorder.pick(live.tick, 1 % live.pending.length)
        pick(live, 1 % live.pending.length)
        continue
      }
      const dir = Math.floor(live.tick / 30) % 17
      recorder.move(live.tick, dir)
      step(live, dir)
    }
    const result = replay(config, 77, recorder.log)
    expect(result.valid).toBe(true)
    expect(checksum(result.state)).toBe(checksum(live))
    expect(result.status).toBe(live.status)
  })
})

describe('validación del registro de entradas', () => {
  it('rechaza formas inválidas', () => {
    expect(isValidLog(null)).toBe(false)
    expect(isValidLog({ moves: 'x', picks: [] })).toBe(false)
    expect(isValidLog({ moves: [[1.5, 2]], picks: [] })).toBe(false)
    expect(isValidLog({ moves: [[1, 99]], picks: [] })).toBe(false)
    expect(isValidLog({ moves: [], picks: [[1, 5]] })).toBe(false)
    expect(isValidLog({ moves: [[0, 3]], picks: [[10, 2]] })).toBe(true)
  })

  it('un registro al que le faltan las mejoras no cuenta como victoria', () => {
    const bot = playWithBot(NORMAL_CONFIG, 5)
    const stripped = { moves: bot.log.moves, picks: [] as [number, number][] }
    const result = replay(NORMAL_CONFIG, 5, stripped)
    if (bot.log.picks.length > 0) {
      expect(result.valid).toBe(false)
      expect(result.status).not.toBe('won')
    }
  })
})

describe('balance', { timeout: 60_000 }, () => {
  it('quedarse quieto no gana', () => {
    const wins = SEEDS.filter((seed) => playWithBot(NORMAL_CONFIG, seed, 0).won).length
    expect(wins).toBe(0)
  })

  it('un jugador atento gana la mayoría de las partidas (y puede perder)', () => {
    const results = SEEDS.map((seed) => playWithBot(NORMAL_CONFIG, seed, 0.6))
    const rate = results.filter((r) => r.won).length / SEEDS.length
    expect(rate).toBeGreaterThanOrEqual(0.5)
    expect(rate).toBeLessThan(1)
  })

  it('no es un paseo: se sube de nivel varias veces y se pierde vida', () => {
    const results = SEEDS.map((seed) => playWithBot(NORMAL_CONFIG, seed, 0.6))
    const averageLevel = results.reduce((sum, r) => sum + r.level, 0) / results.length
    expect(averageLevel).toBeGreaterThanOrEqual(5)
    expect(results.some((r) => r.hp < NORMAL_CONFIG.playerHp)).toBe(true)
  })

  it('el modo relajado es más fácil que el normal', () => {
    const normal = SEEDS.filter((seed) => playWithBot(NORMAL_CONFIG, seed, 0.6).won).length
    const relaxed = SEEDS.filter((seed) => playWithBot(RELAXED_CONFIG, seed, 0.6).won).length
    expect(relaxed).toBeGreaterThanOrEqual(normal)
  })

  it('sin enemigos (configuración de pruebas) la partida se gana sola', () => {
    const config = resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 2 })
    expect(playWithBot(config, 3, 0).won).toBe(true)
  })
})

describe('niveles', { timeout: 120_000 }, () => {
  it('cada nivel es más largo y más duro que el anterior', () => {
    let previous = resolveConfig({ stage: 1 })
    for (let stage = 2; stage <= STAGE_COUNT; stage++) {
      const config = resolveConfig({ stage })
      expect(config.durationSeconds).toBeGreaterThan(previous.durationSeconds)
      expect(config.spawnMul).toBeGreaterThan(previous.spawnMul)
      previous = config
    }
  })

  it('un nivel fuera de rango se acota y el nivel 1 es el juego original', () => {
    expect(resolveConfig({ stage: 99 }).stage).toBe(STAGE_COUNT)
    expect(resolveConfig({ stage: -3 }).stage).toBe(1)
    expect(resolveConfig({ stage: 1 })).toEqual(NORMAL_CONFIG)
  })

  it('el último nivel se gana menos que el primero', () => {
    const rate = (stage: number) =>
      SEEDS.filter((seed) => playWithBot(resolveConfig({ stage }), seed, 0.6).won).length
    expect(rate(STAGE_COUNT)).toBeLessThan(rate(1))
  })

  it('quedarse quieto no gana en ningún nivel', () => {
    for (let stage = 1; stage <= STAGE_COUNT; stage++)
      expect(playWithBot(resolveConfig({ stage }), 11, 0).won).toBe(false)
  })
})

describe('poderes', () => {
  const quiet = () => resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 30 })

  function withEnemies(upgrade: 'soldiers' | 'chipas' | 'bait', level: number) {
    const state = createGame(quiet(), 9)
    state.upgrades[upgrade] = level
    state.fireCooldown = 99999 // sin disparo normal: se mide solo el poder
    // Un grupo de hormigas quietas cerca del jugador.
    for (let i = 0; i < 6; i++) {
      const e = state.enemies[i]!
      e.alive = true
      e.kind = 0
      e.x = e.px = state.player.x + 40 + i * 6
      e.y = e.py = state.player.y - 40
      e.hp = e.maxHp = 4
      e.r = 8
      e.speed = 0
      e.dmg = 0
    }
    return state
  }

  it('los soldados miga aparecen, duran 5 segundos y lastiman a los enemigos', () => {
    const state = withEnemies('soldiers', 2)
    state.soldierCd = 1
    let maxAlive = 0
    for (let i = 0; i < 120; i++) {
      step(state, 16)
      maxAlive = Math.max(maxAlive, state.soldiers.filter((s) => s.alive).length)
    }
    expect(maxAlive).toBe(3)
    expect(state.enemies.some((e) => !e.alive || e.hp < e.maxHp)).toBe(true)
    for (let i = 0; i < 300; i++) step(state, 16)
    expect(state.soldiers.some((s) => s.alive)).toBe(false)
  })

  it('la lluvia de chipás cae y rompe enemigos', () => {
    const state = withEnemies('chipas', 3)
    state.rainCd = 1
    const kinds = new Set<string>()
    for (let i = 0; i < 400; i++) {
      step(state, 16)
      for (const e of state.events) kinds.add(e.t)
    }
    expect(kinds.has('chipa')).toBe(true)
    expect(kinds.has('boom')).toBe(true)
  })

  it('la medialuna de cebo atrae a los enemigos y explota al terminar', () => {
    const state = withEnemies('bait', 3)
    state.baitCd = 1
    for (const e of state.enemies) {
      e.speed = 0.5
      e.x = e.px = state.player.x - 120
      e.y = e.py = state.player.y + 100
    }
    step(state, 16)
    expect(state.bait.alive).toBe(true)
    const before = state.enemies[0]!
    const startDistance = Math.hypot(before.x - state.bait.x, before.y - state.bait.y)
    for (let i = 0; i < 60; i++) step(state, 16)
    expect(Math.hypot(before.x - state.bait.x, before.y - state.bait.y)).toBeLessThan(startDistance)
    const events: string[] = []
    for (let i = 0; i < 200; i++) {
      step(state, 16)
      for (const e of state.events) events.push(e.t)
    }
    expect(events).toContain('boom')
    expect(state.bait.alive).toBe(false)
  })

  it('con los poderes, el replay del servidor sigue coincidiendo', () => {
    const bot = playWithBot(resolveConfig({ stage: 3 }), 21, 0.6)
    const result = replay(resolveConfig({ stage: 3 }), 21, bot.log)
    expect(result.valid).toBe(true)
    expect(result.status).toBe(bot.won ? 'won' : 'lost')
  })
})
