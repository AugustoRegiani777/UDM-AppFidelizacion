import { useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { Sheet } from '@/motion/Sheet'
import { clearAuthRedirectError, isIdentityConflict, readAuthRedirectError } from './linkErrors'
import { signInWithGoogle } from './signIn'
import { useIsGuest } from './useIsGuest'

/**
 * Aviso al volver de Google con un error. El caso importante es `identity_already_exists`: esa cuenta de Google
 * ya tenía su propio progreso. No se mezcla nada y no se borra nada; se ofrece entrar con esa cuenta o seguir
 * como invitado.
 */
export function LinkConflictNotice() {
  const [error, setError] = useState(readAuthRedirectError)
  const [busy, setBusy] = useState(false)
  // Solo los invitados vinculan; un error al entrar (por ejemplo, cancelar Google) no muestra este aviso.
  const isGuest = useIsGuest()
  const conflict = error ? isIdentityConflict(error) : false
  const close = () => {
    clearAuthRedirectError()
    setError(null)
  }

  async function enterWithThatAccount() {
    setBusy(true)
    try {
      await signInWithGoogle('/panel')
    } catch {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={error !== null && isGuest}
      onClose={close}
      title={conflict ? copy.account.conflictTitle : copy.account.failedTitle}
    >
      <div className="mt-3 flex flex-col gap-3">
        {conflict ? (
          <>
            <p className="text-muted">{copy.account.conflictBody}</p>
            <Button disabled={busy} onClick={enterWithThatAccount}>
              {copy.account.conflictEnter}
            </Button>
            <p className="text-muted text-sm">{copy.account.conflictEnterNote}</p>
            <Button variant="ghost" onClick={close}>
              {copy.account.conflictStay}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted">{copy.account.failedBody}</p>
            <Button variant="ghost" onClick={close}>
              {copy.account.failedClose}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
