import { randomUUID } from 'node:crypto'
import {
  admin,
  balanceOf,
  callFunction,
  claimSale,
  createCustomer,
  createMockSale,
  sleep,
} from './helpers'

describe('claim-sale', () => {
  it('suma los puntos de una venta válida y celebra el premio que se desbloquea', async () => {
    const ana = await createCustomer('ana')
    const sale = await createMockSale({ total_cents: 16200 })

    const { status, body } = await claimSale(ana, sale)
    expect(status).toBe(200)
    expect(body).toMatchObject({ status: 'confirmed', points: 1620, balance: 1620 })
    expect(body.unlocked[0].name).toBe('Un café')
    expect(await balanceOf(ana)).toBe(1620)
  })

  it('no suma dos veces la misma venta y no se la deja a otro cliente', async () => {
    const ana = await createCustomer('ana')
    const beto = await createCustomer('beto')
    const sale = await createMockSale({ total_cents: 5000 })

    await claimSale(ana, sale)
    const again = await claimSale(ana, sale)
    expect(again.body).toMatchObject({ status: 'confirmed', repeat: true, balance: 500 })

    const other = await claimSale(beto, sale)
    expect(other.body).toMatchObject({ status: 'rejected', reason: 'already_claimed' })
    expect(await balanceOf(beto)).toBe(0)
  })

  it.each([
    ['anulada', { voided: true }, 'voided'],
    ['de Glovo', { channel: 'glovo' as const }, 'excluded_channel'],
    ['de Too Good To Go', { channel: 'togoo' as const }, 'excluded_channel'],
    ['vieja', { minutes_ago: 180 }, 'too_old'],
  ])('rechaza una venta %s sin sumar puntos', async (_name, options, reason) => {
    const ana = await createCustomer('ana')
    const { body } = await claimSale(ana, await createMockSale(options))
    expect(body).toMatchObject({ status: 'rejected', reason })
    expect(await balanceOf(ana)).toBe(0)
  })

  it('deja pendiente una venta que el POS no conoce y la acredita cuando aparece', async () => {
    const ana = await createCustomer('ana')
    const unknown = await claimSale(ana, randomUUID())
    expect(unknown.body).toMatchObject({ status: 'pending' })

    const sale = await createMockSale({ total_cents: 3000, appears_in_seconds: 2 })
    const early = await claimSale(ana, sale)
    expect(early.body).toMatchObject({ status: 'pending' })
    expect(await balanceOf(ana)).toBe(0)

    await sleep(2500)
    const later = await claimSale(ana, sale)
    expect(later.body).toMatchObject({ status: 'confirmed', points: 300 })
    expect(await balanceOf(ana)).toBe(300)
  })

  it('con dos clientes escaneando a la vez, la venta es de uno solo', async () => {
    const [ana, beto] = await Promise.all([createCustomer('ana'), createCustomer('beto')])
    const sale = await createMockSale({ total_cents: 4000 })

    const results = await Promise.all([claimSale(ana, sale), claimSale(beto, sale)])
    const statuses = results.map((r) => r.body.status).sort()
    expect(statuses).toEqual(['confirmed', 'rejected'])
    expect((await balanceOf(ana)) + (await balanceOf(beto))).toBe(400)
  })

  it('pide sesión y valida el uuid', async () => {
    const ana = await createCustomer('ana')
    expect(
      (await callFunction('claim-sale', { sale_uuid: randomUUID() }, { token: null })).status,
    ).toBe(401)
    expect((await callFunction('claim-sale', { sale_uuid: randomUUID() })).status).toBe(401)
    expect(
      (await callFunction('claim-sale', { sale_uuid: 'no-soy-uuid' }, { token: ana.token })).status,
    ).toBe(400)
  })

  it('frena el exceso de intentos', async () => {
    const ana = await createCustomer('ana')
    const responses = []
    for (let i = 0; i < 17; i++) responses.push(await claimSale(ana, randomUUID()))
    expect(responses.filter((r) => r.status === 429).length).toBeGreaterThan(0)
  })

  it('el cliente no puede acreditarse puntos por su cuenta', async () => {
    const ana = await createCustomer('ana')
    const direct = await ana.client.rpc(
      'claim_sale_apply' as never,
      {
        p_customer: ana.id,
        p_sale_uuid: randomUUID(),
        p_sale: {
          total_cents: 999900,
          sold_at: new Date().toISOString(),
          voided: false,
          channel: 'local',
        },
      } as never,
    )
    expect(direct.error).not.toBeNull()
    expect(await balanceOf(ana)).toBe(0)
    expect(
      (await admin.from('point_movements').select('id').eq('customer_id', ana.id)).data,
    ).toHaveLength(0)
  })
})
