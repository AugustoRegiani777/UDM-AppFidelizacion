import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { TextField } from '@/components/TextField'
import { postLoginPath } from '@/features/claims/postLoginPath'
import { completeOnboarding } from '@/features/profile/profileApi'
import { useInvalidateProfile, useProfile } from '@/features/profile/useProfile'
import { copy } from '@/copy'

export function WelcomeScreen() {
  const profile = useProfile()
  if (profile.isPending) return <FullScreenLoader />
  if (profile.isError) throw profile.error
  if (profile.data.program_consent_at) return <Navigate to={postLoginPath()} replace />
  return <WelcomeForm initialName={profile.data.display_name} />
}

function WelcomeForm({ initialName }: { initialName: string }) {
  const navigate = useNavigate()
  const invalidateProfile = useInvalidateProfile()
  const [name, setName] = useState(initialName)
  const [programConsent, setProgramConsent] = useState(false)
  const [promoConsent, setPromoConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  const nameValid = trimmed.length >= 1 && trimmed.length <= 60

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nameValid) return setError(copy.welcome.nameError)
    setBusy(true)
    setError(null)
    try {
      await completeOnboarding(trimmed, promoConsent)
      await invalidateProfile()
      navigate(postLoginPath(), { replace: true })
    } catch {
      setError(copy.welcome.error)
      setBusy(false)
    }
  }

  return (
    <Screen className="justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h1 className="font-display text-6xl leading-none">{copy.welcome.title}</h1>
        <p className="text-muted text-lg">{copy.welcome.subtitle}</p>
        <TextField
          id="name"
          label={copy.welcome.nameLabel}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Checkbox checked={programConsent} onChange={(e) => setProgramConsent(e.target.checked)}>
          {copy.welcome.programConsent}{' '}
          <Link to="/privacidad" className="underline">
            {copy.landing.footerPrivacy}
          </Link>
        </Checkbox>
        <Checkbox checked={promoConsent} onChange={(e) => setPromoConsent(e.target.checked)}>
          {copy.welcome.promoConsent}
        </Checkbox>
        {error && (
          <p role="alert" className="text-brand-ink text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !programConsent || !nameValid}>
          {copy.welcome.submit}
        </Button>
      </form>
    </Screen>
  )
}
