// Cliente de la API de Google Business Profile (reseñas del local). Con la cuenta del dueño:
// se renueva un token de acceso con el refresh token y se listan las reseñas del local.
// Documentación: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
// Todo el acceso a la red recibe `fetchFn` para poder probarlo sin llamar a Google.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4'
const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
const LOCATIONS_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const PAGE_SIZE = 50
const MAX_PAGES = 6

export interface GoogleReview {
  id: string
  /** null si la persona eligió ser anónima. */
  name: string | null
  anonymous: boolean
  /** RFC 3339 */
  time: string
}

export interface GoogleReviewsCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
  /** Formato `accounts/123/locations/456`. */
  location: string
}

interface RawReview {
  reviewId?: string
  reviewer?: { displayName?: string; isAnonymous?: boolean }
  createTime?: string
}

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly step: string,
  ) {
    super(`google_${step}_${status}`)
  }
}

export function createGoogleReviewsClient(
  credentials: GoogleReviewsCredentials,
  fetchFn: typeof fetch = fetch,
) {
  async function accessToken(): Promise<string> {
    const response = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!response.ok) throw new GoogleApiError(response.status, 'token')
    const payload = await response.json()
    if (typeof payload.access_token !== 'string') throw new GoogleApiError(502, 'token')
    return payload.access_token
  }

  async function get(url: string, token: string, step: string) {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new GoogleApiError(response.status, step)
    return response.json()
  }

  return {
    /** Las reseñas más recientes del local (hasta 300), de la más nueva a la más vieja. */
    async listReviews(): Promise<GoogleReview[]> {
      const token = await accessToken()
      const reviews: GoogleReview[] = []
      let pageToken = ''
      for (let page = 0; page < MAX_PAGES; page++) {
        const query = new URLSearchParams({
          pageSize: String(PAGE_SIZE),
          orderBy: 'updateTime desc',
        })
        if (pageToken) query.set('pageToken', pageToken)
        const payload = await get(
          `${REVIEWS_BASE}/${credentials.location}/reviews?${query}`,
          token,
          'reviews',
        )
        for (const raw of (payload.reviews ?? []) as RawReview[]) {
          if (!raw.reviewId || !raw.createTime) continue
          const anonymous = raw.reviewer?.isAnonymous === true
          reviews.push({
            id: raw.reviewId,
            name: anonymous ? null : raw.reviewer?.displayName?.trim() || null,
            anonymous,
            time: raw.createTime,
          })
        }
        pageToken = payload.nextPageToken ?? ''
        if (!pageToken) break
      }
      return reviews
    },

    /** Ayuda para configurar: lista las cuentas y locales a los que tiene acceso el token. */
    async discover(): Promise<
      { account: string; accountName: string; locations: { name: string; title: string }[] }[]
    > {
      const token = await accessToken()
      const accounts = (await get(ACCOUNTS_URL, token, 'accounts')).accounts ?? []
      const result = []
      for (const account of accounts as { name: string; accountName?: string }[]) {
        const query = new URLSearchParams({ readMask: 'name,title', pageSize: '100' })
        const payload = await get(
          `${LOCATIONS_BASE}/${account.name}/locations?${query}`,
          token,
          'locations',
        )
        result.push({
          account: account.name,
          accountName: account.accountName ?? '',
          // `name` viene como "locations/456": se completa con la cuenta para usarlo tal cual.
          locations: ((payload.locations ?? []) as { name: string; title?: string }[]).map((l) => ({
            name: `${account.name}/${l.name}`,
            title: l.title ?? '',
          })),
        })
      }
      return result
    },
  }
}
