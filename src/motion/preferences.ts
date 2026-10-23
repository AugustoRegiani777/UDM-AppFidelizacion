import { useSyncExternalStore } from 'react'

const SOUND_KEY = 'sound_enabled'
const listeners = new Set<() => void>()

/** El sonido arranca apagado (docs/04) y se prende desde el perfil. */
export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
  } catch {
    // Sin almacenamiento, la preferencia vale solo hasta recargar.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSoundEnabled = () => useSyncExternalStore(subscribe, isSoundEnabled, () => false)
