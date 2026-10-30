import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  /** El tajo en el aire (se limita para no saturar). */
  whoosh: () =>
    play('whoosh', 130, [{ from: 1500, to: 420, duration: 0.09, type: 'sawtooth', volume: 0.025 }]),
  /** Más agudo cuanto más larga la racha. */
  cut: (combo: number) => {
    const base = 480 + Math.min(combo, 20) * 28
    play('cut', 30, [
      { from: base, to: base * 0.55, duration: 0.09, type: 'square', volume: 0.05 },
      { from: base * 2, to: base, duration: 0.05, type: 'triangle', volume: 0.04 },
    ])
  },
  combo: (n: number) =>
    play(
      'combo',
      120,
      arpeggio(
        [523, 659, 784, 1047]
          .slice(0, Math.min(4, Math.max(2, n - 1)))
          .map((f) => f * (1 + (n > 5 ? 0.12 : 0))),
        0.06,
      ),
    ),
  bomb: () => {
    play('bomb', 200, [
      { from: 220, to: 50, duration: 0.35, type: 'sawtooth', volume: 0.09 },
      { from: 90, to: 40, duration: 0.3, type: 'square', volume: 0.06, delay: 0.05 },
    ])
  },
  miss: () =>
    play('miss', 150, [{ from: 260, to: 150, duration: 0.18, type: 'triangle', volume: 0.07 }]),
  life: () => play('life', 300, arpeggio([659, 988], 0.08)),
  frenzy: () => play('frenzy', 400, arpeggio([523, 659, 784, 1047, 1319], 0.06, 'square')),
  freeze: () =>
    play('freeze', 400, [{ from: 1200, to: 280, duration: 0.6, type: 'sine', volume: 0.08 }]),
  goal: () => play('goal', 400, arpeggio([784, 988, 1175], 0.08)),
  end: () => play('end', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
}
