import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { STAGE_COUNT } from '@engine/config.ts'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { setShowInRankings, type Board } from '@/features/economy/economyApi'
import { useBoard, useWallet } from '@/features/economy/useEconomy'
import { copy } from '@/copy'

type Tab = 'survivors' | 'skate' | 'points'
const TABS: Tab[] = ['survivors', 'skate', 'points']

const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab)

function Rows({ board }: { board: Board }) {
  if (board.rows.length === 0) {
    return <p className="text-muted">{copy.ranking.empty}</p>
  }
  return (
    <ol className="flex flex-col gap-2">
      {board.rows.map((row) => (
        <li key={`${row.rank}-${row.name}`}>
          <Card
            className={`flex items-center gap-3 !py-3 ${row.me ? 'ring-brand ring-2' : ''}`}
            aria-current={row.me ? 'true' : undefined}
          >
            <span className="font-display w-9 text-2xl leading-none">{row.rank}º</span>
            <span className="flex-1 font-bold">
              {row.name}
              {row.me && <span className="text-brand-ink"> · {copy.ranking.you}</span>}
            </span>
            <span className="font-display text-xl leading-none">{row.score}</span>
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
  const board = useBoard(tab, tab === 'survivors' ? stage : 1)
  const wallet = useWallet()

  const toggleVisibility = async () => {
    await setShowInRankings(!(wallet.data?.show_in_rankings ?? true))
    await queryClient.invalidateQueries({ queryKey: ['wallet'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
  }

  return (
    <Screen className="gap-4">
      <Link to="/juegos" className="min-h-12 content-center self-start underline">
        {copy.ranking.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.ranking.title}</h1>
      <p className="text-muted">{copy.ranking.subtitle}</p>

      <div
        role="tablist"
        aria-label={copy.ranking.title}
        className="bg-surface rounded-chip flex gap-1 p-1"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-chip min-h-11 flex-1 px-2 text-sm font-bold ${
              tab === id ? 'bg-brand text-white' : 'text-muted'
            }`}
          >
            {copy.ranking.tabs[id]}
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
              className={`rounded-chip min-h-11 min-w-11 px-3 font-bold ${
                stage === n ? 'bg-brand-soft text-brand-ink' : 'bg-surface text-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {tab !== 'points' && (
        <p className="text-muted text-sm">
          {tab === 'survivors' ? copy.arcade.stageName(stage) : copy.ranking.skateNote}
        </p>
      )}
      {tab === 'points' && <p className="text-muted text-sm">{copy.ranking.pointsNote}</p>}

      {board.isPending && (
        <p className="text-muted" role="status">
          {copy.ranking.loading}
        </p>
      )}
      {board.isError && <p className="text-muted">{copy.ranking.error}</p>}
      {board.data && (
        <>
          <Rows board={board.data} />
          <p className="font-bold">
            {board.data.me
              ? copy.ranking.yourRank(board.data.me.rank, board.data.me.score)
              : tab === 'points'
                ? copy.ranking.noPointsYet
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
