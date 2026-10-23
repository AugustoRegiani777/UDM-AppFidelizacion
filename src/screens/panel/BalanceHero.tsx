import { CountUp } from '@/motion/CountUp'
import { StreakFlame } from './StreakFlame'
import { copy } from '@/copy'

interface BalanceHeroProps {
  balance: number
  streakWeeks: number
  pending: number
}

/** El saldo es el protagonista de la pantalla. */
export function BalanceHero({ balance, streakWeeks, pending }: BalanceHeroProps) {
  return (
    <section aria-label={copy.panel.balanceLabel} className="text-center">
      <p className="text-muted font-semibold">{copy.panel.balanceLabel}</p>
      <CountUp value={balance} className="font-display text-brand block text-[96px] leading-none" />
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
