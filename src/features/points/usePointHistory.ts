import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 20

export interface PointMovement {
  id: string
  kind: string
  points: number
  created_at: string
}

/** Historial completo del libro de puntos, de a páginas. La RLS garantiza que solo vienen los propios. */
export function usePointHistory() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useInfiniteQuery({
    queryKey: ['point-history', userId],
    enabled: Boolean(userId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<PointMovement[]> => {
      const { data, error } = await supabase
        .from('point_movements')
        .select('id, kind, points, created_at')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)
      if (error) throw error
      return data
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  })
}
