// Piezas compartidas por los juegos que tienen partida oficial (Sobreviví a las migas y Skate de Miga):
// el selector Práctica / Oficial, el resumen de lo que dio la partida y el texto de los errores.

import { Link } from 'react-router'
import type { FinishRunResult } from '@/features/economy/economyApi'
import { copy } from '@/copy'

export type PlayMode = 'practice' | 'official'

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PlayMode
  onChange: (mode: PlayMode) => void
}) {
  const options: { id: PlayMode; label: string }[] = [
    { id: 'practice', label: copy.economy.practice },
    { id: 'official', label: copy.economy.official },
  ]
  return (
    <div className="flex flex-col gap-1">
      <div
        role="radiogroup"
        aria-label={copy.economy.modeLabel}
        className="bg-surface rounded-chip flex gap-1 p-1"
      >
        {options.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => onChange(id)}
            className={`rounded-chip min-h-11 flex-1 px-3 font-bold ${
              mode === id ? 'bg-brand text-white' : 'text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-muted text-sm">
        {mode === 'official' ? copy.economy.officialBody : copy.arcade.practiceNotice}
      </p>
    </div>
  )
}

/** Lo que dio una partida oficial: puntaje, monedas, pase y un atajo al ranking. */
export function OfficialSummary({ result }: { result: FinishRunResult }) {
  return (
    <div className="flex flex-col items-center gap-1" data-testid="official-summary">
      <p className="font-display text-4xl leading-none">{copy.arcade.scoreLine(result.score)}</p>
      {result.new_best && <p className="text-brand-ink font-bold">{copy.economy.newBest}</p>}
      <p className="font-bold">
        {result.coins > 0 ? copy.economy.coinsEarned(result.coins) : copy.economy.coinsCapped}
      </p>
      {result.pass_granted && (
        <p className="bg-green-soft text-green-ink rounded-chip px-3 py-2 font-semibold">
          {copy.economy.passEarned}
        </p>
      )}
      <Link
        to={`/ranking?juego=${result.game}&nivel=${result.stage}`}
        className="min-h-12 content-center font-bold underline"
      >
        {copy.economy.seeRanking}
      </Link>
    </div>
  )
}
