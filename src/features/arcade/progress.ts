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
const RACING_TRACKS = 5

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

const COINS_KEY = 'arcade_coins'

/** Monedas de la sala de juegos (no valen nada fuera de ella; sirven para comprar chipás en el truco). */
export function getCoins(): number {
  try {
    const value = Number(localStorage.getItem(COINS_KEY))
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}

function setCoins(value: number) {
  try {
    localStorage.setItem(COINS_KEY, String(value))
  } catch {
    // sin almacenamiento: las monedas no se guardan, pero el juego sigue andando
  }
}

export function addCoins(amount: number): number {
  const total = getCoins() + Math.max(0, Math.floor(amount))
  setCoins(total)
  return total
}

/** Gasta monedas si alcanzan. Devuelve false si no. */
export function spendCoins(amount: number): boolean {
  const current = getCoins()
  if (current < amount) return false
  setCoins(current - amount)
  return true
}

const PARK_KEY = 'arcade_skatepark_stars'
const PARK_LEVELS = 5

/** Estrellas (0..3) que se sacaron en cada nivel de Skate Spot. */
export function parkStars(): number[] {
  const stars = Array.from({ length: PARK_LEVELS }, () => 0)
  try {
    const raw = JSON.parse(localStorage.getItem(PARK_KEY) ?? '[]')
    if (Array.isArray(raw)) {
      raw.slice(0, PARK_LEVELS).forEach((value, i) => {
        const n = Number(value)
        if (Number.isFinite(n)) stars[i] = Math.max(0, Math.min(3, Math.floor(n)))
      })
    }
  } catch {
    // almacenamiento roto o vacío: se empieza de cero
  }
  return stars
}

/** Guarda la mejor marca del nivel. Devuelve las estrellas de todos los niveles. */
export function saveParkStars(level: number, stars: number): number[] {
  const all = parkStars()
  const i = Math.min(PARK_LEVELS, Math.max(1, Math.floor(level))) - 1
  all[i] = Math.max(all[i] ?? 0, Math.max(0, Math.min(3, Math.floor(stars))))
  try {
    localStorage.setItem(PARK_KEY, JSON.stringify(all))
  } catch {
    // sin almacenamiento: no se guarda, pero el juego sigue andando
  }
  return all
}

/** Nivel más alto que se puede jugar: cada estrella abre el siguiente. */
export function unlockedPark(stars: readonly number[] = parkStars()): number {
  let level = 1
  while (level < PARK_LEVELS && (stars[level - 1] ?? 0) >= 1) level++
  return level
}

const SOKOBAN_KEY = 'arcade_sokoban_stars'
const SOKOBAN_LEVELS = 12

/** Estrellas (0..3) de cada nivel de Entregas de Miga. */
export function sokobanStars(): number[] {
  const stars = Array.from({ length: SOKOBAN_LEVELS }, () => 0)
  try {
    const raw = JSON.parse(localStorage.getItem(SOKOBAN_KEY) ?? '[]')
    if (Array.isArray(raw)) {
      raw.slice(0, SOKOBAN_LEVELS).forEach((value, i) => {
        const n = Number(value)
        if (Number.isFinite(n)) stars[i] = Math.max(0, Math.min(3, Math.floor(n)))
      })
    }
  } catch {
    // almacenamiento roto o vacío: se empieza de cero
  }
  return stars
}

/** Guarda la mejor marca del nivel. Devuelve las estrellas de todos los niveles. */
export function saveSokobanStars(level: number, stars: number): number[] {
  const all = sokobanStars()
  const i = Math.min(SOKOBAN_LEVELS, Math.max(1, Math.floor(level))) - 1
  all[i] = Math.max(all[i] ?? 0, Math.max(0, Math.min(3, Math.floor(stars))))
  try {
    localStorage.setItem(SOKOBAN_KEY, JSON.stringify(all))
  } catch {
    // sin almacenamiento: no se guarda, pero el juego sigue andando
  }
  return all
}

/** Nivel más alto que se puede jugar: terminar un nivel (con cualquier cantidad de estrellas) abre el siguiente. */
export function unlockedSokoban(stars: readonly number[] = sokobanStars()): number {
  let level = 1
  while (level < SOKOBAN_LEVELS && (stars[level - 1] ?? 0) >= 1) level++
  return level
}

const SURVIVORS_BEST_KEY = 'arcade_survivors_best'

/** Mejor puntaje por nivel de Sobreviví a las migas (índice 0 = nivel 1). */
export function survivorsBest(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SURVIVORS_BEST_KEY) ?? '[]')
    return Array.from({ length: STAGE_COUNT }, (_, i) => {
      const value = Array.isArray(raw) ? Number(raw[i]) : 0
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
    })
  } catch {
    return Array.from({ length: STAGE_COUNT }, () => 0)
  }
}

/** Guarda el puntaje si supera al mejor del nivel. Devuelve true si es un récord nuevo. */
export function saveSurvivorsBest(stage: number, score: number): boolean {
  const all = survivorsBest()
  const index = clampStage(stage) - 1
  const value = Math.floor(score)
  if (!(value > (all[index] ?? 0))) return false
  all[index] = value
  try {
    localStorage.setItem(SURVIVORS_BEST_KEY, JSON.stringify(all))
  } catch {
    // sin almacenamiento: el récord no se guarda
  }
  return true
}
