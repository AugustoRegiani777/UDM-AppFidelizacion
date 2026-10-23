import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export interface DashboardReward {
  id: string
  name: string
  description: string
  kind: 'points' | 'purchases'
  threshold: number
  image_url: string | null
  /** Avance hacia el premio (puntos o compras). */
  current: number
  /** Lo que falta (puntos o compras). */
  remaining: number
  /** Cuántas veces se puede canjear ahora (escalones repetibles). */
  available: number
  unlocked: boolean
  active_redemption: { id: string; code: string; expires_at: string } | null
}

export interface DashboardClaim {
  id: string
  status: 'confirmed' | 'pending' | 'reversed'
  points: number
  sale_total_cents: number | null
  sale_at: string | null
  created_at: string
}

/** Forma del JSON que devuelve `customer_dashboard()` (ver supabase/migrations). */
export interface Dashboard {
  profile: { display_name: string; avatar_url: string | null; onboarded: boolean }
  balance: number
  purchase_count: number
  streak_weeks: number
  pending_count: number
  rewards: DashboardReward[]
  recent_claims: DashboardClaim[]
}

export function useDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: queryKeys.dashboard(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('customer_dashboard')
      if (error) throw error
      return data as unknown as Dashboard
    },
  })
}
