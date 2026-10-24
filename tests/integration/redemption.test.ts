import {
  admin,
  balanceOf,
  callFunction,
  createCustomer,
  giveSalePoints,
  openChest,
  QUICK_GAME,
  rewardId,
  resetChestConfig,
  setChestOverrides,
  validateAsPos,
} from './helpers'

describe('canje de premios (caja)', () => {
  beforeAll(() => setChestOverrides(QUICK_GAME))
  afterAll(() => resetChestConfig())

  it('flujo completo: el código sale al pasar el juego, la caja lo valida y los puntos NO se gastan', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)

    const code = await openChest(ana, await rewardId('Un café'))
    expect(code.status).toBe(200)
    expect(code.body.code).toMatch(/^MIGA-[A-HJ-KM-NP-Z2-9]{4}$/)
    expect(new Date(code.body.expires_at).getTime() - Date.now()).toBeGreaterThan(14 * 60_000)

    const validated = await validateAsPos(code.body.code)
    expect(validated.status).toBe(200)
    expect(validated.body).toMatchObject({
      valid: true,
      reward: { name: 'Un café', kind: 'points' },
    })
    expect(await balanceOf(ana)).toBe(160)

    const again = await validateAsPos(code.body.code)
    expect(again.body).toEqual({ valid: false, reason: 'used' })
  })

  it('con dos cajas validando el mismo código a la vez, gana una sola', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await openChest(ana, await rewardId('Un café'))

    const results = await Promise.all(Array.from({ length: 6 }, () => validateAsPos(body.code)))
    expect(results.filter((r) => r.body.valid === true)).toHaveLength(1)
    expect(results.filter((r) => r.body.reason === 'used')).toHaveLength(5)
  })

  it('un código vencido no canjea y se puede renovar sin volver a jugar', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await openChest(ana, await rewardId('Un café'))
    await admin
      .from('redemptions')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('code', body.code)

    expect((await validateAsPos(body.code)).body).toEqual({ valid: false, reason: 'expired' })
    const renewed = await callFunction(
      'renew-redemption',
      { redemption_id: body.id },
      { token: ana.token },
    )
    expect(renewed.status).toBe(200)
    expect(renewed.body.code).not.toBe(body.code)
    expect((await validateAsPos(renewed.body.code)).body).toMatchObject({ valid: true })
  })

  it('código inexistente', async () => {
    expect((await validateAsPos('MIGA-ZZZZ')).body).toEqual({ valid: false, reason: 'not_found' })
  })

  it('exige firma HMAC válida y reciente en la validación', async () => {
    expect((await validateAsPos('MIGA-ZZZZ', { secret: 'secreto-equivocado' })).status).toBe(401)
    expect((await validateAsPos('MIGA-ZZZZ', { timestampOffsetSeconds: -400 })).status).toBe(401)
    expect((await validateAsPos('MIGA-ZZZZ', { timestampOffsetSeconds: 400 })).status).toBe(401)
    expect((await validateAsPos('MIGA-ZZZZ', { tamperBody: true })).status).toBe(401)
    expect(
      (await callFunction('validate-redemption', { code: 'MIGA-ZZZZ' }, { token: null })).status,
    ).toBe(401)
  })

  it('un cliente no puede validar códigos por su cuenta ni ver los de otro', async () => {
    const [ana, beto] = await Promise.all([createCustomer('ana'), createCustomer('beto')])
    await giveSalePoints(ana, 160)
    const { body } = await openChest(ana, await rewardId('Un café'))

    const asClient = await callFunction(
      'validate-redemption',
      { code: body.code },
      { token: beto.token },
    )
    expect(asClient.status).toBe(401)
    expect((await beto.client.from('redemptions').select('code')).data).toEqual([])
    expect((await ana.client.from('redemptions').select('code')).data).toEqual([
      { code: body.code },
    ])
  })

  it('el simulador de caja de desarrollo firma y valida como el POS', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await openChest(ana, await rewardId('Un café'))
    expect((await callFunction('dev-pos-redeem', { code: body.code })).body).toMatchObject({
      valid: true,
    })
  })
})
