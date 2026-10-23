import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import {
  CATEGORIES,
  errorCode,
  useSubmitPlace,
  type PlaceCategory,
} from '@/features/community/communityApi'
import { Sheet } from '@/motion/Sheet'
import { copy } from '@/copy'

const PLACE_POINTS = 30

interface AddPlaceSheetProps {
  open: boolean
  onClose: () => void
}

/** Formulario para proponer un lugar: queda pendiente hasta que el admin lo apruebe. */
export function AddPlaceSheet({ open, onClose }: AddPlaceSheetProps) {
  const submit = useSubmitPlace()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('pizzeria')
  const [mapsUrl, setMapsUrl] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit.mutate(
      { name, category, mapsUrl, address, note },
      {
        onSuccess: () => {
          setSent(true)
          setName('')
          setMapsUrl('')
          setAddress('')
          setNote('')
        },
      },
    )
  }

  function close() {
    setSent(false)
    submit.reset()
    onClose()
  }

  const error = submit.isError
    ? (copy.community.errors[errorCode(submit.error)] ?? copy.community.errorFallback)
    : null

  return (
    <Sheet open={open} onClose={close} title={copy.community.addTitle}>
      {sent ? (
        <div className="mt-3 flex flex-col gap-3">
          <p role="status" className="text-green-ink font-semibold">
            {copy.community.sent(PLACE_POINTS)}
          </p>
          <Button onClick={close}>{copy.community.done}</Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-3 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto"
        >
          <TextField
            id="place-name"
            label={copy.community.nameLabel}
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-muted text-sm font-semibold">{copy.community.categoryLabel}</span>
            <select
              className="bg-surface ring-track min-h-12 rounded-chip px-4 ring-2"
              value={category}
              onChange={(e) => setCategory(e.target.value as PlaceCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {copy.community.categoryLong[c]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            id="place-maps"
            label={copy.community.mapsLabel}
            type="url"
            inputMode="url"
            maxLength={500}
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
          />
          <TextField
            id="place-address"
            label={copy.community.addressLabel}
            maxLength={160}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <TextField
            id="place-note"
            label={copy.community.noteLabel}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-brand-ink text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submit.isPending || name.trim().length < 2}>
            {copy.community.send}
          </Button>
        </form>
      )}
    </Sheet>
  )
}
