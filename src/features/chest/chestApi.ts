import { FunctionsHttpError } from '@supabase/supabase-js'
import type { GameConfig } from '@engine/config.ts'
import { supabase } from '@/lib/supabase'

export class RewardNotReachedError extends Error {}

export type ChestGameName = 'survivors'

export type StartChestResult =
  | { already_unlocked: true; redemption_id: string }
  | {
      already_unlocked: false
      session_id: string
      seed: number
      relaxed: boolean
      game: 'survivors'
      config: GameConfig
    }

export interface FinishChestResult {
  won: boolean
  redemption?: { id: string; code: string; expires_at: string; reward_name: string }
  game: ChestGameName
}

async function call<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
  })
  if (error instanceof FunctionsHttpError && error.context.status === 409) {
    const payload = await error.context.json().catch(() => ({}))
    if (payload.error === 'reward_not_reached') throw new RewardNotReachedError()
  }
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}

/** Abre una sesión de juego. El servidor fija la semilla y la dificultad. */
export const startChest = (rewardId: string) =>
  call<StartChestResult>('start-chest', { reward_id: rewardId })

/** Manda las entradas grabadas; el servidor reproduce la partida y decide si se ganó. */
export const finishChest = (sessionId: string, log: unknown) =>
  call<FinishChestResult>('finish-chest', { session_id: sessionId, log })
