import { useEffect } from 'react'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { supabase } from '@/lib/supabase'

/**
 * La sesión apunta a un usuario que ya no existe (cuenta borrada, base reiniciada, invitado limpiado).
 * Se cierra solo la sesión de este navegador y la app vuelve a la entrada, en vez de romperse.
 */
export function ResetSession() {
  useEffect(() => {
    void supabase.auth.signOut({ scope: 'local' })
  }, [])
  return <FullScreenLoader />
}
