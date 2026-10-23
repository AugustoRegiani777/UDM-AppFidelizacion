import { randomUUID } from 'node:crypto'
import {
  admin,
  balanceOf,
  callFunction,
  claimSale,
  createCustomer,
  createMockSale,
} from './helpers'

const play = (token: string, game: string, refId?: string) =>
  callFunction('play-game', { game, ref_id: refId }, { token })

describe('juegos', () => {
  it('la ruleta decide en el servidor, acredita el premio y deja un giro por día', async () => {
    const ana = await createCustomer('ana')
    const spin = await play(ana.token, 'roulette')
    expect(spin.status).toBe(200)
    expect(spin.body).toMatchObject({ game: 'roulette', repeat: false })
    expect(typeof spin.body.prize_id).toBe('string')
    expect(await balanceOf(ana)).toBe(spin.body.points)

    const again = await play(ana.token, 'roulette')
    expect(again.status).toBe(409)
    expect(again.body.error).toBe('daily_limit_reached')
  })

  it('la raspadita se juega una sola vez por compra y muestra siempre el mismo resultado', async () => {
    const ana = await createCustomer('ana')
    const claim = await claimSale(ana, await createMockSale({ total_cents: 3000 }))
    const claimId = claim.body.claim_id as string

    const first = await play(ana.token, 'scratch', claimId)
    expect(first.status).toBe(200)
    const second = await play(ana.token, 'scratch', claimId)
    expect(second.body).toMatchObject({ prize_id: first.body.prize_id, repeat: true })
    expect(await balanceOf(ana)).toBe(30 + first.body.points)
  })

  it('no se puede raspar la compra de otro, una inventada ni un juego que no existe', async () => {
    const [ana, beto] = await Promise.all([createCustomer('ana'), createCustomer('beto')])
    const claim = await claimSale(ana, await createMockSale({ total_cents: 1000 }))

    expect((await play(beto.token, 'scratch', claim.body.claim_id)).status).toBe(409)
    expect((await play(ana.token, 'scratch', randomUUID())).status).toBe(409)
    expect((await play(ana.token, 'poker')).status).toBe(400)
    expect((await callFunction('play-game', { game: 'roulette' }, { token: null })).status).toBe(
      401,
    )
  })

  it('con el presupuesto diario agotado se juega igual, pero sin premio', async () => {
    const { data: original } = await admin
      .from('settings')
      .select('value')
      .eq('key', 'games')
      .single()
    const games = original!.value as Record<string, unknown>
    try {
      await admin
        .from('settings')
        .update({ value: { ...games, daily_points_budget: 0 } })
        .eq('key', 'games')
      for (let i = 0; i < 5; i++) {
        const customer = await createCustomer('tope')
        const spin = await play(customer.token, 'roulette')
        expect(spin.body.points).toBe(0)
      }
    } finally {
      await admin
        .from('settings')
        .update({ value: games as never })
        .eq('key', 'games')
    }
  })
})
