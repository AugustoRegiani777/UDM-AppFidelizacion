import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import {
  barHeights,
  isOverviewEmpty,
  OVERVIEW_RANGES,
  sumSeries,
  useAdminOverview,
  type DayCount,
  type OverviewRange,
} from '@/features/admin/overview'
import { copy } from '@/copy'

const t = copy.admin.overview
const nf = (n: number) => n.toLocaleString('es-ES')

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-muted text-xs font-semibold">{label}</span>
      <span className="font-display text-3xl leading-none">{nf(value)}</span>
    </Card>
  )
}

/** Barras simples en SVG: una por día, el máximo ocupa todo el alto. */
function BarChart({ data, label }: { data: DayCount[]; label: string }) {
  const heights = barHeights(data)
  const total = sumSeries(data)
  const width = Math.max(data.length, 1)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-muted text-xs">{t.total(total)}</span>
      </div>
      <svg
        role="img"
        aria-label={`${label}: ${t.total(total)}`}
        viewBox={`0 0 ${width} 40`}
        preserveAspectRatio="none"
        className="bg-track/40 h-16 w-full rounded-chip"
      >
        {data.map((d, i) => (
          <rect
            key={d.day}
            x={i + 0.1}
            y={40 - (heights[i] ?? 0) * 40}
            width={0.8}
            height={(heights[i] ?? 0) * 40}
            className="fill-current text-brand-ink"
          >
            <title>{`${d.day}: ${d.count}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  )
}

/** Barras horizontales con CSS para rankings (premios, mejores clientes). */
function RankList({ rows }: { rows: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{row.label}</span>
            <strong>{nf(row.value)}</strong>
          </div>
          <div className="bg-track h-2 overflow-hidden rounded-full">
            <div
              className="bg-brand-ink h-full origin-left"
              style={{ transform: `scaleX(${row.value / max})` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Resumen general del negocio: usuarios, puntos, ventas, juegos y premios. */
export function OverviewSection() {
  const [days, setDays] = useState<OverviewRange>(30)
  const query = useAdminOverview(days)
  const data = query.data

  return (
    <section className="flex flex-col gap-3" data-testid="admin-overview">
      <h2 className="font-display text-3xl">{t.title}</h2>
      <div role="group" aria-label={t.rangeLabel} className="flex gap-2">
        {OVERVIEW_RANGES.map((range) => (
          <Button
            key={range}
            variant={range === days ? 'dark' : 'ghost'}
            aria-pressed={range === days}
            onClick={() => setDays(range)}
          >
            {t.range(range)}
          </Button>
        ))}
      </div>
      {query.isPending && <p className="text-muted">{t.loading}</p>}
      {query.isError && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-brand-ink">{t.error}</p>
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {t.retry}
          </Button>
        </div>
      )}
      {data && isOverviewEmpty(data) && <p className="text-muted">{t.empty}</p>}
      {data && !isOverviewEmpty(data) && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t.usersTotal} value={data.users.total} />
            <Stat label={t.active7} value={data.users.active_7d} />
            <Stat label={t.active30} value={data.users.active_30d} />
            <Stat label={t.pointsCirculating} value={data.points.circulating} />
            <Stat label={t.pointsIssued} value={data.points.issued} />
            <Stat label={t.pointsRedeemed} value={data.points.redeemed} />
          </div>
          <Card className="flex flex-col gap-4">
            <BarChart data={data.users.new_by_day} label={t.newUsers} />
            <BarChart data={data.sales.claimed_by_day} label={t.salesClaimed} />
            <BarChart data={data.sales.qr_scans_by_day} label={t.qrScans} />
          </Card>
          {data.points.top_customers.length > 0 && (
            <Card className="flex flex-col gap-2">
              <h3 className="font-bold">{t.topCustomers}</h3>
              <RankList
                rows={data.points.top_customers.map((c, i) => ({
                  key: `${i}-${c.display_name}`,
                  label: c.display_name,
                  value: c.balance,
                }))}
              />
            </Card>
          )}
          {data.games.map((game) => (
            <Card key={game.game} className="flex flex-col gap-2">
              <h3 className="font-bold">{t.gameNames[game.game] ?? game.game}</h3>
              <BarChart data={game.plays_by_day} label={t.plays} />
              <p className="text-muted text-sm">
                {t.gameSummary(game.plays_total, game.rewards_given, game.limit_hits)}
              </p>
            </Card>
          ))}
          {data.rewards.length > 0 && (
            <Card className="flex flex-col gap-2">
              <h3 className="font-bold">{t.rewards}</h3>
              <RankList
                rows={data.rewards.map((r) => ({
                  key: r.name,
                  label: r.name,
                  value: r.redemptions,
                }))}
              />
            </Card>
          )}
        </>
      )}
    </section>
  )
}
