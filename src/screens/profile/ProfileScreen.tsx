import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { TextField } from '@/components/TextField'
import { signOut } from '@/features/auth/signIn'
import { deleteAccount, updateProfile } from '@/features/profile/profileApi'
import { useInvalidateProfile, useProfile } from '@/features/profile/useProfile'
import { copy } from '@/copy'

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
        <Button type="submit" disabled={!name.trim()}>
          {copy.profile.save}
        </Button>
        {saved && (
          <p role="status" className="text-green-ink text-sm">
            {copy.profile.saved}
          </p>
        )}
      </form>
      <Button variant="ghost" onClick={() => signOut()}>
        {copy.profile.signOut}
      </Button>
      <DeleteAccount />
    </Screen>
  )
}

function DeleteAccount() {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
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

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {copy.profile.deleteTitle}
      </Button>
    )
  }

  return (
    <div className="bg-brand-soft rounded-card flex flex-col gap-3 p-4">
      <p className="text-sm">{copy.profile.deleteBody}</p>
      {error && (
        <p role="alert" className="text-brand-ink text-sm">
          {copy.profile.deleteError}
        </p>
      )}
      <Button variant="danger" disabled={busy} onClick={handleDelete}>
        {copy.profile.deleteConfirm}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        {copy.profile.deleteCancel}
      </Button>
    </div>
  )
}
