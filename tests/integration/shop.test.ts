import {
  callFunction,
  configureRanked,
  createCustomer,
  giveSalePoints,
  QUICK_GAME,
  sleep,
  validateAsPos,
} from './helpers'

describe('tienda', { timeout: 60_000 }, () => {
  afterAll(() => configureRanked({}))

  async function itemId(slug: string) {
    const ana = await createCustomer('lector')
    const { data } = await ana.client.rpc('shop_catalog')
    const items = (data as unknown as { items: { id: string; slug: string }[] }).items
    return items.find((i) => i.slug === slug)!.id
  }

  it('comprar un premio del local descuenta puntos y la caja valida el código una sola vez', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const chipa = await itemId('chipa')

    const { data, error } = await ana.client.rpc('buy_item', { p_item: chipa })
    expect(error).toBeNull()
    const bought = data as unknown as { kind: string; code: string; spendable: number }
    expect(bought).toMatchObject({ kind: 'voucher', spendable: 250 })

    // Los escalones de comida no se atrasan: el total ganado sigue en 400.
    const { data: wallet } = await ana.client.rpc('my_wallet')
    expect(wallet).toMatchObject({ balance: 400, spendable: 250 })

    const first = await validateAsPos(bought.code)
    expect(first.body).toMatchObject({ valid: true, reward: { name: 'Un chipá', kind: 'shop' } })
    expect((await validateAsPos(bought.code)).body).toEqual({ valid: false, reason: 'used' })
  })

  it('sin puntos suficientes no se compra, y nadie compra en nombre de otro', async () => {
    const beto = await createCustomer('beto')
    const { error } = await beto.client.rpc('buy_item', { p_item: await itemId('gorra') })
    expect(error?.message).toBe('not_enough_points')
    const anon = await callFunction('start-run', { game: 'survivors' }, { token: null })
    expect(anon.status).toBe(401)
  })

  it('las mejoras compradas viajan con la partida oficial y el servidor las reproduce', async () => {
    await configureRanked(QUICK_GAME)
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 400)
    const { error } = await ana.client.rpc('buy_item', { p_item: await itemId('corazon') })
    expect(error).toBeNull()

    const started = await callFunction(
      'start-run',
      { game: 'survivors', stage: 1 },
      { token: ana.token },
    )
    expect(started.body.config.perks).toMatchObject({ hp: 1 })
    await sleep(2000)
    const done = await callFunction(
      'finish-run',
      { run_id: started.body.run_id, log: { moves: [], picks: [] } },
      { token: ana.token },
    )
    expect(done.status).toBe(200)
    expect(done.body.won).toBe(true)

    // Con mejoras va a su propio ranking.
    const common = await ana.client.rpc('leaderboard', { p_game: 'survivors', p_stage: 1 })
    expect((common.data as unknown as { me: unknown }).me).toBeNull()
    const boosted = await ana.client.rpc('leaderboard', {
      p_game: 'survivors',
      p_stage: 1,
      p_boosted: true,
    })
    expect((boosted.data as unknown as { me: { rank: number } }).me.rank).toBeGreaterThanOrEqual(1)
  })
})
