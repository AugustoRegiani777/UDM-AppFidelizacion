/**
 * Errores con los que Supabase avisa que el usuario del token ya no existe.
 * Un 401 suelto NO alcanza: puede ser un token vencido que se renueva solo, y cerrar la sesión de un
 * invitado por error le haría perder el acceso a su cuenta. Solo se considera "muerta" cuando el servidor
 * dice con claridad que el usuario o la sesión no existen.
 */
const DEAD_CODES = new Set([
  'user_not_found',
  'session_not_found',
  'refresh_token_not_found',
  'PGRST116', // el perfil no existe (single() sin filas)
])

export function isDeadSessionError(error: { status?: number; code?: string } | null): boolean {
  if (!error) return false
  return error.code !== undefined && DEAD_CODES.has(error.code)
}
