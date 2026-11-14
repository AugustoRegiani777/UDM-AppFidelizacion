import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { STAGE_COUNT } from '@engine/config.ts'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { setShowInRankings, type Board } from '@/features/economy/economyApi'
import {
  ninjaStars,
  parkStars,
  sokobanStars,
  trucoWins,
  unlockedTrack,
} from '@/features/arcade/progress'
import { storedRallyScore } from '@/games/rally/score'
import { reportScore } from '@/features/economy/reportScore'
import { useBoard, useCasualBoard, useWallet } from '@/features/economy/useEconomy'
import { copy } from '@/copy'

type Casual = 'racing' | 'skatepark' | 'sokoban' | 'ninja' | 'rally' | 'truco'
type Tab = 'survivors' | Casual | 'points'
// Para sumar un juego al ranking: agregarlo acá y en copy.ranking.games / unit.
const CASUAL: Casual[] = ['racing', 'rally', 'skatepark', 'sokoban', 'ninja', 'truco']
const TABS: Tab[] = ['survivors', ...CASUAL, 'points']
const isCasual = (tab: Tab): tab is Casual => CASUAL.includes(tab as Casual)
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab)

function Rows({ board, unit }: { board: Board; unit?: string }) {
  if (board.rows.length === 0) {
    return <p className="text-muted">{copy.ranking.empty}</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {board.rows.map((row, index) => (
        <li key={`${index}-${row.rank}-${row.name}`}>
          <Card
            className={`flex items-center gap-3 !py-3 ${row.me ? 'ring-brand ring-2' : ''}`}
            aria-current={row.me ? 'true' : undefined}
          >
            <span className="font-display w-9 text-2xl leading-none">{row.rank}º</span>
            <span className="min-w-0 flex-1 break-words font-bold">
              {row.name}
              {row.me && <span className="text-brand-ink"> · {copy.ranking.you}</span>}
            </span>
            <span className="font-display text-xl leading-none">
              {row.score.toLocaleString('es-AR')}
              {unit && (
                <span className="text-muted block text-right font-sans text-xs">{unit}</span>
              )}
            </span>
          </Card>
        </li>
      ))}
    </ol>
  )
}

/** Rankings por juego (y nivel) y el general por puntos acumulados. Solo cuentan partidas oficiales. */
export function RankingScreen() {
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const initialTab = params.get('juego')
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'survivors')
  const [stage, setStage] = useState(() => {
    const n = Number(params.get('nivel'))
    return Number.isInteger(n) && n >= 1 && n <= STAGE_COUNT ? n : 1
  })
  const [boosted, setBoosted] = useState(false)
  const official = tab === 'survivors' || tab === 'points'
  const officialBoard = useBoard(
    official ? tab : 'points',
    tab === 'survivors' ? stage : 1,
    boosted && tab === 'survivors',
  )
  const casualBoard = useCasualBoard(isCasual(tab) ? tab : 'ninja', isCasual(tab))
  const board = isCasual(tab) ? casualBoard : officialBoard
  const wallet = useWallet()
  const unit = isCasual(tab) ? copy.ranking.unit[tab] : ''
  const rowUnit = unit || (tab === 'survivors' ? copy.ranking.scoreUnit : copy.ranking.pointsUnit)

  // El progreso que ya había en este celular también cuenta (el servidor se queda con el mayor).
  useEffect(() => {
    void Promise.all([
      reportScore('ninja', sum(ninjaStars())),
      reportScore('skatepark', sum(parkStars())),
      reportScore('sokoban', sum(sokobanStars())),
      reportScore('racing', unlockedTrack() - 1),
      reportScore('rally', storedRallyScore()),
      reportScore('truco', trucoWins()),
    ]).then(() => queryClient.invalidateQueries({ queryKey: ['board'] }))
  }, [queryClient])

  const toggleVisibility = async () => {
    await setShowInRankings(!(wallet.data?.show_in_rankings ?? true))
    await queryClient.invalidateQueries({ queryKey: ['wallet'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
  }

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center self-start underline">
        {copy.ranking.backMenu}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.ranking.title}</h1>
      <p className="text-muted">{copy.ranking.subtitle}</p>

      <div role="tablist" aria-label={copy.ranking.gameLabel} className="flex flex-wrap gap-2">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-chip min-h-11 px-4 text-sm font-bold ${
              tab === id ? 'bg-brand text-white' : 'bg-surface text-muted'
            }`}
          >
            {copy.ranking.games[id]}
          </button>
        ))}
      </div>

      {tab === 'survivors' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={copy.ranking.stageLabel}>
          {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={stage === n}
              onClick={() => setStage(n)}
              className={`rounded-chip min-h-11 px-3 font-bold ${
                stage === n ? 'bg-brand-soft text-brand-ink' : 'bg-surface text-muted'
              }`}
            >
              {copy.arcade.stageLabel(n)}
            </button>
          ))}
        </div>
      )}

      {tab === 'survivors' && (
        <label className="text-muted flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand size-5"
            checked={boosted}
            onChange={(e) => setBoosted(e.target.checked)}
          />
          {copy.ranking.boosted}
        </label>
      )}
      {tab === 'survivors' && <p className="text-muted text-sm">{copy.arcade.stageName(stage)}</p>}
      {tab === 'points' && <p className="text-muted text-sm">{copy.ranking.pointsNote}</p>}
      {isCasual(tab) && <p className="text-muted text-sm">{copy.ranking.unofficialNote}</p>}

      {board.isPending && (
        <p className="text-muted" role="status">
          {copy.ranking.loading}
        </p>
      )}
      {board.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted">{copy.ranking.error}</p>
          <button
            type="button"
            className="rounded-chip bg-brand-soft text-brand-ink min-h-11 px-4 font-bold"
            onClick={() => void board.refetch()}
          >
            {copy.ranking.retry}
          </button>
        </div>
      )}
      {board.data && (
        <>
          <Rows board={board.data} unit={rowUnit} />
          <p className="font-bold">
            {board.data.me
              ? unit
                ? copy.ranking.yourRankUnit(board.data.me.rank, board.data.me.score, unit)
                : copy.ranking.yourRank(board.data.me.rank, board.data.me.score)
              : tab === 'points'
                ? copy.ranking.noPointsYet
                : isCasual(tab)
                  ? copy.ranking.notRankedCasual
                  : copy.ranking.notRanked}
          </p>
        </>
      )}

      <p className="text-muted text-sm">{copy.ranking.privacy}</p>
      <label className="text-muted flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-brand size-5"
          checked={!(wallet.data?.show_in_rankings ?? true)}
          onChange={() => void toggleVisibility()}
        />
        {copy.ranking.hideMe}
      </label>
    </Screen>
  )
}
