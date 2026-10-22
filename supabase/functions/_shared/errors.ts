import { corsHeaders } from './cors.ts'

/** Error con código estable y status HTTP; el cliente decide el texto amable. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code)
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Convierte cualquier error en una respuesta JSON sin filtrar datos internos ni personales. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.code }, error.status)
  console.error('unexpected_error', error instanceof Error ? error.name : 'unknown')
  return json({ error: 'internal_error' }, 500)
}
