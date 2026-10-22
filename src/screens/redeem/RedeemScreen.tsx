import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import type { RedemptionDetail } from '@/features/redemptions/redemptionApi'
import {
  formatCountdown,
  useCountdown,
  useCreateRedemption,
  useRedemption,
} from '@/features/redemptions/useRedemption'
import { copy } from '@/copy'

/** Código de canje con cuenta regresiva real (el vencimiento lo fija el servidor). */
export function RedeemScreen() {
  const { id = '' } = useParams()
  const redemption = useRedemption(id)

  if (redemption.isPending) return <FullScreenLoader />
  if (redemption.isError) throw redemption.error
  if (!redemption.data) return <Notice title={copy.redeem.notFound} />
  return <RedemptionView redemption={redemption.data} />
}

function RedemptionView({ redemption }: { redemption: RedemptionDetail }) {
  const remaining = useCountdown(redemption.expires_at)
  const rewardName = redemption.reward?.name ?? ''

  if (redemption.status === 'used') {
    return <Notice title={copy.redeem.usedTitle(rewardName)} body={copy.redeem.usedBody} />
  }
  if (redemption.status === 'expired' || remaining === 0) {
    return <ExpiredView rewardId={redemption.reward_id} />
  }

  return (
    <Screen className="items-center justify-center gap-4 text-center">
      <p className="text-muted font-semibold">{copy.redeem.title}</p>
      <h1 className="text-2xl font-bold">{rewardName}</h1>
      <p
        className="font-display text-brand rounded-card bg-surface px-6 py-4 text-[64px] leading-none tracking-wider"
        aria-label={redemption.code}
      >
        {redemption.code}
      </p>
      <p className="text-lg">{copy.redeem.instructions}</p>
      <p role="timer" className="text-muted font-semibold">
        {copy.redeem.expiresIn(formatCountdown(remaining))}
      </p>
      <BackLink />
    </Screen>
  )
}

function ExpiredView({ rewardId }: { rewardId: string }) {
  const navigate = useNavigate()
  const create = useCreateRedemption()

  return (
    <Screen className="justify-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none">{copy.redeem.expiredTitle}</h1>
      <p className="text-muted text-lg">{copy.redeem.expiredBody}</p>
      {create.isError && (
        <p role="alert" className="text-brand-ink">
          {copy.redeem.error}
        </p>
      )}
      <Button
        disabled={create.isPending}
        onClick={() =>
          create.mutate(rewardId, {
            onSuccess: (next) => navigate(`/canje/${next.id}`, { replace: true }),
          })
        }
      >
        {copy.redeem.regenerate}
      </Button>
      <BackLink />
    </Screen>
  )
}

function Notice({ title, body }: { title: string; body?: string }) {
  return (
    <Screen className="justify-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none">{title}</h1>
      {body && <p className="text-muted text-lg">{body}</p>}
      <BackLink />
    </Screen>
  )
}

function BackLink() {
  return (
    <Link to="/panel" className="mt-4 min-h-12 content-center font-bold underline">
      {copy.redeem.backToPanel}
    </Link>
  )
}
