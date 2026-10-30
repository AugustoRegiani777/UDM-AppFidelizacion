import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { copy } from '@/copy'
import { supabase } from '@/lib/supabase'
import { isDeadSessionError } from './sessionErrors'

const RETRIED_KEY = 'udm:session-retried'

function retriedOnce() {
  try {
    return sessionStorage.getItem(RETRIED_KEY) === '1'
  } catch {
    return false
  }
}

function markRetried(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RETRIED_KEY, '1')
    else sessionStorage.removeItem(RETRIED_KEY)
  } catch {
    // sin sessionStorage (ventana privada): se sigue sin recordar el reintento
  }
}

/**
 * La app creyó que la sesión ya no sirve (perfil que no aparece, usuario borrado, invitado limpiado).
 * Antes de cerrar nada se le pregunta al servidor: solo si confirma que el usuario no existe se cierra la sesión
 * de ESTE navegador (nunca se borra nada del servidor). Si el usuario existe, la sesión se conserva —cerrar la de un
 * invitado por error le haría perder la cuenta—: se repara el perfil que faltara y se recarga una sola vez.
 */
export function ResetSession() {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { error } = await supabase.auth.getUser()
      if (cancelled) return
      if (isDeadSessionError(error)) {
        markRetried(false)
        await supabase.auth.signOut({ scope: 'local' })
        return
      }
      if (!error) await supabase.rpc('ensure_profile')
      if (cancelled) return
      if (retriedOnce()) {
        setStuck(true)
        return
      }
      markRetried(true)
      window.location.reload()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!stuck) return <FullScreenLoader />
  return (
    <Screen className="justify-center gap-4 text-center">
      <h1 className="font-display text-4xl">{copy.errors.title}</h1>
      <p className="text-muted">{copy.errors.body}</p>
      <Button
        onClick={() => {
          markRetried(false)
          window.location.reload()
        }}
      >
        {copy.errors.reload}
      </Button>
    </Screen>
  )
}
