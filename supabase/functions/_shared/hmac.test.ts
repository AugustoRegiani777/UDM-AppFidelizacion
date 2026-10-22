// @vitest-environment node
import { sign, signedHeaders, verify } from './hmac.ts'

const SECRET = 'secreto-de-prueba'
const BODY = '{"sale_uuid":"abc"}'
const NOW = 1_800_000_000

const headersOf = (map: Record<string, string>) => ({ get: (name: string) => map[name] ?? null })

describe('hmac', () => {
  it('firma con timestamp.body y da una firma estable', async () => {
    expect(await sign(SECRET, NOW, BODY)).toBe(await sign(SECRET, String(NOW), BODY))
    expect(await sign(SECRET, NOW, BODY)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('acepta una firma válida', async () => {
    const headers = headersOf(await signedHeaders(SECRET, BODY, NOW))
    expect(await verify(SECRET, BODY, headers, NOW + 10)).toEqual({ ok: true })
  })

  it('rechaza un cuerpo alterado', async () => {
    const headers = headersOf(await signedHeaders(SECRET, BODY, NOW))
    expect(await verify(SECRET, '{"sale_uuid":"otra"}', headers, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('rechaza un secreto distinto', async () => {
    const headers = headersOf(await signedHeaders('otro-secreto', BODY, NOW))
    expect(await verify(SECRET, BODY, headers, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rechaza firmas de más de 5 minutos, hacia atrás y hacia adelante', async () => {
    const headers = headersOf(await signedHeaders(SECRET, BODY, NOW))
    expect(await verify(SECRET, BODY, headers, NOW + 301)).toEqual({ ok: false, reason: 'expired' })
    expect(await verify(SECRET, BODY, headers, NOW - 301)).toEqual({ ok: false, reason: 'expired' })
    expect(await verify(SECRET, BODY, headers, NOW + 300)).toEqual({ ok: true })
  })

  it('rechaza si faltan headers o el secreto no está configurado', async () => {
    expect(await verify(SECRET, BODY, headersOf({}), NOW)).toEqual({ ok: false, reason: 'missing' })
    const headers = headersOf(await signedHeaders(SECRET, BODY, NOW))
    expect(await verify('', BODY, headers, NOW)).toEqual({ ok: false, reason: 'missing' })
  })
})
