import { prizeOdds, useGamesConfig, type GameName } from '@/features/games/gameApi'
import { Sheet } from '@/motion/Sheet'
import { copy } from '@/copy'

interface GameRulesSheetProps {
  game: GameName
  open: boolean
  onClose: () => void
}

const percentFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

/** "¿Cómo funciona?": reglas claras y las probabilidades reales de cada premio. */
export function GameRulesSheet({ game, open, onClose }: GameRulesSheetProps) {
  const config = useGamesConfig()
  const gameConfig = config.data?.[game]
  const rules =
    game === 'scratch'
      ? copy.games.scratchRules(config.data?.scratch.valid_hours ?? 24)
      : copy.games.rouletteRules(config.data?.roulette.daily_limit ?? 1)

  return (
    <Sheet open={open} onClose={onClose} title={copy.games.howTitle}>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-muted">{rules}</p>
        <table className="w-full text-left">
          <caption className="sr-only">{copy.games.oddsCaption}</caption>
          <tbody className="divide-track divide-y">
            {gameConfig &&
              prizeOdds(gameConfig.prizes).map(({ prize, percent }) => (
                <tr key={prize.id}>
                  <td className="py-2 font-semibold">{prize.label}</td>
                  <td className="text-muted py-2 text-right">{percentFormat.format(percent)} %</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="text-muted text-sm">
          {copy.games.fairness(config.data?.daily_points_budget ?? 0)}
        </p>
      </div>
    </Sheet>
  )
}
