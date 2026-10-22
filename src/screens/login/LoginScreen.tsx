import { Navigate, useLocation } from 'react-router'
import { Screen } from '@/components/Screen'
import { SignInOptions } from '@/features/auth/SignInOptions'
import { useAuth } from '@/features/auth/useAuth'
import { readPendingSale, saleRoute } from '@/features/claims/pendingSale'
import { copy } from '@/copy'

/** Entrada de las rutas protegidas. Si venía de /s/:uuid, vuelve ahí al terminar. */
export function LoginScreen() {
  const { session } = useAuth()
  const location = useLocation()
  const pending = readPendingSale()
  const returnPath =
    (location.state as { from?: string } | null)?.from ?? (pending ? saleRoute(pending) : '/panel')

  if (session) return <Navigate to={returnPath} replace />

  return (
    <Screen className="justify-center gap-6">
      <h1 className="font-display text-6xl leading-none">{copy.login.title}</h1>
      <p className="text-muted text-lg">{pending ? copy.login.pendingSale : copy.login.subtitle}</p>
      <SignInOptions returnPath={returnPath} />
    </Screen>
  )
}
