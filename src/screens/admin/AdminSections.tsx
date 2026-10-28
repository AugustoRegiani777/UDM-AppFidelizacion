import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/TextField'
import {
  createPlace,
  discoverGoogleLocations,
  type GoogleLocations,
  reviewComment,
  reviewMission,
  reviewPlace,
  syncGoogleReviews,
  type GoogleSyncResult,
  useEconomyStats,
  usePendingMissions,
  usePendingPlaces,
  useReportedComments,
} from '@/features/admin/adminApi'
import { CATEGORIES, type PlaceCategory } from '@/features/community/communityApi'
import { copy } from '@/copy'

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl">{title}</h2>
      {empty && <p className="text-muted">{copy.admin.nothingPending}</p>}
      {children}
    </section>
  )
}

function DecisionButtons({
  yes,
  no,
  onDecide,
}: {
  yes: string
  no: string
  onDecide: (accept: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const decide = async (accept: boolean) => {
    setBusy(true)
    try {
      await onDecide(accept)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex gap-2">
      <Button disabled={busy} onClick={() => void decide(true)}>
        {yes}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => void decide(false)}>
        {no}
      </Button>
    </div>
  )
}

/** Resumen de la última búsqueda de reseñas en Google. */
function syncMessage(result: GoogleSyncResult): string {
  if (!result.configured) return copy.admin.syncNotConfigured
  return copy.admin.syncDone(result.approved, result.suggested, result.new_reviews)
}

export function MissionsReview() {
  const queryClient = useQueryClient()
  const pending = usePendingMissions(true)
  const [syncing, setSyncing] = useState(false)
  const [syncText, setSyncText] = useState<string | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-pending-missions'] })

  async function sync() {
    setSyncing(true)
    try {
      setSyncText(syncMessage(await syncGoogleReviews()))
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      setSyncText(copy.admin.syncError)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Section title={copy.admin.missionsTitle} empty={pending.data?.length === 0}>
      <Button variant="ghost" disabled={syncing} onClick={() => void sync()}>
        {syncing ? copy.admin.syncing : copy.admin.syncGoogle}
      </Button>
      {syncText && (
        <p role="status" className="text-muted text-sm">
          {syncText}
        </p>
      )}
      {pending.data?.map((item) => {
        const text = copy.missions.items[item.mission as keyof typeof copy.missions.items]
        return (
          <Card key={item.id} className="flex flex-col gap-2">
            <p className="font-bold">{item.display_name}</p>
            <p className="text-muted text-sm">{text?.title ?? item.mission}</p>
            {item.note && (
              <p className="text-sm">
                {copy.admin.noteLabel}: <strong>{item.note}</strong>
              </p>
            )}
            {item.suggested && (
              <p className="bg-green-soft text-green-ink w-fit rounded-full px-3 py-1 text-xs font-bold">
                {copy.admin.suggested}
              </p>
            )}
            <DecisionButtons
              yes={copy.admin.approve}
              no={copy.admin.reject}
              onDecide={async (ok) => {
                await reviewMission(item.id, ok)
                await refresh()
              }}
            />
          </Card>
        )
      })}
    </Section>
  )
}

export function PlacesReview() {
  const queryClient = useQueryClient()
  const pending = usePendingPlaces(true)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-pending-places'] })
  return (
    <Section title={copy.admin.placesTitle} empty={pending.data?.length === 0}>
      {pending.data?.map((place) => (
        <Card key={place.id} className="flex flex-col gap-2">
          <p className="font-bold">{place.name}</p>
          <p className="text-muted text-sm">
            {copy.community.categoryLong[place.category as PlaceCategory]} · {place.display_name}
          </p>
          {place.address && <p className="text-sm">{place.address}</p>}
          {place.note && <p className="text-sm">{place.note}</p>}
          {place.maps_url && (
            <a
              href={place.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-ink font-bold underline"
            >
              {copy.community.openMaps}
            </a>
          )}
          <DecisionButtons
            yes={copy.admin.approve}
            no={copy.admin.reject}
            onDecide={async (ok) => {
              await reviewPlace(place.id, ok)
              await refresh()
            }}
          />
        </Card>
      ))}
    </Section>
  )
}

export function ReportedComments() {
  const queryClient = useQueryClient()
  const reported = useReportedComments(true)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-reported-comments'] })
  return (
    <Section title={copy.admin.reportedTitle} empty={reported.data?.length === 0}>
      {reported.data?.map((comment) => (
        <Card key={comment.id} className="flex flex-col gap-2">
          <p className="text-muted text-xs font-bold">
            {comment.place} · {copy.admin.reports(comment.reports)}
          </p>
          <p>{comment.body}</p>
          <DecisionButtons
            yes={copy.admin.keep}
            no={copy.admin.remove}
            onDecide={async (keep) => {
              await reviewComment(comment.id, keep)
              await refresh()
            }}
          />
        </Card>
      ))}
    </Section>
  )
}

/** Para arrancar con lugares ya cargados: el admin los da de alta directamente aprobados. */
export function CreatePlace() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('pizzeria')
  const [mapsUrl, setMapsUrl] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFailed(false)
    try {
      await createPlace({ name, category, mapsUrl, address, note })
      setDone(true)
      setName('')
      setMapsUrl('')
      setAddress('')
      setNote('')
      await queryClient.invalidateQueries({ queryKey: ['places'] })
    } catch {
      setFailed(true)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl">{copy.admin.createTitle}</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          id="admin-place-name"
          label={copy.community.nameLabel}
          required
          minLength={2}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDone(false)
          }}
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
          id="admin-place-maps"
          label={copy.community.mapsLabel}
          type="url"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
        />
        <TextField
          id="admin-place-address"
          label={copy.community.addressLabel}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <TextField
          id="admin-place-note"
          label={copy.community.noteLabel}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" variant="dark" disabled={name.trim().length < 2}>
          {copy.admin.create}
        </Button>
        {done && (
          <p role="status" className="text-green-ink font-semibold">
            {copy.admin.created}
          </p>
        )}
        {failed && (
          <p role="alert" className="text-brand-ink text-sm">
            {copy.community.errorFallback}
          </p>
        )}
      </form>
    </section>
  )
}

/** Ayuda para configurar la verificación automática: muestra el código del local en Google. */
export function GoogleSetup() {
  const [found, setFound] = useState<GoogleLocations | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  async function discover() {
    setBusy(true)
    setFailed(false)
    try {
      setFound(await discoverGoogleLocations())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const locations = found?.accounts.flatMap((account) => account.locations) ?? []
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl">{copy.admin.discoverTitle}</h2>
      <p className="text-muted text-sm">{copy.admin.discoverHelp}</p>
      <Button variant="ghost" disabled={busy} onClick={() => void discover()}>
        {copy.admin.discoverButton}
      </Button>
      {failed && (
        <p role="alert" className="text-brand-ink text-sm">
          {copy.admin.discoverError}
        </p>
      )}
      {found && locations.length === 0 && <p className="text-muted">{copy.admin.discoverEmpty}</p>}
      {locations.map((location) => (
        <Card key={location.name} className="flex flex-col gap-1">
          <p className="font-bold">{location.title}</p>
          <code className="text-sm break-all select-all">{location.name}</code>
        </Card>
      ))}
    </section>
  )
}

const euros = (cents: number) =>
  `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Cuánto cuestan los premios sobre las ventas, para ajustar los precios con datos reales. */
export function EconomyStats() {
  const stats = useEconomyStats(true)
  const data = stats.data
  const lines = [...(data?.rewards ?? []), ...(data?.shop ?? [])]
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-3xl">{copy.admin.economyTitle}</h2>
      <p className="text-muted text-sm">{copy.admin.economyHelp}</p>
      {stats.isPending && <p className="text-muted">{copy.admin.economyLoading}</p>}
      {data && (
        <Card className="flex flex-col gap-2">
          <p>{copy.admin.economySales(euros(data.revenue_cents), data.purchases, data.days)}</p>
          <p className="font-display text-4xl leading-none" data-testid="economy-cost">
            {data.cost_percent === null
              ? copy.admin.economyNoSales
              : copy.admin.economyCost(euros(data.cost_cents), data.cost_percent)}
          </p>
          {lines.length > 0 && (
            <ul className="text-muted text-sm">
              {lines.map((line) => (
                <li key={line.name}>
                  {copy.admin.economyLine(line.name, line.count, euros(line.total_cents))}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted text-sm">
            {copy.admin.economyGames(
              data.players,
              data.runs,
              data.coins_given,
              data.passes_given,
              data.passes_used,
              data.points_spent,
            )}
          </p>
        </Card>
      )}
    </section>
  )
}
