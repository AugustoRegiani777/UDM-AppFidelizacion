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

const RECONCILE_SECRET = process.env.RECONCILE_SECRET ?? 'dev-secret-reconcile'

const reconcile = (secret: string | null = RECONCILE_SECRET) =>
  callFunction(
    'reconcile',
    {},
    { token: null, headers: secret ? { 'x-reconcile-secret': secret } : {} },
  )

describe('reconcile', () => {
  it('solo responde a la tarea programada (con su secreto)', async () => {
    expect((await reconcile(null)).status).toBe(401)
    expect((await reconcile('otro-secreto')).status).toBe(401)
    expect((await reconcile()).status).toBe(200)
  })

  it('acredita sola una venta pendiente cuando aparece en el POS', async () => {
    const ana = await createCustomer('ana')
    const sale = await createMockSale({ total_cents: 4200, appears_in_seconds: 2 })
    expect((await claimSale(ana, sale)).body.status).toBe('pending')

    await sleep(2500)
    const result = await reconcile()
    expect(result.body.confirmed).toBeGreaterThanOrEqual(1)
    expect(await balanceOf(ana)).toBe(42)
  })

  it('descuenta los puntos de una venta que se anuló después', async () => {
    const ana = await createCustomer('ana')
    const sale = await createMockSale({ total_cents: 5000 })
    await claimSale(ana, sale)
    expect(await balanceOf(ana)).toBe(50)

    await admin.from('dev_mock_sales').update({ voided: true }).eq('uuid', sale)
    const result = await reconcile()
    expect(result.body.reversed).toBeGreaterThanOrEqual(1)
    expect(await balanceOf(ana)).toBe(0)

    // Idempotente: otra pasada no descuenta de nuevo.
    await reconcile()
    expect(await balanceOf(ana)).toBe(0)
  })

  it('vence las pendientes que nunca aparecieron y los códigos de canje', async () => {
    const ana = await createCustomer('ana')
    await claimSale(ana, randomUUID())
    await admin
      .from('claims')
      .update({ created_at: new Date(Date.now() - 3 * 3600_000).toISOString() })
      .eq('customer_id', ana.id)

    const result = await reconcile()
    expect(result.body.maintenance.expired_pending).toBeGreaterThanOrEqual(1)
    const { data } = await admin
      .from('claims')
      .select('status, reject_reason')
      .eq('customer_id', ana.id)
      .single()
    expect(data).toEqual({ status: 'rejected', reject_reason: 'not_found' })
  })

  it('el mantenimiento en SQL corre solo, sin depender de la función', async () => {
    const { data, error } = await admin.rpc('reconcile_maintenance')
    expect(error).toBeNull()
    expect(data).toHaveProperty('expired_pending')
  })
})
