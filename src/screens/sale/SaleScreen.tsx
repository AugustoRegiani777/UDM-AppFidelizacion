import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import type { ClaimResult } from '@/features/claims/claimApi'
import { useClaimSale } from '@/features/claims/useClaimSale'
import { CountUp } from '@/motion/CountUp'
import { copy } from '@/copy'

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
    return <Message title={copy.sale.pendingTitle} body={copy.sale.pendingBody} />
  }
  if (result.status === 'rejected') {
    const body = copy.sale.rejected[result.reason] ?? copy.sale.rejectedFallback
    return <Message title={copy.sale.rejectedTitle} body={body} />
  }
  return <Message title={copy.sale.repeatTitle} body={copy.sale.repeatBody} />
}

function ConfirmedView({ result }: { result: Extract<ClaimResult, { status: 'confirmed' }> }) {
  const unlocked = result.unlocked?.[0]
  return (
    <Screen className="items-center justify-center gap-4 text-center">
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
      <PanelLink />
    </Screen>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Screen className="justify-center gap-4 text-center">
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
