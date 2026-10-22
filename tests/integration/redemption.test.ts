import {
  admin,
  balanceOf,
  callFunction,
  createCustomer,
  createRedemption,
  giveSalePoints,
  rewardId,
  validateAsPos,
} from './helpers'

describe('canje de premios', () => {
  it('flujo completo: código con vencimiento, la caja lo valida y recién ahí se descuentan los puntos', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)

    const created = await createRedemption(ana, await rewardId('Un café'))
    expect(created.status).toBe(200)
    expect(created.body.code).toMatch(/^MIGA-[A-HJ-KM-NP-Z2-9]{4}$/)
    expect(new Date(created.body.expires_at).getTime() - Date.now()).toBeGreaterThan(14 * 60_000)
    expect(await balanceOf(ana)).toBe(160)

    const validated = await validateAsPos(created.body.code)
    expect(validated.status).toBe(200)
    expect(validated.body).toMatchObject({
      valid: true,
      reward: { name: 'Un café', kind: 'points' },
    })
    expect(await balanceOf(ana)).toBe(10)

    const again = await validateAsPos(created.body.code)
    expect(again.body).toEqual({ valid: false, reason: 'used' })
    expect(await balanceOf(ana)).toBe(10)
  })

  it('no entrega código si el premio no está alcanzado', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 100)
    const denied = await createRedemption(ana, await rewardId('Un café'))
    expect(denied.status).toBe(409)
    expect(denied.body.error).toBe('reward_not_reached')
  })

  it('con dos cajas validando el mismo código a la vez, gana una sola', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await createRedemption(ana, await rewardId('Un café'))

    const results = await Promise.all(Array.from({ length: 6 }, () => validateAsPos(body.code)))
    const valid = results.filter((r) => r.body.valid === true)
    expect(valid).toHaveLength(1)
    expect(results.filter((r) => r.body.reason === 'used')).toHaveLength(5)
    expect(await balanceOf(ana)).toBe(10)
  })

  it('pedir el código dos veces a la vez devuelve el mismo', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const reward = await rewardId('Un café')
    const [a, b] = await Promise.all([createRedemption(ana, reward), createRedemption(ana, reward)])
    expect(a.body.code).toBe(b.body.code)
  })

  it('un código vencido no canjea y no hace perder puntos', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await createRedemption(ana, await rewardId('Un café'))
    await admin
      .from('redemptions')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('code', body.code)

    expect((await validateAsPos(body.code)).body).toEqual({ valid: false, reason: 'expired' })
    expect(await balanceOf(ana)).toBe(160)
    expect((await createRedemption(ana, await rewardId('Un café'))).status).toBe(200)
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
    const { body } = await createRedemption(ana, await rewardId('Un café'))

    const asClient = await callFunction(
      'validate-redemption',
      { code: body.code },
      { token: beto.token },
    )
    expect(asClient.status).toBe(401)

    const spied = await beto.client.from('redemptions').select('code')
    expect(spied.data).toEqual([])
    const own = await ana.client.from('redemptions').select('code')
    expect(own.data).toEqual([{ code: body.code }])
  })

  it('el simulador de caja de desarrollo firma y valida como el POS', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 160)
    const { body } = await createRedemption(ana, await rewardId('Un café'))
    const viaDev = await callFunction('dev-pos-redeem', { code: body.code })
    expect(viaDev.body).toMatchObject({ valid: true })
  })
})
