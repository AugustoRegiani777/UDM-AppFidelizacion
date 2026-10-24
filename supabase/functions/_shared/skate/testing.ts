// Patinador automático para pruebas y balance (no se usa en producción).

import { STICK_NONE, type SkateConfig } from './config.ts'
import { replaySkate, SkateRecorder, type SkateLog } from './replay.ts'
import { createSkate, stepSkate, type SkateState } from './sim.ts'
import { heightAt, slopeAt } from './terrain.ts'

const UP = 7
const DOWN = 3
const LEFT = 5
const RIGHT = 1

/** Qué pulgar izquierdo conviene para girar hacia la superficie que viene. */
function alignStick(state: SkateState): number {
  const lookahead = Math.max(20, Math.abs(state.vx) * 0.22)
  const x = state.x + lookahead
  const slope = slopeAt(state.terrain, x)
  const inv = 1 / Math.sqrt(1 + slope * slope)
  const nx = slope * inv
  const ny = -inv
  const turn = state.upX * ny - state.upY * nx
  if (Math.abs(turn) < 0.06) return STICK_NONE
  return turn > 0 ? RIGHT : LEFT
}

export interface BotOptions {
  /** 0 = no toca nada; 1 = juega con todo (turbo, trucos y saltos al borde). */
  skill: number
  tricks?: boolean
}

export function botInput(state: SkateState, options: BotOptions): [number, boolean] {
  if (options.skill <= 0) return [STICK_NONE, false]

  if (state.grounded) {
    const speed = Math.abs(state.speed)
    // Salto al borde: si viene un foso, cargar y soltar justo antes.
    const near = Math.max(14, speed * 0.1)
    const farther = Math.max(60, speed * 0.55)
    const gapNear = !Number.isFinite(heightAt(state.terrain, state.x + near))
    let gapAhead = false
    for (let d = near; d <= farther; d += 10) {
      if (!Number.isFinite(heightAt(state.terrain, state.x + d))) gapAhead = true
    }
    if (gapNear) return [STICK_NONE, false] // soltar = saltar
    if (gapAhead) return [state.boost > 8 && speed < 560 ? UP : STICK_NONE, true] // cargar el salto
    if (state.boost > 30 && speed < 480) return [UP, false]
    const slope = slopeAt(state.terrain, state.x)
    return [slope > 0.08 ? DOWN : STICK_NONE, false]
  }

  // En el aire: un truco corto al principio, girar para alinear y soltar todo antes de aterrizar.
  const surface = heightAt(state.terrain, state.x + state.vx * 0.2)
  const closeToLanding = Number.isFinite(surface) && surface - state.y < 70 && state.vy > 0
  let stick = alignStick(state)
  if (closeToLanding) return [stick, false]
  const doTricks = options.tricks !== false
  if (doTricks && state.airTicks >= 5 && state.airTicks < 9) return [STICK_NONE, true]
  if (doTricks && state.airTicks >= 9 && state.airTicks < 12) return [stick, false]
  // Un agarre más largo cuando el salto es alto: pulgar derecho mantenido.
  if (doTricks && state.airTicks >= 12 && state.vy < 40 && !closeToLanding) {
    stick = stick === STICK_NONE ? STICK_NONE : stick
    return [stick, true]
  }
  return [stick, false]
}

export interface SkateRun {
  won: boolean
  lives: number
  bails: number
  clean: number
  seconds: number
  log: SkateLog
}

export function playSkate(config: SkateConfig, seed: number, options: BotOptions): SkateRun {
  const state = createSkate(config, seed)
  const recorder = new SkateRecorder()
  while (state.status === 'playing') {
    const [stick, right] = botInput(state, options)
    recorder.input(state.tick, stick, right)
    stepSkate(state, stick, right)
  }
  const check = replaySkate(config, seed, recorder.log)
  if (check.status !== state.status || check.ticks !== state.tick) {
    throw new Error('el replay no coincide con la partida en vivo')
  }
  return {
    won: state.status === 'won',
    lives: state.lives,
    bails: state.bails,
    clean: state.clean,
    seconds: state.tick / 60,
    log: recorder.log,
  }
}
