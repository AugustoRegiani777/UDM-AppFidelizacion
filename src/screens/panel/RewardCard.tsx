import { useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import type { DashboardReward } from '@/features/dashboard/useDashboard'
import { ProgressBar } from '@/motion/ProgressBar'
import { copy } from '@/copy'

function remainingText(reward: DashboardReward): string {
  return reward.kind === 'points'
    ? copy.panel.remainingPoints(reward.remaining)
    : copy.panel.remainingPurchases(reward.remaining)
}

/** Un premio con su barra de avance y cuánto falta; desbloqueado ofrece canjearlo. */
export function RewardCard({ reward }: { reward: DashboardReward }) {
  const navigate = useNavigate()
  const done = reward.unlocked || reward.active_redemption !== null
  const almost = !done && reward.current / reward.threshold >= 0.8

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{reward.name}</h3>
          <p className="text-muted text-sm">{done ? reward.description : remainingText(reward)}</p>
          {reward.available > 1 && (
            <p className="text-green-ink text-sm font-bold">
              {copy.panel.availableCount(reward.available)}
            </p>
          )}
          {almost && <p className="text-brand-ink text-sm font-bold">{copy.panel.almost}</p>}
        </div>
        {done && (
          <span className="bg-green-soft text-green-ink shrink-0 rounded-full px-3 py-1 text-sm font-bold">
            {copy.panel.unlocked}
          </span>
        )}
      </div>
      <ProgressBar value={done ? 1 : reward.current / reward.threshold} label={reward.name} />
      {reward.active_redemption && (
        <Button variant="dark" onClick={() => navigate(`/canje/${reward.active_redemption?.id}`)}>
          {copy.redeem.viewCode}
        </Button>
      )}
      {reward.unlocked && (
        <Button onClick={() => navigate(`/cofre/${reward.id}`)}>{copy.chest.cta}</Button>
      )}
    </Card>
  )
}
