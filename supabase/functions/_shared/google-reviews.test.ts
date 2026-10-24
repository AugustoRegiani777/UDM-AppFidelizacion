// @vitest-environment node
import { createGoogleReviewsClient, GoogleApiError } from './google-reviews.ts'

const CREDENTIALS = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'refresh',
  location: 'accounts/1/locations/2',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('cliente de reseñas de Google', () => {
  it('renueva el token y lista las reseñas con paginación, ocultando el nombre de las anónimas', async () => {
    const calls: string[] = []
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url)
      calls.push(target)
      if (target.startsWith('https://oauth2.googleapis.com/token')) {
        const body = String(init?.body)
        expect(body).toContain('grant_type=refresh_token')
        expect(body).toContain('refresh_token=refresh')
        return json({ access_token: 'token-123' })
      }
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-123')
      if (!target.includes('pageToken')) {
        return json({
          reviews: [
            {
              reviewId: 'r1',
              reviewer: { displayName: ' Lucía Pérez ' },
              createTime: '2026-10-20T10:00:00Z',
            },
            {
              reviewId: 'r2',
              reviewer: { displayName: 'Oculto', isAnonymous: true },
              createTime: '2026-10-19T10:00:00Z',
            },
          ],
          nextPageToken: 'next',
        })
      }
      return json({
        reviews: [
          { reviewId: 'r3', reviewer: { displayName: 'Beto' }, createTime: '2026-10-18T10:00:00Z' },
        ],
      })
    })

    const reviews = await createGoogleReviewsClient(
      CREDENTIALS,
      fetchFn as unknown as typeof fetch,
    ).listReviews()

    expect(reviews).toEqual([
      { id: 'r1', name: 'Lucía Pérez', anonymous: false, time: '2026-10-20T10:00:00Z' },
      { id: 'r2', name: null, anonymous: true, time: '2026-10-19T10:00:00Z' },
      { id: 'r3', name: 'Beto', anonymous: false, time: '2026-10-18T10:00:00Z' },
    ])
    expect(calls[1]).toContain(
      'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews',
    )
    expect(calls[1]).toContain('pageSize=50')
    expect(calls).toHaveLength(3)
  })

  it('ignora entradas incompletas y devuelve vacío si el local no tiene reseñas', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('oauth2')
        ? json({ access_token: 't' })
        : json({ reviews: [{ reviewer: { displayName: 'X' } }] }),
    )
    const client = createGoogleReviewsClient(CREDENTIALS, fetchFn as unknown as typeof fetch)
    expect(await client.listReviews()).toEqual([])
  })

  it('si Google rechaza el token o la consulta, avisa con un error claro', async () => {
    const badToken = vi.fn(async () => json({ error: 'invalid_grant' }, 400))
    await expect(
      createGoogleReviewsClient(CREDENTIALS, badToken as unknown as typeof fetch).listReviews(),
    ).rejects.toMatchObject({ message: 'google_token_400' })

    const noAccess = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('oauth2') ? json({ access_token: 't' }) : json({}, 403),
    )
    const error = await createGoogleReviewsClient(CREDENTIALS, noAccess as unknown as typeof fetch)
      .listReviews()
      .catch((e) => e)
    expect(error).toBeInstanceOf(GoogleApiError)
    expect(error.message).toBe('google_reviews_403')
  })

  it('descubre cuentas y locales para ayudar a configurar', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('oauth2')) return json({ access_token: 't' })
      if (target.includes('mybusinessaccountmanagement'))
        return json({ accounts: [{ name: 'accounts/9', accountName: 'Uno de Miga' }] })
      return json({ locations: [{ name: 'locations/77', title: 'Uno de Miga Valencia' }] })
    })
    const found = await createGoogleReviewsClient(
      { ...CREDENTIALS, location: '' },
      fetchFn as unknown as typeof fetch,
    ).discover()
    expect(found).toEqual([
      {
        account: 'accounts/9',
        accountName: 'Uno de Miga',
        locations: [{ name: 'accounts/9/locations/77', title: 'Uno de Miga Valencia' }],
      },
    ])
  })
})
