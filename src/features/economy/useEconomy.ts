import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { queryKeys } from '@/lib/queryKeys'
import { fetchBoard, fetchPointsBoard, fetchWallet, type RankedGame } from './economyApi'

/** Billetera del cliente: puntos para gastar, monedas de juego y pases de desafío. */
export function useWallet() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: queryKeys.wallet(userId ?? 'anon'),
    enabled: Boolean(userId),
    queryFn: fetchWallet,
  })
}

/** Ranking de un juego (y nivel), o el general por puntos acumulados cuando `game` es 'points'. */
export function useBoard(game: RankedGame | 'points', stage: number) {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: queryKeys.board(userId ?? 'anon', game, stage),
    enabled: Boolean(userId),
    queryFn: () => (game === 'points' ? fetchPointsBoard() : fetchBoard(game, stage)),
  })
}
