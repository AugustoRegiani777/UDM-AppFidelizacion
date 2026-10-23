// Renueva un código de canje vencido sin volver a jugar (el cliente ya había pasado el juego).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { redemption_id: redemptionId } = await req.json().catch(() => ({}))
    if (typeof redemptionId !== 'string' || !UUID_RE.test(redemptionId)) {
      throw new HttpError(400, 'invalid_redemption_id')
    }

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'chest',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const { data, error } = await db.rpc('renew_redemption', {
      p_customer: user.id,
      p_old: redemptionId,
    })
    if (error?.message === 'not_renewable') throw new HttpError(409, 'not_renewable')
    if (error?.message === 'reward_not_reached') throw new HttpError(409, 'reward_not_reached')
    if (error) throw error
    return json(data)
  } catch (error) {
    return errorResponse(error)
  }
})
