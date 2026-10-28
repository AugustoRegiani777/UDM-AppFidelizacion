import { RunError } from '@/features/economy/economyApi'
import { copy } from '@/copy'

/** Texto amable para lo que pueda salir mal al abrir o cerrar una partida oficial. */
export function runErrorText(error: unknown): string {
  if (error instanceof RunError) {
    if (error.code === 'too_fast') return copy.economy.errorTooFast
    if (error.code === 'rate_limited') return copy.economy.errorRateLimited
  }
  return copy.economy.errorBody
}
