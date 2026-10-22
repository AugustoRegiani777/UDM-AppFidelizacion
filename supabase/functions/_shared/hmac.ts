// Firma HMAC-SHA256 para las llamadas entre servidores (contrato: docs/03).
// Solo usa Web Crypto, así que corre igual en Deno y en los tests de Vitest.

export const MAX_SIGNATURE_AGE_SECONDS = 300

const encoder = new TextEncoder()

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** hex(HMAC_SHA256(secret, timestamp + "." + body)) */
export async function sign(
  secret: string,
  timestamp: number | string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`)))
}

/** Headers que lleva toda llamada firmada. */
export async function signedHeaders(
  secret: string,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return {
    'Content-Type': 'application/json',
    'X-Timestamp': String(nowSeconds),
    'X-Signature': await sign(secret, nowSeconds, body),
  }
}

/** Comparación en tiempo constante, para no filtrar la firma por diferencias de tiempo. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type VerifyResult =
  { ok: true } | { ok: false; reason: 'missing' | 'expired' | 'bad_signature' }

/** Verifica firma y antigüedad (más de 300 s se rechaza). */
export async function verify(
  secret: string,
  body: string,
  headers: { get(name: string): string | null },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  const timestamp = headers.get('X-Timestamp')
  const signature = headers.get('X-Signature')
  if (!secret || !timestamp || !signature) return { ok: false, reason: 'missing' }
  const age = Math.abs(nowSeconds - Number(timestamp))
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS)
    return { ok: false, reason: 'expired' }
  const expected = await sign(secret, timestamp, body)
  return safeEqual(expected, signature.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: 'bad_signature' }
}
