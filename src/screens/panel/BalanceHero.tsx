import { CountUp } from '@/motion/CountUp'
import { useWallet } from '@/features/economy/useEconomy'
import { StreakFlame } from './StreakFlame'
import { copy } from '@/copy'

interface BalanceHeroProps {
  /** Puntos de compras: abren los premios. */
  ladderPoints: number
  /** Total acumulado (incluye juegos, misiones y comunidad). */
  balance: number
  streakWeeks: number
  pending: number
}

/** El saldo es el protagonista de la pantalla. */
export function BalanceHero({ ladderPoints, balance, streakWeeks, pending }: BalanceHeroProps) {
  const wallet = useWallet()
  return (
    <section aria-label={copy.panel.balanceLabel} className="text-center">
      <p className="text-muted font-semibold">{copy.panel.balanceLabel}</p>
      <CountUp
        value={ladderPoints}
        className="font-display text-brand block text-[96px] leading-none"
      />
      {wallet.data && (balance !== ladderPoints || wallet.data.spendable !== ladderPoints) && (
        <p className="text-muted mt-1 text-sm font-semibold">
          {copy.panel.shopPointsLabel(wallet.data.spendable)}
        </p>
      )}
      <p className="text-muted mx-auto mt-2 max-w-xs text-sm">{copy.panel.balanceHint}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {streakWeeks > 0 && <StreakFlame weeks={streakWeeks} />}
        {pending > 0 && (
          <span className="bg-track text-ink rounded-full px-3 py-1 text-sm font-semibold">
            {copy.panel.pending(pending)}
          </span>
        )}
      </div>
    </section>
  )
}
