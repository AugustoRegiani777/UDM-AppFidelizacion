// @vitest-environment node
import { verify } from './hmac.ts'
import { createRealAdapter } from './pos-adapter.ts'

const SALE = {
  uuid: 'u',
  total_cents: 1240,
  sold_at: '2026-10-22T13:05:00+02:00',
  voided: false,
  channel: 'local',
}

describe('createRealAdapter', () => {
  it('llama al endpoint loyalty-sale con firma HMAC válida y devuelve la venta', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ found: true, sale: SALE })))
    const adapter = createRealAdapter(
      'https://pos.test',
      'secreto',
      fetchFn as unknown as typeof fetch,
    )

    expect(await adapter.getSale('u')).toEqual(SALE)

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://pos.test/.netlify/functions/loyalty-sale')
    expect(init.body).toBe('{"sale_uuid":"u"}')
    const headers = new Headers(init.headers)
    expect(await verify('secreto', init.body as string, headers)).toEqual({ ok: true })
  })

  it('devuelve null cuando el POS no encuentra la venta', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ found: false })))
    const adapter = createRealAdapter('https://pos.test', 's', fetchFn as unknown as typeof fetch)
    expect(await adapter.getSale('u')).toBeNull()
  })

  it('propaga el error si el POS responde mal (claim-sale lo deja pendiente)', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 502 }))
    const adapter = createRealAdapter('https://pos.test', 's', fetchFn as unknown as typeof fetch)
    await expect(adapter.getSale('u')).rejects.toThrow('pos_http_502')
  })
})
