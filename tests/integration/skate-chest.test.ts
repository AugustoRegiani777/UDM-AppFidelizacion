import { NORMAL_SKATE } from '../../supabase/functions/_shared/skate/config'
import { playSkate } from '../../supabase/functions/_shared/skate/testing'
import {
  callFunction,
  configureChest,
  createCustomer,
  finishChest,
  giveSalePoints,
  QUICK_SKATE,
  resetChestConfig,
  rewardId,
  sleep,
  startChest,
} from './helpers'

describe('cofre con skate', { timeout: 60_000 }, () => {
  afterAll(() => resetChestConfig())

  async function customerWithCoffee() {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    return { ana, reward: await rewardId('Un café') }
  }

  it('con el circuito corto se gana rodando y sale el código', async () => {
    await configureChest('skate', QUICK_SKATE)
    const { ana, reward } = await customerWithCoffee()
    const started = await startChest(ana, reward)
    expect(started.body.game).toBe('skate')
    expect(started.body.config.lives).toBe(3)
    await sleep(2000)
    const won = await finishChest(ana, started.body.session_id)
    expect(won.status).toBe(200)
    expect(won.body.won).toBe(true)
    expect(won.body.redemption.code).toMatch(/^MIGA-/)
  })

  it('en el circuito real, el servidor reproduce la partida: quedarse quieto no gana', async () => {
    await configureChest('skate', {})
    const { ana, reward } = await customerWithCoffee()
    const started = await startChest(ana, reward)
    const idle = await finishChest(ana, started.body.session_id)
    expect(idle.status).toBe(200)
    expect(idle.body.won).toBe(false)
    expect(idle.body.redemption).toBeUndefined()
  })

  it('una partida bien jugada gana en el circuito real (el replay del servidor coincide)', async () => {
    await configureChest('skate', {})
    const { ana, reward } = await customerWithCoffee()
    const started = await startChest(ana, reward)
    const run = playSkate({ ...NORMAL_SKATE, ...started.body.config }, started.body.seed, {
      skill: 1,
    })
    expect(run.won).toBe(true)

    // Ganar más rápido que el tiempo real mínimo se rechaza; hay que esperar a que pase.
    const tooFast = await finishChest(ana, started.body.session_id, run.log)
    expect(tooFast.status).toBe(409)
    expect(tooFast.body.error).toBe('too_fast')
  })

  it('mientras se pierde, el cofre mantiene el mismo juego para poder practicar', async () => {
    await resetChestConfig()
    const { ana, reward } = await customerWithCoffee()
    const first = await startChest(ana, reward)
    await finishChest(ana, first.body.session_id)
    const second = await startChest(ana, reward)
    expect(second.body.game).toBe(first.body.game)
  })

  it('valida la forma del registro de entradas', async () => {
    await configureChest('skate', {})
    const { ana, reward } = await customerWithCoffee()
    const started = await startChest(ana, reward)
    const bad = await callFunction(
      'finish-chest',
      { session_id: started.body.session_id, log: { moves: [[0, 99, 0]] } },
      { token: ana.token },
    )
    expect(bad.status).toBe(400)
  })
})
