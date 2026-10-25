import { Navigate, Outlet, useLocation } from 'react-router'
import { ResetSession } from '@/features/auth/ResetSession'
import { isDeadSessionError } from '@/features/auth/sessionErrors'
import { useAuth } from '@/features/auth/useAuth'
import { useProfile } from '@/features/profile/useProfile'
import { FullScreenLoader } from '@/components/FullScreenLoader'

/** Deja pasar solo con sesión; si no, manda a /login recordando a dónde volver. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Con sesión pero sin haber aceptado el programa, va primero a la bienvenida. */
export function RequireOnboarded() {
  const profile = useProfile()
  const location = useLocation()
  if (profile.isPending) return <FullScreenLoader />
  if (profile.isError) {
    // Sesión de un usuario que ya no existe: se vuelve a la entrada en vez de romper la pantalla.
    if (isDeadSessionError(profile.error as { status?: number; code?: string }))
      return <ResetSession />
    throw profile.error
  }
  if (!profile.data.program_consent_at) {
    return <Navigate to="/bienvenida" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
