import { arpeggio, play } from '../shared/audio.ts'
import type { VehicleId } from './themes.ts'

export { unlockAudio } from '../shared/audio.ts'

/** Cada vehículo suena distinto al avanzar. */
const MOVE: Record<VehicleId, () => void> = {
  car: () =>
    play('s-car', 70, [{ from: 110, to: 150, duration: 0.07, type: 'sawtooth', volume: 0.03 }]),
  moto: () =>
    play('s-moto', 70, [{ from: 260, to: 360, duration: 0.07, type: 'sawtooth', volume: 0.025 }]),
  boat: () =>
    play('s-boat', 90, [{ from: 420, to: 180, duration: 0.1, type: 'sine', volume: 0.04 }]),
  heli: () =>
    play('s-heli', 70, [{ from: 90, to: 120, duration: 0.07, type: 'square', volume: 0.025 }]),
}

export const sfx = {
  move: (vehicle: VehicleId) => MOVE[vehicle](),
  push: () =>
    play('s-push', 60, [{ from: 160, to: 80, duration: 0.09, type: 'square', volume: 0.07 }]),
  blocked: () =>
    play('s-blocked', 120, [{ from: 120, to: 90, duration: 0.1, type: 'triangle', volume: 0.05 }]),
  landed: () => play('s-landed', 120, arpeggio([659, 880, 1175], 0.06)),
  undo: () =>
    play('s-undo', 60, [{ from: 520, to: 340, duration: 0.07, type: 'triangle', volume: 0.04 }]),
  restart: () =>
    play('s-restart', 150, [
      { from: 300, to: 200, duration: 0.18, type: 'triangle', volume: 0.05 },
    ]),
  win: () => play('s-win', 500, arpeggio([523, 659, 784, 1047, 1319], 0.09)),
}
