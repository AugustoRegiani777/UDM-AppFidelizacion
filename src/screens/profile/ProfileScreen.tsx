import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { LegalFooter } from '@/components/LegalFooter'
import { Screen } from '@/components/Screen'
import { TextField } from '@/components/TextField'
import { SaveProgress } from '@/features/auth/SaveProgress'
import { signOut } from '@/features/auth/signIn'
import { useIsGuest } from '@/features/auth/useIsGuest'
import { deleteAccount, downloadMyData, updateProfile } from '@/features/profile/profileApi'
import { useInvalidateProfile, useProfile } from '@/features/profile/useProfile'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { Sheet } from '@/motion/Sheet'
import { useIsAdmin } from '@/features/admin/adminApi'
import { copy } from '@/copy'
import { legalCopy } from '@/copy/legal'
import { company } from '@/legal'

export function ProfileScreen() {
  const profile = useProfile()
  if (profile.isPending) return <FullScreenLoader />
  if (profile.isError) throw profile.error
  return <ProfileForm name={profile.data.display_name} promo={profile.data.promo_consent} />
}

function ProfileForm({ name: initialName, promo }: { name: string; promo: boolean }) {
  const invalidateProfile = useInvalidateProfile()
  const [name, setName] = useState(initialName)
  const [promoConsent, setPromoConsent] = useState(promo)
  const [saved, setSaved] = useState(false)
  const isGuest = useIsGuest()

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    await updateProfile(name.trim(), promoConsent)
    await invalidateProfile()
    setSaved(true)
  }

  return (
    <Screen className="gap-6">
      <Link to="/panel" className="underline">
        {copy.profile.back}
      </Link>
      <h1 className="font-display text-5xl">{copy.profile.title}</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <TextField
          id="name"
          label={copy.profile.nameLabel}
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
        />
        <Checkbox
          checked={promoConsent}
          onChange={(e) => {
            setPromoConsent(e.target.checked)
            setSaved(false)
          }}
        >
          {copy.profile.promoConsent}
        </Checkbox>
        <p className="text-muted text-xs">{legalCopy.profile.promoHelp}</p>
        <Button type="submit" disabled={!name.trim()}>
          {copy.profile.save}
        </Button>
        {saved && (
          <p role="status" className="text-green-ink text-sm">
            {copy.profile.saved}
          </p>
        )}
      </form>
      <SaveProgress />
      <AdminLink />
      <SoundToggle />
      <Button variant="ghost" onClick={() => signOut()}>
        {isGuest ? copy.profile.signOutGuest : copy.profile.signOut}
      </Button>
      {isGuest && <p className="text-muted text-sm">{copy.profile.guestWarning}</p>}
      <MyData />
      <DeleteAccount />
      <LegalFooter />
    </Screen>
  )
}

function AdminLink() {
  const isAdmin = useIsAdmin()
  if (!isAdmin.data) return null
  return (
    <Link to="/admin" className="font-bold underline">
      {copy.admin.link}
    </Link>
  )
}

function SoundToggle() {
  const enabled = useSoundEnabled()
  return (
    <Checkbox checked={enabled} onChange={(e) => setSoundEnabled(e.target.checked)}>
      {copy.profile.sound}
    </Checkbox>
  )
}

/** Derechos de acceso y portabilidad: descargar todos los datos propios, y cómo pedir el resto. */
function MyData() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function handleDownload() {
    setState('busy')
    try {
      await downloadMyData()
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <section aria-labelledby="my-data" className="flex flex-col gap-3">
      <h2 id="my-data" className="font-display text-2xl">
        {legalCopy.profile.dataTitle}
      </h2>
      <p className="text-muted text-sm">{legalCopy.profile.dataBody}</p>
      <Button variant="ghost" disabled={state === 'busy'} onClick={handleDownload}>
        {state === 'busy' ? legalCopy.profile.downloading : legalCopy.profile.download}
      </Button>
      {state === 'done' && (
        <p role="status" className="text-green-ink text-sm">
          {legalCopy.profile.downloaded}
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="text-brand-ink text-sm">
          {legalCopy.profile.downloadError}
        </p>
      )}
      <p className="text-muted text-xs">{legalCopy.profile.contact(company.contactEmail)}</p>
    </section>
  )
}

function DeleteAccount() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    setError(false)
    try {
      await deleteAccount()
      navigate('/', { replace: true })
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {copy.profile.deleteTitle}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={copy.profile.deleteTitle}>
        <div className="mt-3 flex flex-col gap-3">
          <p className="font-bold">{legalCopy.profile.deleteAsk}</p>
          <p className="text-muted">{legalCopy.profile.deleteBody}</p>
          <p className="text-muted text-sm">{legalCopy.profile.deleteKept}</p>
          {error && (
            <p role="alert" className="text-brand-ink text-sm">
              {copy.profile.deleteError}
            </p>
          )}
          <Button variant="danger" disabled={busy} onClick={handleDelete}>
            {copy.profile.deleteConfirm}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {copy.profile.deleteCancel}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
