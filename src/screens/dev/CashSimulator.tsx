import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/TextField'
import { validateAsPos } from './devApi'

/** Simula la caja del POS: carga el código del cliente y lo valida con HMAC, como el POS real. */
export function CashSimulator() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setResult(JSON.stringify(await validateAsPos(code.trim()), null, 2))
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-3xl">Caja (POS falso)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          id="cash-code"
          label="Código del cliente"
          placeholder="MIGA-7K3P"
          autoCapitalize="characters"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" variant="dark" disabled={!code.trim()}>
          Validar código
        </Button>
      </form>
      {result && <pre className="bg-track overflow-x-auto rounded-chip p-3 text-sm">{result}</pre>}
    </Card>
  )
}
