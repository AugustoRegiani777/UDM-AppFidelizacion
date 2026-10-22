import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface CreatedRedemption {
  id: string
  code: string
  expires_at: string
  reward_name: string
}

export class RewardNotReachedError extends Error {}

/** Pide el código de canje. El servidor decide si el premio está alcanzado. */
export async function createRedemption(rewardId: string): Promise<CreatedRedemption> {
  const { data, error } = await supabase.functions.invoke<CreatedRedemption>('create-redemption', {
    body: { reward_id: rewardId },
  })
  if (error instanceof FunctionsHttpError && error.context.status === 409) {
    throw new RewardNotReachedError()
  }
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
