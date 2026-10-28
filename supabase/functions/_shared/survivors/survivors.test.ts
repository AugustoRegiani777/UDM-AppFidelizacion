// @vitest-environment node
import {
  NORMAL_CONFIG,
  POWERS,
  QUEEN,
  RELAXED_CONFIG,
  STAGE_COUNT,
  resolveConfig,
} from './config.ts'
import { InputRecorder, isValidLog, replay } from './replay.ts'
import { MAX_CHARGES, checksum, createGame, pick, scoreOf, step } from './sim.ts'
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

  it('los poderes soltados son opcionales y solo pueden ser 0, 1 o 2', () => {
    expect(isValidLog({ moves: [], picks: [], casts: [[5, 2]] })).toBe(true)
    expect(isValidLog({ moves: [], picks: [], casts: [[5, 3]] })).toBe(false)
    expect(isValidLog({ moves: [], picks: [], casts: [[-1, 0]] })).toBe(false)
    expect(isValidLog({ moves: [], picks: [], casts: 'x' })).toBe(false)
    expect(isValidLog({ moves: [], picks: [], casts: Array(401).fill([1, 0]) })).toBe(false)
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

describe('un minuto de hormigas y después la Reina', () => {
  const calm = () => resolveConfig({ spawnMul: 0, durationSeconds: 3, bossSeconds: 4 })

  function run(state: ReturnType<typeof createGame>, ticks: number) {
    const events: string[] = []
    for (let i = 0; i < ticks && state.status === 'playing'; i++) {
      step(state, 16)
      for (const e of state.events) events.push(e.t)
    }
    return events
  }

  it('el juego dura un minuto de supervivencia en todos los niveles', () => {
    for (let stage = 1; stage <= STAGE_COUNT; stage++)
      expect(resolveConfig({ stage }).durationSeconds).toBe(60)
    expect(createGame(NORMAL_CONFIG, 1).surviveTicks).toBe(3600)
  })

  it('la Reina entra recién al terminar el minuto y ya no entran más hormigas comunes', () => {
    const state = createGame(resolveConfig({ durationSeconds: 3, bossSeconds: 30 }), 4)
    state.player.hp = state.player.maxHp = 9999
    const early = run(state, state.surviveTicks - 1)
    expect(early).not.toContain('boss')
    expect(state.enemies.some((e) => e.alive && e.kind === QUEEN)).toBe(false)
    const late = run(state, 2)
    expect(late).toContain('boss')
    expect(state.enemies.filter((e) => e.alive && e.kind === QUEEN)).toHaveLength(1)
    // Solo la Reina (y las hormigas que ella pare) quedan en escena.
    const before = state.enemies.filter((e) => e.alive).length
    run(state, 60)
    expect(state.enemies.filter((e) => e.alive).length).toBeLessThanOrEqual(before + 2)
  })

  it('sobrevivir el minuto no alcanza: se gana al vencer a la Reina', () => {
    const state = createGame(calm(), 4)
    run(state, state.surviveTicks + 60)
    expect(state.status).toBe('playing')
    const queen = state.enemies.find((e) => e.alive && e.kind === QUEEN)!
    queen.hp = 1
    queen.x = state.player.x
    queen.y = state.player.y - 60
    state.fireCooldown = 1
    state.player.hp = state.player.maxHp
    run(state, 120)
    expect(state.status).toBe('won')
    expect(state.queenKillTick).toBeGreaterThan(state.surviveTicks)
  })

  it('si pasa el tiempo sin vencerla, la Reina se escapa y se pierde', () => {
    const state = createGame(calm(), 4)
    state.player.hp = state.player.maxHp = 9999
    state.fireCooldown = 999999
    run(state, state.totalTicks + 10)
    expect(state.status).toBe('lost')
    expect(state.endReason).toBe('time')
  })

  it('quedarse sin vidas termina la partida con el motivo "hp"', () => {
    const state = createGame(NORMAL_CONFIG, 8)
    run(state, 60 * 200)
    expect(state.status).toBe('lost')
    expect(state.endReason).toBe('hp')
  })

  it('cuanto más rápido cae la Reina, más puntos suma', () => {
    const win = (killAfterSeconds: number) => {
      const state = createGame(resolveConfig({ spawnMul: 0, durationSeconds: 3, bossSeconds: 60 }), 4)
      state.status = 'won'
      state.queenKillTick = state.surviveTicks + killAfterSeconds * 60
      state.kills = 50
      state.player.hp = 3
      return scoreOf(state)
    }
    expect(win(5)).toBeGreaterThan(win(20))
    expect(win(1)).toBeGreaterThan(win(2))
    // Perder solo da los puntos de las hormigas.
    const lost = createGame(calm(), 4)
    lost.status = 'lost'
    lost.kills = 50
    expect(scoreOf(lost)).toBe(500)
  })

  it('sin Reina (partidas cortas de prueba) alcanza con aguantar el tiempo', () => {
    const config = resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 2 })
    const state = createGame(config, 3)
    run(state, 130)
    expect(state.status).toBe('won')
  })
})

describe('balance', { timeout: 60_000 }, () => {
  it('quedarse quieto no gana', () => {
    const wins = SEEDS.filter((seed) => playWithBot(NORMAL_CONFIG, seed, 0).won).length
    expect(wins).toBe(0)
  })

  it('un jugador atento gana bastantes partidas (y también puede perder)', () => {
    const results = SEEDS.map((seed) => playWithBot(NORMAL_CONFIG, seed, 0.6))
    const rate = results.filter((r) => r.won).length / SEEDS.length
    expect(rate).toBeGreaterThanOrEqual(0.4)
    expect(rate).toBeLessThan(1)
  })

  it('no es un paseo: se sube de nivel varias veces', () => {
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

  it('ganar rápido rinde más: entre las partidas ganadas, las más cortas puntúan más', () => {
    const wins = SEEDS.map((seed) => playWithBot(NORMAL_CONFIG, seed, 0.6)).filter((r) => r.won)
    expect(wins.length).toBeGreaterThan(2)
    const fastest = wins.reduce((a, b) => (a.ticks < b.ticks ? a : b))
    const slowest = wins.reduce((a, b) => (a.ticks > b.ticks ? a : b))
    expect(fastest.score).toBeGreaterThan(slowest.score - 100 * NORMAL_CONFIG.playerHp)
  })

  it('sin enemigos (configuración de pruebas) la partida se gana sola', () => {
    const config = resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 2 })
    expect(playWithBot(config, 3, 0).won).toBe(true)
  })
})

describe('niveles', { timeout: 120_000 }, () => {
  it('cada nivel es más duro que el anterior', () => {
    let previous = resolveConfig({ stage: 1 })
    for (let stage = 2; stage <= STAGE_COUNT; stage++) {
      const config = resolveConfig({ stage })
      expect(config.spawnMul).toBeGreaterThan(previous.spawnMul)
      expect(config.enemySpeedMul).toBeGreaterThan(previous.enemySpeedMul)
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

describe('poderes en burbujas', () => {
  const quiet = () => resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 60 })

  function withEnemies(upgrade: (typeof POWERS)[number], level: number) {
    const state = createGame(quiet(), 9)
    state.upgrades[upgrade] = level
    state.fireCooldown = 99999 // sin disparo normal: se mide solo el poder
    state.spawnBudget = 0 // sin las dos hormigas con las que arranca la partida
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

  const index = (id: (typeof POWERS)[number]) => POWERS.indexOf(id)

  it('un poder elegido junta burbujas con el tiempo hasta un tope y se queda esperando', () => {
    const state = withEnemies('soldiers', 1)
    expect(state.charges.soldiers).toBe(0)
    for (let i = 0; i < 61; i++) step(state, 16)
    expect(state.charges.soldiers).toBe(1)
    // Nada se suelta solo: los soldados no aparecen hasta que el jugador los llama.
    expect(state.soldiers.some((s) => s.alive)).toBe(false)
    for (let i = 0; i < 60 * 60; i++) step(state, 16)
    expect(state.charges.soldiers).toBe(MAX_CHARGES)
  })

  it('un poder que no se eligió nunca junta burbujas', () => {
    const state = withEnemies('soldiers', 1)
    for (let i = 0; i < 60 * 40; i++) step(state, 16)
    expect(state.charges.chipas).toBe(0)
    expect(state.charges.bait).toBe(0)
  })

  it('soltar sin burbuja no hace nada', () => {
    const state = withEnemies('soldiers', 2)
    step(state, 16, index('soldiers'))
    expect(state.soldiers.some((s) => s.alive)).toBe(false)
    expect(state.charges.soldiers).toBe(0)
  })

  it('los soldados miga aparecen al soltarlos, duran 5 segundos y lastiman a los enemigos', () => {
    const state = withEnemies('soldiers', 2)
    state.charges.soldiers = 2
    let maxAlive = 0
    step(state, 16, index('soldiers'))
    expect(state.charges.soldiers).toBe(1)
    for (let i = 0; i < 120; i++) {
      step(state, 16)
      maxAlive = Math.max(maxAlive, state.soldiers.filter((s) => s.alive).length)
    }
    expect(maxAlive).toBe(3)
    expect(state.enemies.some((e) => !e.alive || e.hp < e.maxHp)).toBe(true)
    for (let i = 0; i < 300; i++) step(state, 16)
    expect(state.soldiers.some((s) => s.alive)).toBe(false)
  })

  it('la lluvia de chipás cae y rompe enemigos cuando se la suelta', () => {
    const state = withEnemies('chipas', 3)
    state.charges.chipas = 1
    const kinds = new Set<string>()
    step(state, 16, index('chipas'))
    for (let i = 0; i < 400; i++) {
      step(state, 16)
      for (const e of state.events) kinds.add(e.t)
    }
    expect(kinds.has('chipa')).toBe(true)
    expect(kinds.has('boom')).toBe(true)
  })

  it('la medialuna de cebo atrae a los enemigos y explota al terminar', () => {
    const state = withEnemies('bait', 3)
    state.charges.bait = 2
    for (const e of state.enemies) {
      e.speed = 0.5
      e.x = e.px = state.player.x - 120
      e.y = e.py = state.player.y + 100
    }
    step(state, 16, index('bait'))
    expect(state.bait.alive).toBe(true)
    // Con el cebo puesto, otra burbuja de cebo no se gasta.
    step(state, 16, index('bait'))
    expect(state.charges.bait).toBe(1)
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
    const config = resolveConfig({ stage: 3 })
    const runs = SEEDS.map((seed) => ({ seed, bot: playWithBot(config, seed, 0.6) }))
    const withCasts = runs.find((r) => r.bot.log.casts.length > 0)
    expect(withCasts).toBeDefined()
    const { seed, bot } = withCasts!
    const result = replay(config, seed, bot.log)
    expect(result.valid).toBe(true)
    expect(result.status).toBe(bot.won ? 'won' : 'lost')
    expect(result.score).toBe(bot.score)
  })

  it('un registro con poderes inventados (sin burbuja) no cambia el resultado', () => {
    // Sin ningún poder elegido, soltar poderes en el registro no cambia nada de la partida.
    const config = resolveConfig({ spawnMul: 0, boss: false, durationSeconds: 5 })
    const honest = replay(config, 33, { moves: [], picks: [] })
    const spam: [number, number][] = Array.from({ length: 120 }, (_, i) => [i * 2, i % 3])
    const cheating = replay(config, 33, { moves: [], picks: [], casts: spam })
    expect(cheating.valid).toBe(true)
    expect(checksum(cheating.state)).toBe(checksum(honest.state))
  })
})
