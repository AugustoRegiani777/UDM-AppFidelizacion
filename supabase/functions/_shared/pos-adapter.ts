// Adaptador del POS (contrato: docs/03). Mock para desarrollo, real firmado con HMAC.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { signedHeaders } from './hmac.ts'

export interface PosSale {
  uuid: string
  total_cents: number
  sold_at: string
  voided: boolean
  channel: 'local' | 'glovo' | 'togoo'
}

export interface PosAdapter {
  /** null = el POS no conoce la venta (o todavía no sincronizó). */
  getSale(saleUuid: string): Promise<PosSale | null>
}

/** Lee ventas falsas de `dev_mock_sales`; una venta "aparece" cuando visible_from <= ahora. */
export function createMockAdapter(db: SupabaseClient): PosAdapter {
  return {
    async getSale(saleUuid) {
      const { data, error } = await db
        .from('dev_mock_sales')
        .select('uuid, total_cents, sold_at, voided, channel')
        .eq('uuid', saleUuid)
        .lte('visible_from', new Date().toISOString())
        .maybeSingle()
      if (error) throw error
      return data as PosSale | null
    },
  }
}

/** Llama a `loyalty-sale` del POS (endpoint A del contrato). */
export function createRealAdapter(
  baseUrl: string,
  hmacSecret: string,
  fetchFn: typeof fetch = fetch,
): PosAdapter {
  return {
    async getSale(saleUuid) {
      const body = JSON.stringify({ sale_uuid: saleUuid })
      const response = await fetchFn(`${baseUrl}/.netlify/functions/loyalty-sale`, {
        method: 'POST',
        headers: await signedHeaders(hmacSecret, body),
        body,
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error(`pos_http_${response.status}`)
      const payload = await response.json()
      return payload.found ? (payload.sale as PosSale) : null
    },
  }
}

export function createPosAdapter(db: SupabaseClient): PosAdapter {
  const mode = Deno.env.get('POS_MODE') ?? 'mock'
  if (mode === 'mock') return createMockAdapter(db)
  const baseUrl = Deno.env.get('POS_BASE_URL')
  const secret = Deno.env.get('POS_HMAC_SECRET')
  if (!baseUrl || !secret) throw new Error('pos_not_configured')
  return createRealAdapter(baseUrl, secret)
}
