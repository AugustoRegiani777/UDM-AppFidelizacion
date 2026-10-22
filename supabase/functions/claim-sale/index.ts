// El cliente reclama una venta. El servidor consulta al POS y decide los puntos (reglas de oro 1 y 2).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { createPosAdapter, type PosSale } from '../_shared/pos-adapter.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Si el POS no responde, la venta queda pendiente: nunca se le muestra un error seco al cliente. */
async function fetchSale(
  saleUuid: string,
  db: ReturnType<typeof adminClient>,
): Promise<PosSale | null> {
  try {
    return await createPosAdapter(db).getSale(saleUuid)
  } catch (error) {
    console.error('pos_unavailable', error instanceof Error ? error.message : 'unknown')
    return null
  }
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { sale_uuid: saleUuid } = await req.json().catch(() => ({}))
    if (typeof saleUuid !== 'string' || !UUID_RE.test(saleUuid))
      throw new HttpError(400, 'invalid_sale_uuid')

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'claim_sale',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const sale = await fetchSale(saleUuid, db)
    const { data, error } = await db.rpc('claim_sale_apply', {
      p_customer: user.id,
      p_sale_uuid: saleUuid,
      p_sale: sale
        ? {
            total_cents: sale.total_cents,
            sold_at: sale.sold_at,
            voided: sale.voided,
            channel: sale.channel,
          }
        : null,
    })
    if (error) throw error
    return json(data)
  } catch (error) {
    return errorResponse(error)
  }
})
