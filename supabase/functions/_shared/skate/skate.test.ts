// @vitest-environment node
import { NORMAL_SKATE, RELAXED_SKATE, resolveSkateConfig } from './config.ts'
import { isValidSkateLog, replaySkate, SkateRecorder } from './replay.ts'
import { checksumSkate, createSkate, stepSkate } from './sim.ts'
import { buildTerrain, heightAt } from './terrain.ts'
import { playSkate } from './testing.ts'

describe('circuito', () => {
  const terrain = buildTerrain()

  it('tiene un largo razonable y puntos de control sobre suelo firme', () => {
    expect(terrain.length).toBeGreaterThan(9000)
    expect(terrain.checkpoints.length).toBeGreaterThanOrEqual(4)
    for (const x of terrain.checkpoints) expect(Number.isFinite(heightAt(terrain, x))).toBe(true)
  })

  it('tiene fosos y el suelo es continuo fuera de ellos', () => {
    let gaps = 0
    for (let i = 0; i < terrain.solid.length; i++) if (!terrain.solid[i]) gaps++
    expect(gaps).toBeGreaterThan(20)
    for (let x = 0; x < terrain.length; x += 7) {
      const h = heightAt(terrain, x)
      expect(Number.isNaN(h)).toBe(false)
    }
  })
})

describe('simulación determinista', () => {
  it('misma entrada, misma partida', () => {
    const run = () => {
      const state = createSkate(NORMAL_SKATE, 1)
      for (let i = 0; i < 900 && state.status === 'playing'; i++) {
        stepSkate(state, (Math.floor(i / 20) % 9) as number, Math.floor(i / 35) % 2 === 0)
      }
      return checksumSkate(state)
    }
    expect(run()).toBe(run())
  })

  it('el replay del servidor reproduce la partida en vivo', () => {
    const live = createSkate(NORMAL_SKATE, 5)
    const recorder = new SkateRecorder()
    while (live.status === 'playing') {
      const stick = Math.floor(live.tick / 25) % 9
      const right = Math.floor(live.tick / 40) % 3 === 0
      recorder.input(live.tick, stick, right)
      stepSkate(live, stick, right)
    }
    const result = replaySkate(NORMAL_SKATE, 5, recorder.log)
    expect(checksumSkate(result.state)).toBe(checksumSkate(live))
    expect(result.status).toBe(live.status)
  })
})

describe('validación del registro', () => {
  it('rechaza formas inválidas', () => {
    expect(isValidSkateLog(null)).toBe(false)
    expect(isValidSkateLog({ moves: 'x' })).toBe(false)
    expect(isValidSkateLog({ moves: [[1, 9, 0]] })).toBe(false)
    expect(isValidSkateLog({ moves: [[1, 3, 2]] })).toBe(false)
    expect(isValidSkateLog({ moves: [[1.5, 3, 0]] })).toBe(false)
    expect(
      isValidSkateLog({
        moves: [
          [5, 3, 0],
          [2, 3, 1],
        ],
      }),
    ).toBe(false)
    expect(
      isValidSkateLog({
        moves: [
          [0, 3, 0],
          [20, 7, 1],
        ],
      }),
    ).toBe(true)
  })
})

describe('balance', { timeout: 60_000 }, () => {
  it('quedarse sin tocar nada no llega a la meta', () => {
    expect(playSkate(NORMAL_SKATE, 1, { skill: 0 }).won).toBe(false)
  })

  it('rodar sin hacer trucos no alcanza: los saltos grandes piden turbo', () => {
    expect(playSkate(NORMAL_SKATE, 1, { skill: 1, tricks: false }).won).toBe(false)
  })

  it('con trucos, turbo y saltos bien hechos se completa el circuito', () => {
    const run = playSkate(NORMAL_SKATE, 1, { skill: 1 })
    expect(run.won).toBe(true)
    expect(run.clean).toBeGreaterThanOrEqual(6)
    expect(run.seconds).toBeGreaterThan(18)
  })

  it('el modo relajado también se completa', () => {
    expect(playSkate(RELAXED_SKATE, 1, { skill: 1 }).won).toBe(true)
  })

  it('con el circuito recortado (pruebas) se gana solo, rodando', () => {
    const config = resolveSkateConfig({ courseLimit: 600 })
    const run = playSkate(config, 1, { skill: 0 })
    expect(run.won).toBe(true)
    expect(run.seconds).toBeLessThan(15)
  })
})
