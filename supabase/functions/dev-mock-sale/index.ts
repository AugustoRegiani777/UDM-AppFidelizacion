// SOLO DESARROLLO: simula la tablet del POS creando ventas falsas (docs/03, modo mock).
// Responde 404 salvo que DEV_ENDPOINTS=true, variable que solo existe en supabase/functions/.env local.
import { adminClient } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'

const CHANNELS = ['local', 'glovo', 'togoo']

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (Deno.env.get('DEV_ENDPOINTS') !== 'true' || Deno.env.get('POS_MODE') !== 'mock') {
      throw new HttpError(404, 'not_found')
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')

    const body = await req.json().catch(() => ({}))
    const db = adminClient()

    if (body.action === 'void') {
      const { error } = await db
        .from('dev_mock_sales')
        .update({ voided: true })
        .eq('uuid', body.sale_uuid)
      if (error) throw error
      return json({ voided: true })
    }

    const totalCents = Number(body.total_cents ?? 1240)
    const channel = body.channel ?? 'local'
    if (!Number.isInteger(totalCents) || totalCents < 0 || !CHANNELS.includes(channel)) {
      throw new HttpError(400, 'invalid_sale')
    }
    const now = Date.now()
    const { data, error } = await db
      .from('dev_mock_sales')
      .insert({
        total_cents: totalCents,
        channel,
        voided: Boolean(body.voided),
        sold_at: new Date(now - Number(body.minutes_ago ?? 0) * 60_000).toISOString(),
        // Con delay_seconds la venta "aparece" más tarde, como si la tablet estuviera offline.
        visible_from: new Date(now + Number(body.delay_seconds ?? 0) * 1000).toISOString(),
      })
      .select('uuid')
      .single()
    if (error) throw error
    return json({ sale_uuid: data.uuid })
  } catch (error) {
    return errorResponse(error)
  }
})
