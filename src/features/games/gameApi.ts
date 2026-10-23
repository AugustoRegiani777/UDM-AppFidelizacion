import { useQuery } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

export type GameName = 'scratch' | 'roulette'

export interface Prize {
  id: string
  label: string
  points: number
  weight: number
}

export interface GamesConfig {
  daily_points_budget: number
  scratch: { enabled: boolean; valid_hours: number; prizes: Prize[] }
  roulette: { enabled: boolean; daily_limit: number; prizes: Prize[] }
}

export interface PlayResult {
  play_id: string
  game: GameName
  prize_id: string
  points: number
  balance: number
  repeat: boolean
}

export class DailyLimitError extends Error {}

/** El servidor decide el resultado; la pantalla solo lo "actúa" con la animación. */
export async function playGame(game: GameName, refId?: string): Promise<PlayResult> {
  const { data, error } = await supabase.functions.invoke<PlayResult>('play-game', {
    body: { game, ref_id: refId },
  })
  if (error instanceof FunctionsHttpError && error.context.status === 409)
    throw new DailyLimitError()
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}

/** Premios y probabilidades vigentes (son públicos: se muestran en "¿Cómo funciona?"). */
export function useGamesConfig() {
  return useQuery({
    queryKey: ['games-config'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'games')
        .single()
      if (error) throw error
      return data.value as unknown as GamesConfig
    },
  })
}

export interface GamesStatus {
  roulette: { enabled: boolean; available: boolean; plays_today: number; daily_limit: number }
  scratch_claim_id: string | null
}

export function useGamesStatus() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['games-status', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('games_status')
      if (error) throw error
      return data as unknown as GamesStatus
    },
  })
}

/** Porcentaje real de cada premio según sus pesos. */
export function prizeOdds(prizes: Prize[]): { prize: Prize; percent: number }[] {
  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0)
  return prizes.map((prize) => ({ prize, percent: (prize.weight / total) * 100 }))
}
