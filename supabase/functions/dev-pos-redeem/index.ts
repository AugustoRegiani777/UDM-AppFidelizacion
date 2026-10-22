// SOLO DESARROLLO: simula la caja del POS validando un código, firmando con HMAC como lo haría el POS real.
// Responde 404 salvo que DEV_ENDPOINTS=true (variable que solo existe en supabase/functions/.env local).
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { signedHeaders } from '../_shared/hmac.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (Deno.env.get('DEV_ENDPOINTS') !== 'true' || Deno.env.get('POS_MODE') !== 'mock') {
      throw new HttpError(404, 'not_found')
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')

    const { code } = await req.json().catch(() => ({}))
    if (typeof code !== 'string') throw new HttpError(400, 'invalid_code')

    const body = JSON.stringify({ code })
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-redemption`,
      {
        method: 'POST',
        headers: await signedHeaders(Deno.env.get('POS_INBOUND_HMAC_SECRET') ?? '', body),
        body,
      },
    )
    return json(await response.json(), response.status)
  } catch (error) {
    return errorResponse(error)
  }
})
