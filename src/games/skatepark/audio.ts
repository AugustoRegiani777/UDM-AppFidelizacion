import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  pop: () =>
    play('p-pop', 70, [{ from: 260, to: 520, duration: 0.09, type: 'square', volume: 0.06 }]),
  trick: () =>
    play('p-trick', 60, [{ from: 880, to: 1250, duration: 0.09, type: 'triangle', volume: 0.08 }]),
  grab: () =>
    play('p-grab', 100, [{ from: 520, to: 700, duration: 0.1, type: 'triangle', volume: 0.06 }]),
  land: () =>
    play('p-land', 80, [{ from: 170, to: 55, duration: 0.14, type: 'sine', volume: 0.13 }]),
  sketchy: () =>
    play('p-sketchy', 120, [{ from: 140, to: 70, duration: 0.2, type: 'square', volume: 0.07 }]),
  grind: () =>
    play('p-grind', 90, [{ from: 1500, to: 900, duration: 0.08, type: 'sawtooth', volume: 0.025 }]),
  grindStart: () =>
    play('p-grindstart', 150, [
      { from: 700, to: 1700, duration: 0.14, type: 'sawtooth', volume: 0.05 },
    ]),
  turbo: () =>
    play('p-turbo', 200, [{ from: 260, to: 980, duration: 0.28, type: 'sawtooth', volume: 0.06 }]),
  bail: () =>
    play('p-bail', 300, [
      { from: 220, to: 45, duration: 0.45, type: 'sawtooth', volume: 0.12 },
      { from: 120, to: 40, duration: 0.3, type: 'square', volume: 0.06, delay: 0.05 },
    ]),
  bank: (big: boolean) =>
    play('p-bank', 200, arpeggio(big ? [523, 659, 784, 1047, 1319] : [659, 880], 0.07)),
  done: () => play('p-done', 500, arpeggio([523, 659, 784, 1047], 0.1)),
}
