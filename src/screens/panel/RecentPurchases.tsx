import { Link } from 'react-router'
import { Card } from '@/components/Card'
import type { DashboardClaim } from '@/features/dashboard/useDashboard'
import { copy } from '@/copy'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function ClaimRow({ claim }: { claim: DashboardClaim }) {
  const when = dateFormat.format(new Date(claim.sale_at ?? claim.created_at))
  const right =
    claim.status === 'pending'
      ? copy.panel.claimPending
      : claim.status === 'reversed'
        ? copy.panel.claimReversed
        : copy.panel.claimPoints(claim.points)
  const rightClass =
    claim.status === 'confirmed' ? 'text-green-ink font-bold' : 'text-muted text-sm'

  return (
    <li className="flex items-center justify-between py-3">
      <span className="text-muted text-sm">{when}</span>
      <span className={rightClass}>{right}</span>
    </li>
  )
}

export function RecentPurchases({ claims }: { claims: DashboardClaim[] }) {
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-3">
      <h2 id="recent" className="font-display text-3xl">
        {copy.panel.recentTitle}
      </h2>
      <Card className="py-2">
        <ul className="divide-track divide-y">
          {claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} />
          ))}
        </ul>
      </Card>
      <Link to="/historial" className="text-center font-semibold underline">
        {copy.panel.seeAll}
      </Link>
    </section>
  )
}
