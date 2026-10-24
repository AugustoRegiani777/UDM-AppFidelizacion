// Avance de la sala de juegos (práctica sin premio). Vive solo en este dispositivo: no da puntos
// ni premios, así que no hace falta guardarlo en el servidor. Si el almacenamiento falla, se juega igual.

import { STAGE_COUNT, clampStage } from '@engine/config.ts'

const KEY = 'arcade_survivors_unlocked'

/** Nivel más alto que se puede jugar (empieza en 1). */
export function unlockedStage(): number {
  try {
    const value = Number(localStorage.getItem(KEY))
    return Number.isFinite(value) && value >= 1 ? clampStage(value) : 1
  } catch {
    return 1
  }
}

/** Ganar un nivel abre el siguiente. Devuelve el nivel más alto abierto. */
export function unlockAfterWin(stage: number): number {
  const next = Math.min(STAGE_COUNT, clampStage(stage) + 1)
  const current = unlockedStage()
  if (next <= current) return current
  try {
    localStorage.setItem(KEY, String(next))
  } catch {
    // sin almacenamiento: el avance no se guarda, pero el juego sigue andando
  }
  return next
}

const RACING_KEY = 'arcade_racing_unlocked'
const RACING_TRACKS = 3

/** Pista más alta que se puede correr (empieza en 1). */
export function unlockedTrack(): number {
  try {
    const value = Number(localStorage.getItem(RACING_KEY))
    return Number.isFinite(value) && value >= 1 ? Math.min(RACING_TRACKS, Math.floor(value)) : 1
  } catch {
    return 1
  }
}

/** Subir al podio abre la pista siguiente. Devuelve la pista más alta abierta. */
export function unlockRacing(track: number): number {
  const next = Math.min(RACING_TRACKS, Math.max(1, Math.floor(track)) + 1)
  const current = unlockedTrack()
  if (next <= current) return current
  try {
    localStorage.setItem(RACING_KEY, String(next))
  } catch {
    // sin almacenamiento: el avance no se guarda, pero el juego sigue andando
  }
  return next
}
