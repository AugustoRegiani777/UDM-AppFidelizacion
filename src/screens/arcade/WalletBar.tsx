import { Link } from 'react-router'
import { useWallet } from '@/features/economy/useEconomy'
import { copy } from '@/copy'

/** Monedas y pases del cliente, más el acceso al ranking. Si todavía no cargó, no muestra nada. */
export function WalletBar() {
  const { data } = useWallet()
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
      {data && (
        <>
          <span className="bg-surface rounded-chip px-3 py-1.5" title={copy.economy.coinsHint}>
            <span aria-hidden>🪙 </span>
            {copy.economy.coinsLabel(data.coins)}
          </span>
          <span className="bg-surface rounded-chip px-3 py-1.5" title={copy.economy.passHint}>
            <span aria-hidden>🎟️ </span>
            {copy.economy.passesLabel(data.passes)}
          </span>
        </>
      )}
      <Link to="/tienda" className="rounded-chip bg-brand-soft text-brand-ink px-3 py-1.5">
        {copy.shop.link}
      </Link>
      <Link to="/ranking" className="rounded-chip bg-brand-soft text-brand-ink px-3 py-1.5">
        {copy.economy.rankingLink}
      </Link>
    </div>
  )
}
