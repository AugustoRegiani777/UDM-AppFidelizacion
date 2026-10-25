import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { copy } from '@/copy'
import { env } from '@/lib/env'
import { signInAsGuest, signInWithEmailDev, signInWithGoogle } from './signIn'

/** Botón de Google (o, en modo de prueba, de invitado) y, solo en desarrollo, un login por email. */
export function SignInOptions({ returnPath }: { returnPath: string }) {
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(false)
    try {
      await action()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {env.guestMode ? (
        <>
          <Button disabled={busy} onClick={() => run(signInAsGuest)}>
            {copy.login.guest}
          </Button>
          <p className="text-muted text-sm">{copy.login.guestNote}</p>
        </>
      ) : (
        <Button disabled={busy} onClick={() => run(() => signInWithGoogle(returnPath))}>
          {copy.login.google}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-muted text-sm">
          {copy.login.error}
        </p>
      )}
      {env.devTools && (
        <DevEmailForm
          busy={busy}
          onSubmit={(email, password) => run(() => signInWithEmailDev(email, password))}
        />
      )}
    </div>
  )
}

function DevEmailForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (email: string, password: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(email, password)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-track/60 rounded-card flex flex-col gap-3 p-4">
      <p className="text-muted text-xs font-semibold tracking-wide uppercase">
        {copy.login.devTitle}
      </p>
      <TextField
        id="dev-email"
        label={copy.login.devEmail}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        id="dev-password"
        label={copy.login.devPassword}
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" variant="dark" disabled={busy}>
        {copy.login.devSubmit}
      </Button>
    </form>
  )
}
