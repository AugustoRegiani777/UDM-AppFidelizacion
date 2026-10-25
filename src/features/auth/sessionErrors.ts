/** Códigos con los que Supabase avisa que el usuario del token ya no existe o el token no sirve. */
export function isDeadSessionError(error: { status?: number; code?: string } | null): boolean {
  if (!error) return false
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.code === 'user_not_found' ||
    error.code === 'PGRST116'
  )
}
