import { supabase } from '@/lib/supabase'

export interface RenewedRedemption {
  id: string
  code: string
  expires_at: string
  reward_name: string
}

/** Renueva un código vencido sin volver a jugar el cofre. */
export async function renewRedemption(redemptionId: string): Promise<RenewedRedemption> {
  const { data, error } = await supabase.functions.invoke<RenewedRedemption>('renew-redemption', {
    body: { redemption_id: redemptionId },
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}

export interface RedemptionDetail {
  id: string
  code: string
  status: 'active' | 'used' | 'expired'
  expires_at: string
  reward_id: string
  reward: { name: string; description: string } | null
}

export async function fetchRedemption(id: string): Promise<RedemptionDetail | null> {
  const { data, error } = await supabase
    .from('redemptions')
    .select('id, code, status, expires_at, reward_id, reward:rewards(name, description)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as RedemptionDetail | null
}
