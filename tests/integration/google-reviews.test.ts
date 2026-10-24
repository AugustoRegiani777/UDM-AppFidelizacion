import { randomUUID } from 'node:crypto'
import { admin, balanceOf, callFunction, createCustomer } from './helpers'

const SECRET = process.env.RECONCILE_SECRET ?? 'dev-secret-reconcile'
const sync = (
  headers: Record<string, string> = { 'x-reconcile-secret': SECRET },
  token: string | null = null,
) => callFunction('sync-google-reviews', {}, { token, headers })

const claimReview = (customer: Awaited<ReturnType<typeof createCustomer>>, note: string) =>
  customer.client.rpc('claim_mission', { p_mission: 'google_review', p_note: note })

describe('verificación de reseñas de Google', () => {
  it('aprueba sola la reseña cuyo autor coincide con la cuenta de Google del cliente', async () => {
    const unique = randomUUID().slice(0, 8)
    const lucia = await createCustomer('lucia', `Lucía ${unique}`)
    expect((await claimReview(lucia, 'lucy')).error).toBeNull()
    expect(await balanceOf(lucia)).toBe(0)

    await admin.rpc('upsert_google_reviews', {
      p_reviews: [
        {
          id: `r-${unique}`,
          name: `LUCIA ${unique}`,
          anonymous: false,
          time: new Date().toISOString(),
        },
      ],
    })
    const result = await sync()
    expect(result.status).toBe(200)
    expect(result.body.approved).toBeGreaterThanOrEqual(1)
    expect(await balanceOf(lucia)).toBe(50)

    // Otra pasada no acredita de nuevo.
    await sync()
    expect(await balanceOf(lucia)).toBe(50)
  })

  it('una reseña de otra persona no le suma puntos a un cliente que escribió ese nombre', async () => {
    const unique = randomUUID().slice(0, 8)
    const intruder = await createCustomer('intruso', `Intruso ${unique}`)
    await claimReview(intruder, `Persona Real ${unique}`)
    await admin.rpc('upsert_google_reviews', {
      p_reviews: [
        {
          id: `x-${unique}`,
          name: `Persona Real ${unique}`,
          anonymous: false,
          time: new Date().toISOString(),
        },
      ],
    })
    await sync()
    expect(await balanceOf(intruder)).toBe(0)
    const { data } = await admin
      .from('bonus_claims')
      .select('status, suggested_review')
      .eq('customer_id', intruder.id)
      .single()
    expect(data).toEqual({ status: 'pending', suggested_review: `x-${unique}` })
  })

  it('solo la dispara la tarea programada o un administrador', async () => {
    expect((await sync({})).status).toBe(401)
    expect((await sync({ 'x-reconcile-secret': 'otro' })).status).toBe(401)
    const client = await createCustomer('comun')
    const asClient = await sync({}, client.token)
    expect(asClient.status).toBe(403)
  })

  it('sin credenciales de Google no falla: avisa que no está configurada', async () => {
    const result = await sync()
    expect(result.status).toBe(200)
    expect(result.body.configured).toBe(false)
  })

  it('"descubrir" solo existe para administradores con credenciales configuradas', async () => {
    const result = await callFunction(
      'sync-google-reviews',
      { discover: true },
      { token: null, headers: { 'x-reconcile-secret': SECRET } },
    )
    expect(result.status).toBe(403)
  })
})
