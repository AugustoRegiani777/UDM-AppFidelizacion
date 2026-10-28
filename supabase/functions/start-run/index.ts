// El cliente quiere jugar una partida oficial (puntaje en el ranking, monedas y pases): el servidor abre una
// sesión con semilla propia. Lo que cuenta se decide en finish-run, reproduciendo la partida.
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { gameConfig, isChestGame } from '../_shared/chest-games.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    const { game, stage } = await req.json().catch(() => ({}))
    if (!isChestGame(game)) throw new HttpError(400, 'invalid_game')
    const stageNumber = Number.isInteger(stage) ? Number(stage) : 1

    const db = adminClient()
    const { data: allowed, error: limitError } = await db.rpc('rate_limit_hit', {
      p_customer: user.id,
      p_action: 'run',
    })
    if (limitError) throw limitError
    if (!allowed) throw new HttpError(429, 'rate_limited')

    const { data, error } = await db.rpc('start_run', {
      p_customer: user.id,
      p_game: game,
      p_stage: stageNumber,
    })
    if (error?.message === 'invalid_game') throw new HttpError(400, 'invalid_game')
    if (error) throw error

    return json({
      run_id: data.run_id,
      game: data.game,
      stage: data.stage,
      seed: data.seed,
      config: gameConfig(
        data.game,
        { ...data.overrides, stage: data.stage, perks: data.perks },
        false,
      ),
    })
  } catch (error) {
    return errorResponse(error)
  }
})
