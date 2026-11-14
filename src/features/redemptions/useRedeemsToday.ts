import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

/** Tope diario de canjes (el servidor lo hace valer; acá solo se usa para avisar a tiempo). */
export const DAILY_REDEEM_LIMIT = 2
const TIMEZONE = 'Europe/Madrid'

const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })

/** Canjes (vigentes o usados) que el cliente hizo hoy, en el día del local. Lee lo suyo por RLS. */
export function useRedeemsToday() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['redeems-today', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const since = new Date(Date.now() - 36 * 3_600_000).toISOString()
      const { data, error } = await supabase
        .from('redemptions')
        .select('created_at')
        .in('status', ['active', 'used'])
        .gte('created_at', since)
      if (error) throw error
      const today = dayKey(new Date())
      return data.filter((row) => dayKey(new Date(row.created_at)) === today).length
    },
  })
}

/** true cuando ya se sabe que se alcanzó el tope de hoy. */
export function useDailyLimitReached(): boolean {
  const count = useRedeemsToday().data
  return count !== undefined && count >= DAILY_REDEEM_LIMIT
}
