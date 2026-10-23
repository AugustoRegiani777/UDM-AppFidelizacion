import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { useGamesStatus } from '@/features/games/gameApi'
import { copy } from '@/copy'

/** Juegos disponibles ahora. Solo se muestra lo que realmente se puede jugar o el límite real del día. */
export function GamesSection() {
  const status = useGamesStatus()
  if (!status.data) return null
  const { roulette, scratch_claim_id: scratchClaimId } = status.data
  if (!roulette.enabled && !scratchClaimId) return null

  return (
    <section aria-labelledby="games" className="flex flex-col gap-3">
      <h2 id="games" className="font-display text-3xl">
        {copy.games.sectionTitle}
      </h2>
      {scratchClaimId && (
        <Link to={`/raspadita/${scratchClaimId}`}>
          <Card className="flex items-center justify-between">
            <span className="font-bold">{copy.games.scratchTitle}</span>
            <span className="text-brand-ink font-semibold">{copy.games.play}</span>
          </Card>
        </Link>
      )}
      {roulette.enabled && (
        <Link to="/ruleta">
          <Card className="flex items-center justify-between">
            <span className="font-bold">{copy.games.rouletteTitle}</span>
            <span
              className={roulette.available ? 'text-brand-ink font-semibold' : 'text-muted text-sm'}
            >
              {roulette.available ? copy.games.play : copy.games.rouletteDone}
            </span>
          </Card>
        </Link>
      )}
    </section>
  )
}
