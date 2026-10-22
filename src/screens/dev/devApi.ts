// SOLO DESARROLLO: llama a las funciones dev-* que simulan la tablet y la caja del POS.
import { supabase } from '@/lib/supabase'

export interface MockSaleInput {
  total_cents: number
  channel: 'local' | 'glovo' | 'togoo'
  minutes_ago: number
  delay_seconds: number
  voided: boolean
}

export async function createMockSale(input: MockSaleInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ sale_uuid: string }>('dev-mock-sale', {
    body: input,
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data.sale_uuid
}

export async function voidMockSale(saleUuid: string): Promise<void> {
  const { error } = await supabase.functions.invoke('dev-mock-sale', {
    body: { action: 'void', sale_uuid: saleUuid },
  })
  if (error) throw error
}

export interface PosValidation {
  valid: boolean
  reason?: string
  reward?: { id: string; name: string; kind: string }
  customer_name?: string
}

/** La caja falsa valida un código con firma HMAC (lo firma el servidor, nunca el navegador). */
export async function validateAsPos(code: string): Promise<PosValidation> {
  const { data, error } = await supabase.functions.invoke<PosValidation>('dev-pos-redeem', {
    body: { code },
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}
