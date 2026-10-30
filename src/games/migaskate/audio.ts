import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  push: () =>
    play('push', 140, [{ from: 120, to: 90, duration: 0.1, type: 'triangle', volume: 0.05 }]),
  pop: () =>
    play('pop', 80, [{ from: 220, to: 520, duration: 0.09, type: 'square', volume: 0.06 }]),
  flip: () =>
    play('flip', 120, [{ from: 500, to: 900, duration: 0.16, type: 'triangle', volume: 0.05 }]),
  land: () =>
    play('land', 80, [{ from: 150, to: 70, duration: 0.12, type: 'square', volume: 0.08 }]),
  grind: () =>
    play('grind', 120, [{ from: 1200, to: 800, duration: 0.14, type: 'sawtooth', volume: 0.035 }]),
  grab: () =>
    play('grab', 120, [{ from: 660, to: 760, duration: 0.1, type: 'triangle', volume: 0.05 }]),
  bump: () =>
    play('bump', 90, [{ from: 140, to: 60, duration: 0.14, type: 'square', volume: 0.08 }]),
  bail: () =>
    play('bail', 300, [{ from: 330, to: 140, duration: 0.35, type: 'triangle', volume: 0.07 }]),
  trick: () => play('trick', 100, arpeggio([587, 784], 0.06)),
  bank: () => play('bank', 200, arpeggio([523, 659, 784, 1047], 0.07)),
  star: () => play('star', 300, arpeggio([659, 880, 1175, 1568], 0.08)),
}
