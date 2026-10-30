import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: queryKeys.profile(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, promo_consent, program_consent_at, adult_confirmed_at, privacy_accepted_at, terms_accepted_at, legal_version',
        )
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useInvalidateProfile() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['profile'] })
}
