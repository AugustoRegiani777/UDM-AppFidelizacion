import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  count: () => play('count', 200, [{ from: 440, duration: 0.18, type: 'square', volume: 0.06 }]),
  go: () => play('go', 300, [{ from: 880, to: 1175, duration: 0.4, type: 'square', volume: 0.07 }]),
  lap: () => play('lap', 300, arpeggio([659, 880, 1047], 0.07)),
  boost: () =>
    play('boost', 150, [{ from: 300, to: 900, duration: 0.3, type: 'sawtooth', volume: 0.06 }]),
  bump: () =>
    play('bump', 90, [{ from: 160, to: 60, duration: 0.12, type: 'square', volume: 0.09 }]),
  finish: () => play('finish', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
}
