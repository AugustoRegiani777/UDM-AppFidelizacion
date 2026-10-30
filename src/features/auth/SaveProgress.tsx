import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { linkGoogleToGuest } from './signIn'
import { useIsGuest } from './useIsGuest'

/** "Guardar mi progreso con Google": solo para invitados. Vincula la misma cuenta, no crea otra. */
export function SaveProgress() {
  const isGuest = useIsGuest()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  if (!isGuest) return null

  async function handleSave() {
    setBusy(true)
    setError(false)
    try {
      await linkGoogleToGuest('/perfil')
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="save-progress"
      className="bg-track/60 rounded-card flex flex-col gap-3 p-4"
    >
      <h2 id="save-progress" className="font-display text-3xl">
        {copy.account.saveTitle}
      </h2>
      <p className="text-muted">{copy.account.saveBody}</p>
      <Button disabled={busy} onClick={handleSave}>
        {copy.account.saveButton}
      </Button>
      <p className="text-muted text-sm">{copy.account.saveNote}</p>
      {error && (
        <p role="alert" className="text-brand-ink text-sm">
          {copy.account.saveError}
        </p>
      )}
    </section>
  )
}

/** Aviso chico para el panel: lleva al perfil, donde está el botón. Solo para invitados. */
export function SaveProgressHint() {
  const isGuest = useIsGuest()
  if (!isGuest) return null
  return (
    <Link
      to="/perfil"
      className="bg-track/60 rounded-card min-h-12 content-center px-4 py-3 text-sm font-bold underline"
    >
      {copy.account.panelHint}
    </Link>
  )
}
