// El cliente manda las entradas de su partida oficial. El servidor la REPRODUCE con la misma simulación y
// recién ahí decide el puntaje, las monedas y el pase de desafío (regla de oro 1: el cliente no decide nada).
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
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { run_id: runId, log } = await req.json().catch(() => ({}))
    if (typeof runId !== 'string' || !UUID_RE.test(runId)) {
      throw new HttpError(400, 'invalid_run_id')
    }

    const db = adminClient()
    const { data: run, error: runError } = await db.rpc('get_run', {
      p_customer: user.id,
      p_run: runId,
    })
    if (runError) throw runError
    if (!run) throw new HttpError(404, 'session_not_found')

    if (!isChestGame(run.game)) throw new HttpError(500, 'invalid_game')
    if (!isValidGameLog(run.game, log)) throw new HttpError(400, 'invalid_log')

    // Se reproduce con las reglas y la semilla que el servidor guardó al abrir la partida.
    const outcome = replayGame(
      run.game,
      { ...run.overrides, stage: run.stage },
      false,
      Number(run.seed),
      log,
    )

    const { data, error } = await db.rpc('finish_run', {
      p_customer: user.id,
      p_run: runId,
      p_won: outcome.won,
      p_score: outcome.score,
      // Nadie termina una partida (ganada o perdida) más rápido que lo que dura en tiempo real.
      p_min_seconds: Math.max(outcome.won ? outcome.minSeconds : 0, (outcome.ticks / 60) * 0.85),
      p_summary: outcome.summary,
    })
    const known = error && BUSINESS_ERRORS[error.message]
    if (known) throw known
    if (error) throw error
    return json({ ...data, summary: outcome.summary })
  } catch (error) {
    return errorResponse(error)
  }
})
