import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { useDashboard, type Dashboard } from '@/features/dashboard/useDashboard'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { BalanceHero } from './BalanceHero'
import { EmptyState } from './EmptyState'
import { GamesSection } from './GamesSection'
import { PanelSkeleton } from './PanelSkeleton'
import { RecentPurchases } from './RecentPurchases'
import { RewardCard } from './RewardCard'

export function PanelScreen() {
  const dashboard = useDashboard()

  if (dashboard.isPending) return <PanelSkeleton />
  if (dashboard.isError) {
    return (
      <Screen className="justify-center gap-4 text-center">
        <p className="text-muted text-lg">{copy.panel.loadError}</p>
        <Button onClick={() => dashboard.refetch()}>{copy.panel.retry}</Button>
      </Screen>
    )
  }
  return <PanelContent data={dashboard.data} />
}

function PanelContent({ data }: { data: Dashboard }) {
  const isNew = data.recent_claims.length === 0

  return (
    <Screen className="gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{copy.panel.hello(data.profile.display_name)}</h1>
        <Link to="/perfil" className="text-muted min-h-12 content-center text-sm underline">
          {copy.panel.profile}
        </Link>
      </header>

      <BalanceHero
        balance={data.balance}
        streakWeeks={data.streak_weeks}
        pending={data.pending_count}
      />

      <Link
        to="/escanear"
        className="bg-brand grid min-h-14 place-items-center rounded-chip px-6 text-lg font-bold text-white"
      >
        {copy.panel.scanCta}
      </Link>

      {isNew && <EmptyState />}

      <section aria-labelledby="rewards" className="flex flex-col gap-3">
        <h2 id="rewards" className="font-display text-3xl">
          {copy.panel.rewardsTitle}
        </h2>
        <Cascade className="flex flex-col gap-3">
          {data.rewards.map((reward) => (
            <CascadeItem key={reward.id}>
              <RewardCard reward={reward} />
            </CascadeItem>
          ))}
        </Cascade>
      </section>

      <GamesSection />

      {!isNew && <RecentPurchases claims={data.recent_claims} />}
    </Screen>
  )
}
