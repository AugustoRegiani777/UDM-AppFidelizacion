// Trae las reseñas de Google Maps del local y verifica las misiones "reseña de Google" pendientes.
// La dispara pg_cron cada 30 minutos (header x-reconcile-secret) o un administrador desde /admin (su sesión).
// Sin credenciales de Google configuradas no falla: solo cruza lo que ya hay cargado.
import { adminClient, requireUser } from '../_shared/clients.ts'
import { handlePreflight } from '../_shared/cors.ts'
import { errorResponse, HttpError, json } from '../_shared/errors.ts'
import { createGoogleReviewsClient, GoogleApiError } from '../_shared/google-reviews.ts'
import { sameSecret } from '../_shared/secret.ts'

function credentials() {
  const clientId = Deno.env.get('GOOGLE_BP_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_BP_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_BP_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken) return null
  return {
    clientId,
    clientSecret,
    refreshToken,
    location: Deno.env.get('GOOGLE_BP_LOCATION') ?? '',
  }
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const db = adminClient()

    const fromCron = sameSecret(
      req.headers.get('x-reconcile-secret') ?? '',
      Deno.env.get('RECONCILE_SECRET') ?? '',
    )
    if (!fromCron) {
      const user = await requireUser(req)
      const { data } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!data?.is_admin) throw new HttpError(403, 'forbidden')
    }

    const body = await req.json().catch(() => ({}))
    const creds = credentials()

    // Ayuda para configurar: qué cuentas y locales ve el token (solo administradores).
    if (body.discover === true) {
      if (fromCron) throw new HttpError(403, 'forbidden')
      if (!creds) throw new HttpError(409, 'not_configured')
      return json({ accounts: await createGoogleReviewsClient(creds).discover() })
    }

    let newReviews = 0
    if (creds && creds.location) {
      const reviews = await createGoogleReviewsClient(creds).listReviews()
      const { data, error } = await db.rpc('upsert_google_reviews', { p_reviews: reviews })
      if (error) throw error
      newReviews = data
    }

    const { data: match, error } = await db.rpc('match_google_reviews')
    if (error) throw error
    return json({ configured: Boolean(creds && creds.location), new_reviews: newReviews, ...match })
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('google_api_error', error.message)
      return json({ configured: true, error: error.message }, 502)
    }
    return errorResponse(error)
  }
})
