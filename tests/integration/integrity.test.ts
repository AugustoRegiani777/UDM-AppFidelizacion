import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { Database } from '../../src/lib/database.types'
import {
  admin,
  balanceOf,
  claimSale,
  createCustomer,
  createMockSale,
  giveSalePoints,
} from './helpers'

// Claves de DEMO de Supabase local (públicas).
const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

describe('integridad de los datos del cliente', { timeout: 60_000 }, () => {
  it('con un JWT de cliente no se escribe nada sensible por la API', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 500)
    const me = ana.id

    const attempts = await Promise.all([
      ana.client
        .from('point_movements')
        .insert({ customer_id: me, kind: 'adjustment', points: 99999 }),
      ana.client
        .from('coin_movements')
        .insert({ customer_id: me, amount: 999, kind: 'adjustment' }),
      ana.client.from('challenge_passes').insert({ customer_id: me }),
      ana.client.from('point_spends').delete().eq('customer_id', me),
      ana.client.from('point_movements').update({ points: 1 }).eq('customer_id', me),
      ana.client.from('profiles').update({ is_admin: true }).eq('id', me),
      ana.client.from('settings').update({ value: {} }).eq('key', 'points_per_euro'),
    ])
    for (const result of attempts) expect(result.error).not.toBeNull()
    // También por las funciones: las que mueven puntos no existen para el cliente.
    const { error } = await ana.client.rpc(
      'spend_points' as never,
      {
        p_customer: me,
        p_amount: 1,
        p_kind: 'x',
        p_ref: null,
      } as never,
    )
    expect(error).not.toBeNull()

    expect(await balanceOf(ana)).toBe(500)
    const { data } = await admin.from('profiles').select('is_admin').eq('id', me).single()
    expect(data?.is_admin).toBe(false)
  })

  it('doble gasto: diez compras a la vez con saldo para una sola dejan una sola', async () => {
    const ana = await createCustomer('ana')
    await giveSalePoints(ana, 200)
    const { data: catalog } = await ana.client.rpc('shop_catalog')
    const chipa = (catalog as unknown as { items: { id: string; slug: string }[] }).items.find(
      (i) => i.slug === 'chipa',
    )!.id // cuesta 150: con 200 alcanza para una

    const results = await Promise.all(
      Array.from({ length: 10 }, () => ana.client.rpc('buy_item', { p_item: chipa })),
    )
    expect(results.filter((r) => !r.error)).toHaveLength(1)
    const { data: wallet } = await ana.client.rpc('my_wallet')
    expect(wallet).toMatchObject({ balance: 200, spendable: 50 })
    const { count } = await admin
      .from('shop_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', ana.id)
    expect(count).toBe(1)
  })

  it('una venta reclamada a la vez desde dos cuentas la acredita una sola vez', async () => {
    const ana = await createCustomer('ana')
    const beto = await createCustomer('beto')
    const sale = await createMockSale({ total_cents: 1000 })

    const responses = await Promise.all([
      claimSale(ana, sale),
      claimSale(beto, sale),
      claimSale(ana, sale),
      claimSale(beto, sale),
    ])
    expect(responses.every((r) => r.status === 200)).toBe(true)
    const { data } = await admin
      .from('point_movements')
      .select('customer_id, points')
      .eq('kind', 'purchase')
      .in('customer_id', [ana.id, beto.id])
    expect(data).toHaveLength(1)
    expect(data?.[0]?.points).toBe(100)
  })

  it('un invitado que pasa a cuenta permanente conserva el mismo usuario y todos sus datos', async () => {
    // El lanzamiento dejó los puntos de entrada en 0: se activan solo para probar que el invitado conserva sus datos.
    await admin.from('settings').update({ value: { welcome_points: 1500 } as never }).eq('key', 'demo')
    const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false } })
    const guest = await client.auth.signInAnonymously()
    expect(guest.error).toBeNull()
    const guestId = guest.data.user!.id
    expect(guest.data.user!.is_anonymous).toBe(true)

    const { data: before } = await client.rpc('customer_dashboard')
    const balanceBefore = (before as { balance: number }).balance
    expect(balanceBefore).toBeGreaterThan(0) // puntos de entrada del modo de prueba
    await admin.from('settings').update({ value: { welcome_points: 0 } as never }).eq('key', 'demo')

    // En producción lo hace linkIdentity({ provider: 'google' }); acá se prueba el mismo cambio del lado
    // del servidor (la fila de auth.users pasa a no anónima) con email y contraseña.
    const email = `invitado-${randomUUID()}@test.local`
    const update = await client.auth.updateUser({ email, password: 'secret-123456' })
    expect(update.error).toBeNull()
    await admin.auth.admin.updateUserById(guestId, { email_confirm: true })

    const signedIn = await createClient<Database>(URL, ANON_KEY, {
      auth: { persistSession: false },
    }).auth.signInWithPassword({ email, password: 'secret-123456' })
    expect(signedIn.error).toBeNull()
    expect(signedIn.data.user!.id).toBe(guestId)
    expect(signedIn.data.user!.is_anonymous).toBe(false)

    const { data: after } = await admin
      .from('point_movements')
      .select('points')
      .eq('customer_id', guestId)
    expect(after!.reduce((sum, row) => sum + row.points, 0)).toBe(balanceBefore)
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', guestId)
    expect(count).toBe(1)
  })
})
