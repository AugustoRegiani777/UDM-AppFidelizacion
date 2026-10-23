import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import type { ClaimResult } from '@/features/claims/claimApi'
import { useClaimSale } from '@/features/claims/useClaimSale'
import { Celebration } from '@/motion/Celebration'
import { CountUp } from '@/motion/CountUp'
import { usePopups } from '@/motion/usePopups'
import { copy } from '@/copy'
import { RewardUnlockedPopup } from './RewardUnlockedPopup'

/** Resultado de escanear una venta: sumada, repetida, pendiente, rechazada o error amable. */
export function SaleScreen() {
  const { uuid = '' } = useParams()
  const claim = useClaimSale(uuid)

  if (claim.isPending) return <FullScreenLoader />
  if (claim.isError) return <ErrorView onRetry={() => claim.refetch()} />
  return <ResultView result={claim.data} />
}

function ResultView({ result }: { result: ClaimResult }) {
  if (result.status === 'confirmed' && !result.repeat) return <ConfirmedView result={result} />
  if (result.status === 'pending') {
    return <Message title={copy.sale.pendingTitle} body={copy.sale.pendingBody} calm />
  }
  if (result.status === 'rejected') {
    const body = copy.sale.rejected[result.reason] ?? copy.sale.rejectedFallback
    return <Message title={copy.sale.rejectedTitle} body={body} />
  }
  return <Message title={copy.sale.repeatTitle} body={copy.sale.repeatBody} />
}

function ConfirmedView({ result }: { result: Extract<ClaimResult, { status: 'confirmed' }> }) {
  const unlocked = result.unlocked?.[0]
  const { show } = usePopups()

  // El regalo se abre un momento después, para que se disfrute primero el "+puntos".
  useEffect(() => {
    if (!unlocked) return
    const timer = window.setTimeout(
      () =>
        show({
          id: `unlocked-${unlocked.id}`,
          render: (close) => <RewardUnlockedPopup reward={unlocked} onClose={close} />,
        }),
      1600,
    )
    return () => window.clearTimeout(timer)
  }, [unlocked, show])

  return (
    <Screen className="items-center justify-center gap-4 text-center">
      <Celebration className="text-green" />
      <p className="text-green-ink text-xl font-bold">{copy.sale.confirmedTitle(result.points)}</p>
      <p className="font-display text-brand text-[96px] leading-none">
        +<CountUp value={result.points} />
      </p>
      <p className="text-muted">
        {copy.sale.balanceLabel}:{' '}
        <CountUp value={result.balance} from={result.balance - result.points} /> {copy.sale.points}
      </p>
      <p className="text-lg">
        {unlocked ? copy.sale.unlocked(unlocked.name) : copy.sale.confirmedGeneric}
      </p>
      <Link to={`/raspadita/${result.claim_id}`} className="font-bold underline">
        {copy.games.scratchTitle}
      </Link>
      <PanelLink />
    </Screen>
  )
}

/** Círculo que respira despacio: señal calma de "esperando", nunca roja ni alarmante. */
function BreathingDot() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      aria-hidden
      className="bg-track mx-auto size-16 rounded-full"
      animate={reduce ? undefined : { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    />
  )
}

function Message({ title, body, calm = false }: { title: string; body: string; calm?: boolean }) {
  return (
    <Screen className="justify-center gap-4 text-center">
      {calm && <BreathingDot />}
      <h1 className="font-display text-5xl leading-none">{title}</h1>
      <p className="text-muted text-lg">{body}</p>
      <PanelLink />
    </Screen>
  )
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen className="justify-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none">{copy.sale.errorTitle}</h1>
      <p className="text-muted text-lg">{copy.sale.errorBody}</p>
      <Button onClick={onRetry}>{copy.sale.retry}</Button>
      <PanelLink />
    </Screen>
  )
}

function PanelLink() {
  return (
    <Link to="/panel" className="mt-4 font-bold underline">
      {copy.sale.toPanel}
    </Link>
  )
}
