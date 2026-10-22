import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { clearPendingSale } from './pendingSale'
import { claimSale } from './claimApi'

const PENDING_RETRY_MS = 10_000

/**
 * Reclama la venta al abrir /s/:uuid. Es idempotente en el servidor, así que repetirlo es seguro:
 * mientras la venta está pendiente se vuelve a consultar sola hasta que aparezca.
 */
export function useClaimSale(saleUuid: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['claim', saleUuid],
    queryFn: () => claimSale(saleUuid),
    retry: false,
    staleTime: Infinity,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? PENDING_RETRY_MS : false),
  })

  const status = query.data?.status
  useEffect(() => {
    if (!status) return
    clearPendingSale()
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [status, queryClient])

  return query
}
