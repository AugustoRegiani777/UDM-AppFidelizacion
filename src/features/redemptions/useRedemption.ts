import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchRedemption, renewRedemption } from './redemptionApi'

const POLL_MS = 3000

/** El código se consulta cada pocos segundos mientras está activo, para ver cuándo la caja lo usa. */
export function useRedemption(id: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['redemption', id],
    queryFn: () => fetchRedemption(id),
    refetchInterval: (q) => (q.state.data?.status === 'active' ? POLL_MS : false),
  })

  const status = query.data?.status
  useEffect(() => {
    if (status === 'used' || status === 'expired') {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }, [status, queryClient])

  return query
}

export function useRenewRedemption() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: renewRedemption,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })
}

/** Milisegundos que faltan hasta `expiresAt`, contados en vivo (el vencimiento es real). */
export function useCountdown(expiresAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return expiresAt ? Math.max(new Date(expiresAt).getTime() - now, 0) : 0
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
