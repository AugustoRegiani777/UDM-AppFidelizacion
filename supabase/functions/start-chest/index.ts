// El cliente quiere abrir el cofre de un premio desbloqueado: el servidor abre una sesión de juego
// con semilla propia. El código de canje recién se emite si la partida se gana (finish-chest).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { resolveConfig, type GameConfig } from '../_shared/survivors/config.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { reward_id: rewardId } = await req.json().catch(() => ({}))
    if (typeof rewardId !== 'string' || !UUID_RE.test(rewardId)) {
      throw new HttpError(400, 'invalid_reward_id')
    }

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'chest',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const { data, error } = await db.rpc('start_chest', { p_customer: user.id, p_reward: rewardId })
    if (error?.message === 'reward_not_found') throw new HttpError(404, 'reward_not_found')
    if (error?.message === 'reward_not_reached') throw new HttpError(409, 'reward_not_reached')
    if (error) throw error
    if (data.already_unlocked) return json(data)

    const config: GameConfig = resolveConfig(data.overrides, data.relaxed)
    return json({
      already_unlocked: false,
      session_id: data.session_id,
      seed: data.seed,
      relaxed: data.relaxed,
      config,
    })
  } catch (error) {
    return errorResponse(error)
  }
})
