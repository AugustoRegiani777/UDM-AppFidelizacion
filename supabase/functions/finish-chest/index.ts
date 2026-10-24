// El cliente manda las entradas de su partida. El servidor la REPRODUCE con la misma simulación
// y recién si el resultado es victoria emite el código de canje (regla de oro 1).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { isChestGame, isValidGameLog, replayGame } from '../_shared/chest-games.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUSINESS_ERRORS: Record<string, HttpError> = {
  session_not_found: new HttpError(404, 'session_not_found'),
  session_closed: new HttpError(409, 'session_closed'),
  session_expired: new HttpError(410, 'session_expired'),
  too_fast: new HttpError(409, 'too_fast'),
  reward_not_reached: new HttpError(409, 'reward_not_reached'),
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { session_id: sessionId, log } = await req.json().catch(() => ({}))
    if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
      throw new HttpError(400, 'invalid_session_id')
    }

    const db = adminClient()
    const { data: session, error: sessionError } = await db.rpc('get_chest_session', {
      p_customer: user.id,
      p_session: sessionId,
    })
    if (sessionError) throw sessionError
    if (!session) throw new HttpError(404, 'session_not_found')

    if (!isChestGame(session.game)) throw new HttpError(500, 'invalid_game')
    if (!isValidGameLog(session.game, log)) throw new HttpError(400, 'invalid_log')

    // Se reproduce con las reglas y la semilla que el servidor guardó al abrir la sesión.
    const outcome = replayGame(
      session.game,
      session.overrides,
      session.relaxed,
      Number(session.seed),
      log,
    )

    const { data, error } = await db.rpc('finish_chest', {
      p_customer: user.id,
      p_session: sessionId,
      p_won: outcome.won,
      p_min_seconds: outcome.minSeconds,
      p_summary: outcome.summary,
    })
    const known = error && BUSINESS_ERRORS[error.message]
    if (known) throw known
    if (error) throw error
    return json({ ...data, game: session.game, summary: outcome.summary })
  } catch (error) {
    return errorResponse(error)
  }
})
