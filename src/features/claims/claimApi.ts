import { supabase } from '@/lib/supabase'

export interface UnlockedReward {
  id: string
  name: string
  kind: 'points' | 'purchases'
}

export type ClaimResult =
  | {
      status: 'confirmed'
      points: number
      balance: number
      repeat: boolean
      claim_id: string
      unlocked?: UnlockedReward[]
    }
  | { status: 'pending'; points: 0; repeat?: boolean }
  | { status: 'rejected'; reason: string; points: 0 }
  | { status: 'reversed'; points: number; repeat: true }

/** Pide al servidor que sume la venta. El servidor decide todo; acá solo se muestra el resultado. */
export async function claimSale(saleUuid: string): Promise<ClaimResult> {
  const { data, error } = await supabase.functions.invoke<ClaimResult>('claim-sale', {
    body: { sale_uuid: saleUuid },
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}
