// Reconciliación contra el POS, disparada por pg_cron cada 5 minutos (docs/02).
//  - Reintenta las ventas pendientes (la tablet es offline-first y puede sincronizar tarde).
//  - Detecta ventas ya acreditadas que se anularon después y descuenta sus puntos.
//  - Vence pendientes, códigos de canje y limpia contadores.
import { adminClient } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { createPosAdapter, type PosSale } from '../_shared/pos-adapter.ts'
import { sameSecret } from '../_shared/secret.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    if (
      !sameSecret(
        req.headers.get('x-reconcile-secret') ?? '',
        Deno.env.get('RECONCILE_SECRET') ?? '',
      )
    ) {
      throw new HttpError(401, 'unauthorized')
    }

    const db = adminClient()
    const pos = createPosAdapter(db)
    const summary = { checked: 0, confirmed: 0, rejected: 0, reversed: 0, pos_errors: 0 }

    const { data: candidates, error } = await db.rpc('reconcile_candidates')
    if (error) throw error

    for (const claim of candidates ?? []) {
      summary.checked++
      let sale: PosSale | null
      try {
        sale = await pos.getSale(claim.sale_uuid)
      } catch (posError) {
        summary.pos_errors++
        console.error('pos_unavailable', posError instanceof Error ? posError.message : 'unknown')
        continue
      }

      if (claim.status === 'pending') {
        if (!sale) continue // sigue sin aparecer; vence por tiempo en reconcile_maintenance
        const { data, error: applyError } = await db.rpc('claim_sale_apply', {
          p_customer: claim.customer_id,
          p_sale_uuid: claim.sale_uuid,
          p_sale: {
            total_cents: sale.total_cents,
            sold_at: sale.sold_at,
            voided: sale.voided,
            channel: sale.channel,
          },
        })
        if (applyError) throw applyError
        if (data.status === 'confirmed') summary.confirmed++
        else summary.rejected++
      } else if (sale?.voided) {
        const { data: reversed, error: reverseError } = await db.rpc('reverse_claim', {
          p_sale_uuid: claim.sale_uuid,
        })
        if (reverseError) throw reverseError
        if (reversed) summary.reversed++
      }
    }

    const { data: maintenance, error: maintenanceError } = await db.rpc('reconcile_maintenance')
    if (maintenanceError) throw maintenanceError
    return json({ ...summary, maintenance })
  } catch (error) {
    return errorResponse(error)
  }
})
