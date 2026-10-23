import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

/** ¿El usuario es administrador? Solo sirve para mostrar u ocultar pantallas: el servidor vuelve a chequearlo siempre. */
export function useIsAdmin() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['is-admin', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data
    },
  })
}

export interface PendingMission {
  id: string
  mission: string
  note: string | null
  display_name: string
  created_at: string
}

export function usePendingMissions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-pending-missions'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pending_missions')
      if (error) throw error
      return data as PendingMission[]
    },
  })
}

export async function reviewMission(claimId: string, approve: boolean) {
  const { error } = await supabase.rpc('admin_review_mission', {
    p_claim: claimId,
    p_approve: approve,
  })
  if (error) throw error
}
