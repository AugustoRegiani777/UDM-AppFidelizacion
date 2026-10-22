import QRCode from 'qrcode'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/TextField'
import { createMockSale, voidMockSale, type MockSaleInput } from './devApi'

interface CreatedSale {
  uuid: string
  link: string
  qr: string
}

/** Simula la tablet del POS: crea una venta falsa y muestra su QR para escanearlo con el celular. */
export function TabletSimulator() {
  const [euros, setEuros] = useState('12.40')
  const [channel, setChannel] = useState<MockSaleInput['channel']>('local')
  const [minutesAgo, setMinutesAgo] = useState('0')
  const [delaySeconds, setDelaySeconds] = useState('0')
  const [voided, setVoided] = useState(false)
  const [sale, setSale] = useState<CreatedSale | null>(null)
  const [message, setMessage] = useState('')

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const uuid = await createMockSale({
      total_cents: Math.round(Number(euros) * 100),
      channel,
      minutes_ago: Number(minutesAgo),
      delay_seconds: Number(delaySeconds),
      voided,
    })
    // El link usa el origen desde el que abriste /dev: abrilo por la IP de la compu para escanearlo desde el celular.
    const link = `${window.location.origin}/s/${uuid}`
    setSale({ uuid, link, qr: await QRCode.toDataURL(link, { width: 280, margin: 1 }) })
    setMessage('')
  }

  async function handleVoid() {
    if (!sale) return
    await voidMockSale(sale.uuid)
    setMessage('Venta anulada en el POS falso.')
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-3xl">Tablet (POS falso)</h2>
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <TextField
          id="euros"
          label="Total (€)"
          type="number"
          step="0.01"
          min="0"
          value={euros}
          onChange={(e) => setEuros(e.target.value)}
        />
        <label className="flex flex-col gap-1.5 text-left">
          <span className="text-muted text-sm font-semibold">Canal</span>
          <select
            className="bg-surface ring-track min-h-12 rounded-chip px-4 ring-2"
            value={channel}
            onChange={(e) => setChannel(e.target.value as MockSaleInput['channel'])}
          >
            <option value="local">Local</option>
            <option value="glovo">Glovo</option>
            <option value="togoo">Too Good To Go</option>
          </select>
        </label>
        <TextField
          id="minutes"
          label="Vendida hace (minutos)"
          type="number"
          min="0"
          value={minutesAgo}
          onChange={(e) => setMinutesAgo(e.target.value)}
        />
        <TextField
          id="delay"
          label="Aparece en el POS en (segundos)"
          type="number"
          min="0"
          value={delaySeconds}
          onChange={(e) => setDelaySeconds(e.target.value)}
        />
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="accent-brand size-6"
            checked={voided}
            onChange={(e) => setVoided(e.target.checked)}
          />
          <span>Ya viene anulada</span>
        </label>
        <Button type="submit" variant="dark">
          Crear venta y mostrar QR
        </Button>
      </form>

      {sale && (
        <div className="flex flex-col items-center gap-3">
          <img src={sale.qr} alt="QR de la venta" width={280} height={280} />
          <a href={sale.link} className="text-brand-ink text-sm break-all underline">
            {sale.link}
          </a>
          <Button variant="danger" onClick={handleVoid}>
            Anular esta venta
          </Button>
          {message && (
            <p role="status" className="text-green-ink text-sm">
              {message}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
