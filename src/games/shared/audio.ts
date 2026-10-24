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

export interface Tone {
  from: number
  to?: number
  duration: number
  type?: OscillatorType
  volume?: number
  delay?: number
}

export function play(name: string, minGapMs: number, tones: Tone[]) {
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

export const arpeggio = (
  notes: number[],
  step: number,
  type: OscillatorType = 'triangle',
): Tone[] => notes.map((from, i) => ({ from, duration: 0.22, type, volume: 0.1, delay: i * step }))
