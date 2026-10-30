import { useAuth } from './useAuth'

/** true si la sesión es de un invitado (cuenta anónima, todavía sin Google). */
export function useIsGuest() {
  const { session } = useAuth()
  return session?.user.is_anonymous === true
}
