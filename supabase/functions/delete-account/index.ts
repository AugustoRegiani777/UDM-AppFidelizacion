// Borra la cuenta del cliente que llama y, por cascada, todos sus datos (RGPD).
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const user = await requireUser(req)
    // Borrar es irreversible: hace falta confirmarlo explícitamente (una llamada suelta no alcanza).
    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== true) throw new HttpError(400, 'confirmation_required')
    const { error } = await adminClient().auth.admin.deleteUser(user.id)
    if (error) throw error
    return json({ deleted: true })
  } catch (error) {
    return errorResponse(error)
  }
})
