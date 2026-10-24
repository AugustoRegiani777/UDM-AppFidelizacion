import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  card: () =>
    play('card', 60, [{ from: 200, to: 90, duration: 0.07, type: 'square', volume: 0.07 }]),
  say: () =>
    play('say', 150, [{ from: 330, to: 440, duration: 0.14, type: 'triangle', volume: 0.08 }]),
  shout: () =>
    play('shout', 200, [
      { from: 220, to: 330, duration: 0.18, type: 'sawtooth', volume: 0.07 },
      { from: 440, to: 330, duration: 0.18, type: 'square', volume: 0.04, delay: 0.1 },
    ]),
  winHand: () => play('winHand', 300, arpeggio([523, 659, 784], 0.07)),
  loseHand: () => play('loseHand', 300, arpeggio([330, 262], 0.1, 'sawtooth')),
  sip: () =>
    play('sip', 400, [
      { from: 700, to: 250, duration: 0.5, type: 'sawtooth', volume: 0.035, delay: 0.55 },
      { from: 520, to: 220, duration: 0.4, type: 'triangle', volume: 0.03, delay: 0.9 },
    ]),
  pour: () =>
    play('pour', 400, [{ from: 300, to: 600, duration: 0.7, type: 'sine', volume: 0.04 }]),
  win: () => play('twin', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
  lose: () => play('tlose', 500, arpeggio([392, 330, 262, 196], 0.12, 'sawtooth')),
}
