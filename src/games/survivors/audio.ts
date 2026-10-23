// Efectos de sonido sintetizados con Web Audio (sin archivos que descargar). Respetan la
// preferencia de sonido del perfil (apagado por defecto) y se limitan para no saturar.

import { isSoundEnabled } from '@/motion/preferences'

let context: AudioContext | null = null
const lastPlayed = new Map<string, number>()

/** Hay que llamarlo desde un gesto del usuario (el botón "Jugar"): los navegadores lo exigen. */
export function unlockAudio(): void {
  if (!isSoundEnabled()) return
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  } catch {
    context = null
  }
}

interface Tone {
  from: number
  to?: number
  duration: number
  type?: OscillatorType
  volume?: number
  delay?: number
}

function play(name: string, minGapMs: number, tones: Tone[]) {
  if (!context || !isSoundEnabled()) return
  const nowMs = performance.now()
  if (nowMs - (lastPlayed.get(name) ?? -Infinity) < minGapMs) return
  lastPlayed.set(name, nowMs)

  const start = context.currentTime
  for (const tone of tones) {
    const t0 = start + (tone.delay ?? 0)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = tone.type ?? 'sine'
    oscillator.frequency.setValueAtTime(tone.from, t0)
    if (tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, t0 + tone.duration)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.08, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(t0)
    oscillator.stop(t0 + tone.duration + 0.02)
  }
}

const arpeggio = (notes: number[], step: number, type: OscillatorType = 'triangle'): Tone[] =>
  notes.map((from, i) => ({ from, duration: 0.22, type, volume: 0.1, delay: i * step }))

export const sfx = {
  shoot: () =>
    play('shoot', 90, [{ from: 740, to: 520, duration: 0.07, type: 'square', volume: 0.025 }]),
  hit: () =>
    play('hit', 50, [{ from: 220, to: 120, duration: 0.05, type: 'square', volume: 0.04 }]),
  kill: () => play('kill', 40, [{ from: 360, to: 90, duration: 0.12, type: 'sine', volume: 0.09 }]),
  gem: () => play('gem', 45, [{ from: 880, to: 1320, duration: 0.09, type: 'sine', volume: 0.05 }]),
  hurt: () =>
    play('hurt', 200, [{ from: 240, to: 60, duration: 0.28, type: 'sawtooth', volume: 0.1 }]),
  levelUp: () => play('levelup', 300, arpeggio([523, 659, 784, 1047], 0.07)),
  pick: () =>
    play('pick', 100, [{ from: 660, to: 990, duration: 0.12, type: 'triangle', volume: 0.08 }]),
  boss: () =>
    play('boss', 500, [
      { from: 90, to: 55, duration: 0.7, type: 'sawtooth', volume: 0.12 },
      { from: 135, to: 80, duration: 0.7, type: 'square', volume: 0.05 },
    ]),
  wave: () =>
    play('wave', 500, [{ from: 330, to: 440, duration: 0.3, type: 'triangle', volume: 0.08 }]),
  win: () => play('win', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
  lose: () => play('lose', 500, arpeggio([392, 330, 262, 196], 0.12, 'sawtooth')),
}
