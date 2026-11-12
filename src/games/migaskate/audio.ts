// Audio procedural de "Miga Skate" (osciladores de Web Audio, sin archivos). Lo dispara SkateJuice.
import { arpeggio, play } from '../shared/audio.ts'

export { unlockAudio } from '../shared/audio.ts'

export const sfx = {
  push: () =>
    play('push', 140, [{ from: 120, to: 90, duration: 0.1, type: 'triangle', volume: 0.05 }]),
  /** El "pop" de la cola: mas fuerte = mas agudo y largo. */
  pop: (power = 0.5) =>
    play('pop', 80, [
      {
        from: 200 + 80 * power,
        to: 520 + 160 * power,
        duration: 0.09,
        type: 'square',
        volume: 0.06,
      },
      { from: 90, to: 60, duration: 0.07, type: 'triangle', volume: 0.05 },
    ]),
  flip: () =>
    play('flip', 120, [{ from: 500, to: 900, duration: 0.16, type: 'triangle', volume: 0.05 }]),
  /** Aterrizaje: ruedas sobre el cemento; `intensity` 0..1, torpe = mas grave y sucio. */
  land: (intensity = 0.5, sloppy = false) =>
    play('land', 80, [
      {
        from: sloppy ? 120 : 160,
        to: 60,
        duration: 0.1 + 0.08 * intensity,
        type: 'square',
        volume: 0.04 + 0.06 * intensity,
      },
      { from: 900, to: 300, duration: 0.05, type: 'sawtooth', volume: 0.02 + 0.02 * intensity },
    ]),
  grind: () =>
    play('grind', 120, [{ from: 1200, to: 800, duration: 0.14, type: 'sawtooth', volume: 0.035 }]),
  /** Raspado continuo del riel: se vuelve a disparar mientras dura el grind. */
  grindLoop: (speed = 4) =>
    play('grindLoop', 100, [
      {
        from: 780 + speed * 40,
        to: 640 + speed * 30,
        duration: 0.2,
        type: 'sawtooth',
        volume: 0.022,
      },
    ]),
  grab: () =>
    play('grab', 120, [{ from: 660, to: 760, duration: 0.1, type: 'triangle', volume: 0.05 }]),
  catch: () =>
    play('catch', 150, [{ from: 420, to: 330, duration: 0.08, type: 'triangle', volume: 0.04 }]),
  bump: () =>
    play('bump', 90, [{ from: 140, to: 60, duration: 0.14, type: 'square', volume: 0.08 }]),
  bail: () =>
    play('bail', 300, [{ from: 330, to: 140, duration: 0.35, type: 'triangle', volume: 0.07 }]),
  trick: () => play('trick', 100, arpeggio([587, 784], 0.06)),
  bank: () => play('bank', 200, arpeggio([523, 659, 784, 1047], 0.07)),
  star: () => play('star', 300, arpeggio([659, 880, 1175, 1568], 0.08)),
}
