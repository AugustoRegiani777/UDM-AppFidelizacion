// La caja (servidor del POS) valida un código de canje. Contrato: docs/03, endpoint B.
// Llamada firmada con HMAC-SHA256 (X-Timestamp + X-Signature con POS_INBOUND_HMAC_SECRET).
import { adminClient } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { verify } from '../_shared/hmac.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')

    // La firma se calcula sobre el cuerpo crudo, así que se lee como texto antes de parsear.
    const rawBody = await req.text()
    const signature = await verify(
      Deno.env.get('POS_INBOUND_HMAC_SECRET') ?? '',
      rawBody,
      req.headers,
    )
    if (!signature.ok) throw new HttpError(401, `invalid_signature_${signature.reason}`)

    let code: unknown
    try {
      code = JSON.parse(rawBody).code
    } catch {
      throw new HttpError(400, 'invalid_body')
    }
    if (typeof code !== 'string' || code.length > 32) throw new HttpError(400, 'invalid_code')

    const { data, error } = await adminClient().rpc('validate_redemption', { p_code: code })
    if (error) throw error
    return json(data)
  } catch (error) {
    return errorResponse(error)
  }
})
