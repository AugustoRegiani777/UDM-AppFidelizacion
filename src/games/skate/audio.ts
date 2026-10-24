import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const skateSfx = {
  jump: () =>
    play('s-jump', 80, [{ from: 300, to: 540, duration: 0.12, type: 'sine', volume: 0.07 }]),
  land: () =>
    play('s-land', 80, [{ from: 170, to: 55, duration: 0.14, type: 'sine', volume: 0.13 }]),
  sketchy: () =>
    play('s-sketchy', 120, [{ from: 140, to: 70, duration: 0.2, type: 'square', volume: 0.07 }]),
  trick: () =>
    play('s-trick', 60, [{ from: 880, to: 1175, duration: 0.1, type: 'triangle', volume: 0.09 }]),
  bail: () =>
    play('s-bail', 300, [
      { from: 220, to: 45, duration: 0.45, type: 'sawtooth', volume: 0.12 },
      { from: 120, to: 40, duration: 0.3, type: 'square', volume: 0.06, delay: 0.05 },
    ]),
  boost: () =>
    play('s-boost', 150, [{ from: 200, to: 620, duration: 0.18, type: 'sawtooth', volume: 0.04 }]),
  checkpoint: () => play('s-checkpoint', 400, arpeggio([659, 880, 1175], 0.08)),
  finish: () => play('s-finish', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
  lose: () => play('s-lose', 500, arpeggio([392, 330, 262, 196], 0.12, 'sawtooth')),
}
