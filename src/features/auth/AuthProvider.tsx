import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { isDeadSessionError } from './sessionErrors'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Una sesión guardada puede ser de un usuario que ya no existe: se comprueba una vez y se limpia.
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    void supabase.auth.getUser().then(({ error }) => {
      if (isDeadSessionError(error)) void supabase.auth.signOut({ scope: 'local' })
    })
  }, [userId])

  return <AuthContext value={{ session, loading }}>{children}</AuthContext>
}
