import { useRouteError } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { copy } from '@/copy'
import { supabase } from '@/lib/supabase'

/** Pantalla de último recurso: si algo se rompe, nunca se ve el error técnico. */
export function RouteError() {
  const error = useRouteError()
  // El detalle queda en la consola para quien lo quiera mirar, no en la pantalla.
  console.error(error)

  async function restart() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      window.location.assign('/')
    }
  }

  return (
    <Screen className="justify-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none">{copy.errors.title}</h1>
      <p className="text-muted text-lg">{copy.errors.body}</p>
      <Button onClick={() => window.location.reload()}>{copy.errors.reload}</Button>
      <Button variant="ghost" onClick={restart}>
        {copy.errors.restart}
      </Button>
    </Screen>
  )
}
