import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

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
