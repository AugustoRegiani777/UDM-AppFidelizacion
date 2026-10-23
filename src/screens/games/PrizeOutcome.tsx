import { Celebration } from '@/motion/Celebration'
import { CountUp } from '@/motion/CountUp'
import { copy } from '@/copy'

/** Resultado de un juego: con premio se celebra; sin premio, un mensaje cálido y sin culpa. */
export function PrizeOutcome({ points, nextHint }: { points: number; nextHint: string }) {
  if (points > 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <Celebration className="text-green size-16" />
        <p className="font-display text-brand text-6xl leading-none">
          +<CountUp value={points} />
        </p>
        <p className="text-lg font-semibold">{copy.games.won(points)}</p>
      </div>
    )
  }
  return (
    <div className="text-center">
      <p className="text-lg font-semibold">{copy.games.noPrize}</p>
      <p className="text-muted">{nextHint}</p>
    </div>
  )
}
