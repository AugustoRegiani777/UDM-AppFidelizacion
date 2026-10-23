import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

export type MissionId = 'instagram_follow' | 'google_review'
export type MissionStatus = 'pending' | 'approved' | 'rejected'

export interface MissionConfig {
  points: number
  auto: boolean
  url: string
}

export type MissionsConfig = Record<MissionId, MissionConfig>

export interface MissionClaim {
  mission: MissionId
  status: MissionStatus
  points: number
}

/** Misiones y puntos vigentes (son públicos; el servidor decide cuánto se acredita). */
export function useMissionsConfig() {
  return useQuery({
    queryKey: ['missions-config'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'missions')
        .single()
      if (error) throw error
      return data.value as unknown as MissionsConfig
    },
  })
}

export function useMyMissionClaims() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['mission-claims', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_claims')
        .select('mission, status, points')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as MissionClaim[]
    },
  })
}

export interface ClaimMissionResult {
  status: MissionStatus
  points: number
  balance: number
}

export async function claimMission(mission: MissionId, note?: string): Promise<ClaimMissionResult> {
  const { data, error } = await supabase.rpc('claim_mission', { p_mission: mission, p_note: note })
  if (error) throw error
  return data as unknown as ClaimMissionResult
}

export function useInvalidateMissions() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mission-claims'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}
