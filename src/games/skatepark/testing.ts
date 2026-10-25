// Patinador automático para pruebas y balance: sirve para comprobar que el parque se puede jugar
// bien y que quedarse quieto no suma. No se usa en producción.

import { createPark, stepPark, type ParkInput, type ParkState } from './sim.ts'

/** Plan del bot: apretar derecho desde `from` hasta `until` (ticks absolutos) con una palanca fija. */
interface Plan {
  from: number
  until: number
  stick: number
}

export interface BotOptions {
  /** 0 = no hace nada, 1 = juega a pleno (salta todo y encadena trucos). */
  skill: number
  /** Si hace trucos en el aire (si no, solo salta). */
  tricks: boolean
}

function nextObstacle(s: ParkState) {
  return s.obstacles.find((o) => o.x + o.w > s.x + 2 && (o.kind !== 'rail' || o.x > s.x - 20))
}

export function makeBot(options: BotOptions) {
  let press: Plan | null = null
  let flipDone = false
  let lastMode = ''

  return (s: ParkState): ParkInput => {
    if (options.skill <= 0) return { stick: 0, right: false }
    if (s.mode !== lastMode) {
      flipDone = false
      lastMode = s.mode
    }
    let stick = 0
    let right = false

    // Equilibrio en el riel.
    if (s.mode === 'grind' && s.grind) {
      const b = s.grind.balance
      stick = b > 0.12 ? 5 : b < -0.12 ? 1 : 0
      return { stick, right: false }
    }

    if (press && s.tick <= press.until && s.tick >= press.from) {
      right = true
      stick = press.stick
    } else if (press && s.tick > press.until) {
      press = null
    }

    if (s.mode === 'roll' && !press) {
      const o = nextObstacle(s)
      if (o) {
        const dist = o.x - s.x
        const end = o.x + o.w - s.x
        if (o.kind === 'ramp') {
          // Carga un saltito y suelta justo en el borde de la rampa.
          if (end < 36 && end > 0)
            press = { from: s.tick, until: s.tick + Math.max(1, Math.round(end / 3.3)), stick: 0 }
        } else if (o.kind === 'box') {
          if (dist < 62 && dist > 40) press = { from: s.tick, until: s.tick + 4, stick: 0 }
        } else if (o.kind === 'rail') {
          if (dist < 66 && dist > 50) press = { from: s.tick, until: s.tick + 4, stick: 0 }
        } else if (o.kind === 'gap') {
          // Carga completa y salta justo antes del pozo.
          if (dist < 68 && dist > 40)
            press = { from: s.tick, until: s.tick + Math.max(10, Math.round(dist / 3.4)), stick: 0 }
        }
      }
    }

    if (
      s.mode === 'air' &&
      options.tricks &&
      !flipDone &&
      !s.flip &&
      s.airTicks > 6 &&
      s.vy > -300
    ) {
      // Un truco por salto, y a tiempo para completarlo antes de caer.
      const remaining = s.vy > 0 ? (2 * s.vy) / 1500 : 0
      if (remaining * 60 > 44 || s.y > 30) {
        press = { from: s.tick, until: s.tick + 3, stick: 0 }
        flipDone = true
      }
    }
    if (s.mode === 'air' && press && press.stick === 0 && press.until === s.tick) {
      // La palanca se elige al soltar: giros de 180 con ← o → en rampas grandes serían el siguiente paso.
      stick = 0
    }
    return { stick, right }
  }
}

export interface BotRun {
  score: number
  bails: number
  landed: number
  bestCombo: number
  stars: number
}

export function playWithBot(level: number, seed: number, options: BotOptions): BotRun {
  const s = createPark(level, seed)
  const bot = makeBot(options)
  while (s.status === 'playing') stepPark(s, bot(s))
  return { score: s.score, bails: s.bails, landed: s.landed, bestCombo: s.bestCombo, stars: 0 }
}
