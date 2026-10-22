import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { copy } from '@/copy'

/** Alternativa sin cámara: pegar el link (o el código) de la compra. */
export function ManualCodeForm({ onSubmit }: { onSubmit: (text: string) => boolean }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setInvalid(!onSubmit(text))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h2 className="font-display text-2xl">{copy.scanner.manualTitle}</h2>
      <TextField
        id="manual-code"
        label={copy.scanner.manualLabel}
        value={text}
        autoComplete="off"
        autoCapitalize="off"
        onChange={(e) => {
          setText(e.target.value)
          setInvalid(false)
        }}
      />
      {invalid && (
        <p role="alert" className="text-brand-ink text-sm">
          {copy.scanner.manualInvalid}
        </p>
      )}
      <Button type="submit" variant="dark" disabled={!text.trim()}>
        {copy.scanner.manualSubmit}
      </Button>
    </form>
  )
}
