import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/TextField'
import {
  claimMission,
  useInvalidateMissions,
  type MissionClaim,
  type MissionConfig,
  type MissionId,
} from '@/features/missions/missionsApi'
import { Celebration } from '@/motion/Celebration'
import { copy } from '@/copy'

interface MissionCardProps {
  id: MissionId
  config: MissionConfig
  claim: MissionClaim | undefined
}

/** Una misión: abrir el link, avisar que se hizo y ver el estado (en revisión, sumada o rechazada). */
export function MissionCard({ id, config, claim }: MissionCardProps) {
  const text = copy.missions.items[id]
  const invalidate = useInvalidateMissions()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [justWon, setJustWon] = useState(false)

  async function submit() {
    setBusy(true)
    setError(false)
    try {
      const result = await claimMission(id, config.auto ? undefined : name)
      setJustWon(result.status === 'approved')
      await invalidate()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const active = claim && claim.status !== 'rejected'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{text.title}</h3>
          <p className="text-muted text-sm">{text.body}</p>
        </div>
        <span className="bg-brand-soft text-brand-ink shrink-0 rounded-full px-3 py-1 text-sm font-bold">
          {copy.missions.points(config.points)}
        </span>
      </div>

      {claim?.status === 'approved' && (
        <div className="flex items-center gap-3">
          {justWon && <Celebration className="text-green size-10" />}
          <p className="text-green-ink font-bold">{copy.missions.approved}</p>
        </div>
      )}
      {claim?.status === 'pending' && (
        <p className="text-muted font-semibold">{copy.missions.pending}</p>
      )}
      {claim?.status === 'rejected' && (
        <p role="status" className="text-brand-ink text-sm">
          {copy.missions.rejected}
        </p>
      )}

      {!active && (
        <>
          <a
            href={config.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ink text-bg grid min-h-12 place-items-center rounded-chip px-6 font-bold"
          >
            {text.cta}
          </a>
          {!config.auto && (
            <TextField
              id={`note-${id}`}
              label={copy.missions.nameLabel}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <Button
            variant="ghost"
            disabled={busy || (!config.auto && !name.trim())}
            onClick={() => void submit()}
          >
            {text.confirm}
          </Button>
          {error && (
            <p role="alert" className="text-brand-ink text-sm">
              {copy.missions.error}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
