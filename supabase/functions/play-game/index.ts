// El cliente juega. El servidor decide el resultado ANTES de que empiece la animación (regla de oro 1).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GAMES = ['scratch', 'roulette']
const BUSINESS_ERRORS: Record<string, HttpError> = {
  game_disabled: new HttpError(404, 'game_disabled'),
  daily_limit_reached: new HttpError(409, 'daily_limit_reached'),
  play_not_available: new HttpError(409, 'play_not_available'),
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { game, ref_id: refId } = await req.json().catch(() => ({}))
    if (!GAMES.includes(game)) throw new HttpError(400, 'invalid_game')
    if (refId != null && (typeof refId !== 'string' || !UUID_RE.test(refId))) {
      throw new HttpError(400, 'invalid_ref_id')
    }

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'play_game',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const { data, error } = await db.rpc('play_game', {
      p_customer: user.id,
      p_game: game,
      p_ref: refId ?? null,
    })
    const known = error && BUSINESS_ERRORS[error.message]
    if (known) throw known
    if (error) throw error
    return json(data)
  } catch (error) {
    return errorResponse(error)
  }
})
