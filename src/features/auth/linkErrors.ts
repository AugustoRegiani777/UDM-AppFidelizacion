/** Error que Supabase deja en la URL cuando vuelve del ingreso/vinculación con Google. */
export interface AuthRedirectError {
  code: string
  description: string
}

/** Lee `error_code`/`error` de la URL (en el hash o en la query). Devuelve null si no hay error. */
export function parseAuthRedirectError(search: string, hash: string): AuthRedirectError | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''))
  const fromQuery = new URLSearchParams(search)
  const pick = (name: string) => fromHash.get(name) ?? fromQuery.get(name)
  const code = pick('error_code') ?? pick('error')
  if (!code) return null
  return { code, description: pick('error_description') ?? '' }
}

/** La cuenta de Google que se quiso vincular ya pertenece a otro usuario. */
export function isIdentityConflict(error: AuthRedirectError | { code?: string; message?: string }) {
  const text = 'description' in error ? error.description : (error.message ?? '')
  return error.code === 'identity_already_exists' || /already (linked|exists)/i.test(text)
}

// Se lee una sola vez al cargar la app (antes de que nadie toque la URL) y se limpia la dirección para
// que un refresh no repita el aviso. La sesión de invitado sigue intacta: el error no la toca.
let pending: AuthRedirectError | null = null
if (typeof window !== 'undefined') {
  pending = parseAuthRedirectError(window.location.search, window.location.hash)
  if (pending) window.history.replaceState(null, '', window.location.pathname)
}

/** El error con el que volvió la página, si lo hubo (se puede leer más de una vez: StrictMode monta dos veces). */
export function readAuthRedirectError(): AuthRedirectError | null {
  return pending
}

/** Se descarta cuando la persona cierra el aviso. */
export function clearAuthRedirectError() {
  pending = null
}
