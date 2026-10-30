import { useEffect } from 'react'
import { holdUpdates } from './updateGate'

/** Mientras `active` sea true (un juego en curso), la versión nueva espera a que se salga. */
export function useHoldUpdates(active: boolean) {
  useEffect(() => {
    if (!active) return
    return holdUpdates()
  }, [active])
}
