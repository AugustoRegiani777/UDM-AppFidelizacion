import { randomUUID } from 'node:crypto'
import {
  callFunction,
  configureRanked,
  createCustomer,
  giveSalePoints,
  QUICK_GAME,
  resetChestConfig,
  rewardId,
  sleep,
  startChest,
} from './helpers'

const startRun = (token: string | null, body: unknown) =>
  callFunction('start-run', body, { token })
const finishRun = (token: string | null, runId: string, log: unknown = { moves: [], picks: [] }) =>
  callFunction('finish-run', { run_id: runId, log }, { token })

describe('partidas oficiales', { timeout: 60_000 }, () => {
  afterAll(async () => {
    await configureRanked({})
    await resetChestConfig()
  })

  it('pide sesión y valida el juego', async () => {
    expect((await startRun(null, { game: 'survivors', stage: 1 })).status).toBe(401)
    const ana = await createCustomer('ana')
    expect((await startRun(ana.token, { game: 'truco', stage: 1 })).status).toBe(400)
    expect((await finishRun(ana.token, 'no-es-un-uuid')).status).toBe(400)
    expect((await finishRun(ana.token, randomUUID())).status).toBe(404)
  })

  it('el servidor fija la semilla y las reglas, y el nivel se acota', async () => {
    await configureRanked({})
    const ana = await createCustomer('ana')
    const started = await startRun(ana.token, { game: 'survivors', stage: 99 })
    expect(started.status).toBe(200)
    expect(started.body).toMatchObject({ game: 'survivors', stage: 6 })
    expect(started.body.config).toMatchObject({ durationSeconds: 60, stage: 6 })
    expect(typeof started.body.seed).toBe('number')
  })

  it('ganar da monedas y un pase, y la partida no se puede cerrar dos veces', async () => {
    await configureRanked(QUICK_GAME)
    const ana = await createCustomer('ana')
    const started = await startRun(ana.token, { game: 'survivors', stage: 1 })
    await sleep(2000)

    const won = await finishRun(ana.token, started.body.run_id)
    expect(won.status).toBe(200)
    expect(won.body).toMatchObject({ won: true, coins: 15, pass_granted: true, stage: 1 })

    expect((await finishRun(ana.token, started.body.run_id)).status).toBe(409)

    const { data: wallet } = await ana.client.rpc('my_wallet')
    expect(wallet).toMatchObject({ coins: 15, passes: 1, spendable: 0 })
  })

  it('terminar antes del tiempo real de la partida se rechaza', async () => {
    await configureRanked({ ...QUICK_GAME, durationSeconds: 5 })
    const ana = await createCustomer('ana')
    const started = await startRun(ana.token, { game: 'survivors', stage: 1 })
    const rushed = await finishRun(ana.token, started.body.run_id)
    expect(rushed.status).toBe(409)
    expect(rushed.body.error).toBe('too_fast')
  })

  it('perder tampoco se puede "farmear": una derrota instantánea no cuenta', async () => {
    await configureRanked({})
    const ana = await createCustomer('ana')
    const started = await startRun(ana.token, { game: 'survivors', stage: 1 })
    // Quedarse quieto pierde, pero esa partida dura decenas de segundos reales.
    const instant = await finishRun(ana.token, started.body.run_id)
    expect(instant.status).toBe(409)
    expect(instant.body.error).toBe('too_fast')
    const { data: wallet } = await ana.client.rpc('my_wallet')
    expect(wallet).toMatchObject({ coins: 0, passes: 0 })
  })

  it('un pase guardado abre el cofre sin volver a jugar', async () => {
    await configureRanked(QUICK_GAME)
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const started = await startRun(ana.token, { game: 'survivors', stage: 1 })
    await sleep(2000)
    expect((await finishRun(ana.token, started.body.run_id)).body.pass_granted).toBe(true)

    const chest = await startChest(ana, await rewardId('Un café'))
    expect(chest.status).toBe(200)
    expect(chest.body).toMatchObject({ already_unlocked: true, via_pass: true })
    expect(typeof chest.body.redemption_id).toBe('string')

    const { data: wallet } = await ana.client.rpc('my_wallet')
    expect(wallet).toMatchObject({ passes: 0 })
  })

  it('el ranking muestra a quien ganó, con nombre e inicial, y respeta quien se oculta', async () => {
    await configureRanked(QUICK_GAME)
    const ana = await createCustomer('ana', 'Ana María Pérez')
    const started = await startRun(ana.token, { game: 'survivors', stage: 1 })
    await sleep(2000)
    await finishRun(ana.token, started.body.run_id)

    const { data } = await ana.client.rpc('leaderboard', { p_game: 'survivors', p_stage: 1 })
    const board = data as unknown as { rows: { name: string; me: boolean }[]; me: { rank: number } }
    expect(board.me.rank).toBeGreaterThanOrEqual(1)
    expect(board.rows.find((row) => row.me)?.name).toBe('Ana P.')

    // Otro cliente no ve a Ana si ella se oculta.
    await ana.client.rpc('set_show_in_rankings', { p_show: false })
    const beto = await createCustomer('beto', 'Beto Gómez')
    const { data: seenByBeto } = await beto.client.rpc('leaderboard', {
      p_game: 'survivors',
      p_stage: 1,
    })
    const names = (seenByBeto as unknown as { rows: { name: string }[] }).rows.map((r) => r.name)
    expect(names).not.toContain('Ana P.')
  })

  it('un cliente no puede abrir ni cerrar partidas por su cuenta (solo vía las funciones)', async () => {
    const ana = await createCustomer('ana')
    const { error } = await ana.client.rpc('start_run' as never, {
      p_customer: ana.id,
      p_game: 'survivors',
      p_stage: 1,
    } as never)
    expect(error).not.toBeNull()
    const { data } = await ana.client.from('game_runs').select('id')
    expect(data).toEqual([])
  })
})
