// @vitest-environment node
import { NORMAL_CONFIG, RELAXED_CONFIG, resolveConfig } from './config.ts'
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
