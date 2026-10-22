// El cliente pide el código de canje de un premio alcanzado. El servidor decide si corresponde.
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
    const { reward_id: rewardId } = await req.json().catch(() => ({}))
    if (typeof rewardId !== 'string' || !UUID_RE.test(rewardId))
      throw new HttpError(400, 'invalid_reward_id')

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'create_redemption',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const { data, error } = await db.rpc('create_redemption', {
      p_customer: user.id,
      p_reward: rewardId,
    })
    if (error?.message === 'reward_not_found') throw new HttpError(404, 'reward_not_found')
    if (error?.message === 'reward_not_reached') throw new HttpError(409, 'reward_not_reached')
    if (error) throw error
    return json(data)
  } catch (error) {
    return errorResponse(error)
  }
})
