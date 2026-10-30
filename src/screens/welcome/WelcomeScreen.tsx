import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { LegalFooter } from '@/components/LegalFooter'
import { Screen } from '@/components/Screen'
import { TextField } from '@/components/TextField'
import { postLoginPath } from '@/features/claims/postLoginPath'
import { needsLegalAcceptance, useRequiredLegalVersion } from '@/features/profile/legalConsent'
import { acceptLegal, completeOnboarding } from '@/features/profile/profileApi'
import { useInvalidateProfile, useProfile } from '@/features/profile/useProfile'
import { copy } from '@/copy'
import { legalCopy } from '@/copy/legal'
import { LEGAL_VERSION } from '@/legal/company'

export function WelcomeScreen() {
  const profile = useProfile()
  const legalVersion = useRequiredLegalVersion()
  if (profile.isPending || legalVersion.isPending) return <FullScreenLoader />
  if (profile.isError) throw profile.error
  if (!needsLegalAcceptance(profile.data, legalVersion.data ?? LEGAL_VERSION)) {
    return <Navigate to={postLoginPath()} replace />
  }
  // Ya había aceptado el programa antes: solo vuelve a confirmar las casillas (sin tocar nombre ni promos).
  const returning = Boolean(profile.data.program_consent_at)
  return <WelcomeForm initialName={profile.data.display_name} returning={returning} />
}

/** Enlace que se abre en otra pestaña para no perder lo que ya se marcó. */
function LegalLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} target="_blank" rel="noopener" className="underline">
      {children}
    </Link>
  )
}

function WelcomeForm({ initialName, returning }: { initialName: string; returning: boolean }) {
  const navigate = useNavigate()
  const invalidateProfile = useInvalidateProfile()
  const [name, setName] = useState(initialName)
  // Ninguna casilla viene premarcada.
  const [adult, setAdult] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [terms, setTerms] = useState(false)
  const [promoConsent, setPromoConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  const nameValid = returning || (trimmed.length >= 1 && trimmed.length <= 60)
  const consentsOk = adult && privacy && terms
  const missing: string[] = []
  if (!adult) missing.push(legalCopy.consent.missingAdult)
  if (!privacy) missing.push(legalCopy.consent.missingPrivacy)
  if (!terms) missing.push(legalCopy.consent.missingTerms)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nameValid) return setError(copy.welcome.nameError)
    if (!consentsOk) return
    setBusy(true)
    setError(null)
    try {
      const consents = { adult, privacy, terms }
      if (returning) await acceptLegal(consents)
      else await completeOnboarding(trimmed, promoConsent, consents)
      await invalidateProfile()
      navigate(postLoginPath(), { replace: true })
    } catch {
      setError(copy.welcome.error)
      setBusy(false)
    }
  }

  return (
    <Screen className="justify-center gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <h1 className="font-display text-6xl leading-none">
          {returning ? legalCopy.consent.updateTitle : copy.welcome.title}
        </h1>
        <p className="text-muted text-lg">
          {returning ? legalCopy.consent.updateBody : copy.welcome.subtitle}
        </p>
        {!returning && (
          <TextField
            id="name"
            label={copy.welcome.nameLabel}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <Checkbox checked={adult} onChange={(e) => setAdult(e.target.checked)}>
          {legalCopy.consent.adult}
        </Checkbox>
        <Checkbox checked={privacy} onChange={(e) => setPrivacy(e.target.checked)}>
          {legalCopy.consent.privacyPrefix}{' '}
          <LegalLink to="/privacidad">{legalCopy.consent.privacyLink}</LegalLink>.
        </Checkbox>
        <Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)}>
          {legalCopy.consent.termsPrefix}{' '}
          <LegalLink to="/bases">{legalCopy.consent.termsLink1}</LegalLink>{' '}
          {legalCopy.consent.termsAnd}{' '}
          <LegalLink to="/normas">{legalCopy.consent.termsLink2}</LegalLink>.
        </Checkbox>
        {!returning && (
          <>
            <Checkbox checked={promoConsent} onChange={(e) => setPromoConsent(e.target.checked)}>
              {legalCopy.consent.promo}
            </Checkbox>
            <p className="text-muted text-xs">{legalCopy.consent.optionalNote}</p>
          </>
        )}
        {!consentsOk && (
          <div id="consent-hint" role="status" className="bg-track rounded-chip px-4 py-3 text-sm">
            <p className="font-bold">{legalCopy.consent.missingTitle}</p>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="text-brand-ink text-sm">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy || !consentsOk || !nameValid}
          aria-describedby={consentsOk ? undefined : 'consent-hint'}
        >
          {returning ? legalCopy.consent.updateSubmit : copy.welcome.submit}
        </Button>
      </form>
      <LegalFooter />
    </Screen>
  )
}
