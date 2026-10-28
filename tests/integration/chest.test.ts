import { randomUUID } from 'node:crypto'
import {
  callFunction,
  createCustomer,
  finishChest,
  giveSalePoints,
  QUICK_GAME,
  rewardId,
  resetChestConfig,
  setChestOverrides,
  sleep,
  startChest,
} from './helpers'

describe('cofre con juego', () => {
  afterAll(() => resetChestConfig())

  it('no abre el cofre si el premio no está alcanzado', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 100)
    const denied = await startChest(ana, await rewardId('Un café'))
    expect(denied.status).toBe(409)
    expect(denied.body.error).toBe('reward_not_reached')
  })

  it('el servidor reproduce la partida: un cliente que dice haber ganado sin jugar no recibe código', async () => {
    await setChestOverrides({})
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const started = await startChest(ana, await rewardId('Un café'))
    expect(started.body).toMatchObject({ already_unlocked: false, relaxed: false })
    expect(started.body.config.durationSeconds).toBeGreaterThan(30)

    // Registro vacío = nunca se movió. La partida de verdad se pierde.
    const fake = await finishChest(ana, started.body.session_id)
    expect(fake.status).toBe(200)
    expect(fake.body.won).toBe(false)
    expect(fake.body.redemption).toBeUndefined()
  })

  it('ganar antes del tiempo real de la partida se rechaza', async () => {
    await setChestOverrides({ ...QUICK_GAME, durationSeconds: 5 })
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const started = await startChest(ana, await rewardId('Un café'))
    const rushed = await finishChest(ana, started.body.session_id)
    expect(rushed.status).toBe(409)
    expect(rushed.body.error).toBe('too_fast')
  })

  it('pasar el juego emite el código y la sesión no se reutiliza', async () => {
    await setChestOverrides(QUICK_GAME)
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const reward = await rewardId('Un café')
    const started = await startChest(ana, reward)
    await sleep(2000)

    const won = await finishChest(ana, started.body.session_id)
    expect(won.status).toBe(200)
    expect(won.body.won).toBe(true)
    expect(won.body.redemption.code).toMatch(/^MIGA-/)

    expect((await finishChest(ana, started.body.session_id)).status).toBe(409)
    // Con el código vigente no hace falta jugar de nuevo.
    expect((await startChest(ana, reward)).body).toMatchObject({ already_unlocked: true })
  })

  it('después de dos derrotas se ofrece el modo relajado', async () => {
    await setChestOverrides({})
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const reward = await rewardId('Un café')
    for (let i = 0; i < 2; i++) {
      const started = await startChest(ana, reward)
      expect(started.body.relaxed).toBe(false)
      await finishChest(ana, started.body.session_id)
    }
    const third = await startChest(ana, reward)
    expect(third.body.relaxed).toBe(true)
    expect(third.body.config.enemySpeedMul).toBeLessThan(1)
  })

  it('valida la forma del pedido y que la sesión sea propia', async () => {
    await setChestOverrides({})
    const [ana, beto] = await Promise.all([createCustomer('ana'), createCustomer('beto')])
    await giveSalePoints(ana, 400)
    const started = await startChest(ana, await rewardId('Un café'))

    const badLog = await callFunction(
      'finish-chest',
      { session_id: started.body.session_id, log: { moves: [[0, 99]], picks: [] } },
      { token: ana.token },
    )
    expect(badLog.status).toBe(400)
    expect((await finishChest(beto, started.body.session_id)).status).toBe(404)
    expect((await finishChest(ana, randomUUID())).status).toBe(404)
    expect(
      (await callFunction('finish-chest', { session_id: 'x', log: {} }, { token: null })).status,
    ).toBe(401)
  })

  it('el cliente no puede saltarse el juego llamando directo a la base', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const reward = await rewardId('Un café')
    for (const fn of ['issue_redemption', 'start_chest', 'finish_chest', 'renew_redemption']) {
      const attempt = await ana.client.rpc(
        fn as never,
        { p_customer: ana.id, p_reward: reward } as never,
      )
      expect(attempt.error).not.toBeNull()
    }
    expect((await ana.client.from('redemptions').select('id')).data).toEqual([])
  })
})
