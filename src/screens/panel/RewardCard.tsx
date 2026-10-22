import { Card } from '@/components/Card'
import type { DashboardReward } from '@/features/dashboard/useDashboard'
import { ProgressBar } from '@/motion/ProgressBar'
import { copy } from '@/copy'

function remainingText(reward: DashboardReward): string {
  return reward.kind === 'points'
    ? copy.panel.remainingPoints(reward.remaining)
    : copy.panel.remainingPurchases(reward.remaining)
}

/** Un premio con su barra de avance y cuánto falta (o "Desbloqueado"). */
export function RewardCard({ reward }: { reward: DashboardReward }) {
  const done = reward.unlocked || reward.active_redemption !== null
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{reward.name}</h3>
          <p className="text-muted text-sm">{done ? reward.description : remainingText(reward)}</p>
        </div>
        {done && (
          <span className="bg-green-soft text-green-ink shrink-0 rounded-full px-3 py-1 text-sm font-bold">
            {copy.panel.unlocked}
          </span>
        )}
      </div>
      <ProgressBar value={done ? 1 : reward.current / reward.threshold} label={reward.name} />
    </Card>
  )
}
