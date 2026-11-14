import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import {
  buyItem,
  buyPassWithCoins,
  RunError,
  type BuyResult,
  type ShopItem,
} from '@/features/economy/economyApi'
import { useCatalog, useOrders, useWallet } from '@/features/economy/useEconomy'
import { copy } from '@/copy'

type Tab = 'upgrades' | 'vouchers' | 'passes'
const TABS: Tab[] = ['upgrades', 'vouchers', 'passes']

function ShopMessage({ message }: { message: { text: string; code?: string; error?: boolean } }) {
  return (
    <div
      role="status"
      className={`rounded-card w-full basis-full px-4 py-3 font-semibold ${
        message.error ? 'bg-brand-soft text-brand-ink' : 'bg-green-soft text-green-ink'
      }`}
    >
      <p>{message.text}</p>
      {message.code && (
        <p className="font-display mt-1 text-4xl tracking-wider" aria-label={message.code}>
          {message.code}
        </p>
      )}
    </div>
  )
}

/** Tienda: mejoras y premios del local con puntos de tienda; pases con monedas de juego. */
export function ShopScreen() {
  const queryClient = useQueryClient()
  const wallet = useWallet()
  const catalog = useCatalog()
  const orders = useOrders()
  const [tab, setTab] = useState<Tab>('upgrades')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    text: string
    code?: string
    error?: boolean
    /** Dónde se muestra: junto al botón que se tocó. */
    anchor: string
  } | null>(null)

  const refresh = async () => {
    await Promise.all(
      ['wallet', 'shop'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )
  }

  const fail = (error: unknown, anchor: string) => {
    const code = error instanceof RunError ? error.code : ''
    const text =
      code === 'not_enough_points'
        ? copy.shop.notEnough
        : code === 'not_enough_coins'
          ? copy.shop.notEnoughCoins
          : code === 'pass_cap_reached'
            ? copy.shop.passCap
            : code === 'max_level'
              ? copy.shop.maxed
              : copy.shop.errorBody
    setMessage({ text, error: true, anchor })
  }

  const buy = async (item: ShopItem) => {
    setBusy(true)
    setMessage(null)
    try {
      const result: BuyResult = await buyItem(item.id)
      setMessage(
        result.kind === 'upgrade'
          ? { text: copy.shop.upgradeDone(result.name, result.level), anchor: item.id }
          : { text: copy.shop.voucherDone, code: result.code, anchor: item.id },
      )
      await refresh()
    } catch (error) {
      fail(error, item.id)
    } finally {
      setBusy(false)
    }
  }

  const buyPass = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await buyPassWithCoins()
      setMessage({ text: copy.shop.passDone, anchor: 'pass' })
      await refresh()
    } catch (error) {
      fail(error, 'pass')
    } finally {
      setBusy(false)
    }
  }

  const messageFor = (anchor: string) =>
    message?.anchor === anchor ? <ShopMessage message={message} /> : null

  const items = (catalog.data?.items ?? []).filter((item) =>
    tab === 'upgrades' ? item.kind === 'upgrade' : item.kind === 'voucher',
  )
  const spendable = wallet.data?.spendable ?? 0
  const coins = wallet.data?.coins ?? 0
  const passPrice = catalog.data?.pass_coin_price ?? 80

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center self-start underline">
        {copy.shop.backMenu}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.shop.title}</h1>
      <p className="text-muted">{copy.shop.subtitle}</p>

      <div className="flex flex-wrap gap-2 text-sm font-bold">
        <span className="bg-surface rounded-chip px-3 py-1.5">
          {copy.shop.yourPoints(spendable)}
        </span>
        <span className="bg-surface rounded-chip px-3 py-1.5">
          <span aria-hidden>🪙 </span>
          {copy.shop.yourCoins(coins)}
        </span>
      </div>
      <p className="text-muted text-sm">
        {tab === 'passes' ? copy.shop.coinsHintShort : copy.shop.pointsHint}
      </p>

      <div
        role="tablist"
        aria-label={copy.shop.title}
        className="bg-surface rounded-chip flex gap-1 p-1"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setMessage(null)
            }}
            className={`rounded-chip min-h-11 flex-1 px-2 text-sm font-bold leading-tight ${
              tab === id ? 'bg-brand text-white' : 'text-muted'
            }`}
          >
            {copy.shop.tabs[id]}
          </button>
        ))}
      </div>

      <p className="text-muted text-sm">
        {tab === 'upgrades'
          ? copy.shop.upgradesIntro
          : tab === 'vouchers'
            ? copy.shop.vouchersIntro
            : copy.shop.passesIntro}
      </p>

      {tab !== 'passes' && catalog.isPending && (
        <p className="text-muted" role="status">
          …
        </p>
      )}
      {tab !== 'passes' && catalog.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted">{copy.shop.loadError}</p>
          <Button className="w-auto px-4" onClick={() => void catalog.refetch()}>
            {copy.shop.retry}
          </Button>
        </div>
      )}
      {tab !== 'passes' && catalog.data && items.length === 0 && (
        <p className="text-muted">{copy.shop.empty}</p>
      )}
      {tab !== 'passes' && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const affordable = spendable >= item.price
            return (
              <li key={item.id}>
                <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="text-4xl" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block font-bold">{item.name}</span>
                    <span className="text-muted block text-sm">{item.description}</span>
                    {item.kind === 'upgrade' && (
                      <span className="text-muted block text-sm">
                        {copy.shop.level(item.level, item.max_level)}
                      </span>
                    )}
                  </span>
                  {item.maxed ? (
                    <span className="text-green-ink font-bold">{copy.shop.maxed}</span>
                  ) : (
                    <Button
                      className="w-full sm:w-auto sm:shrink-0 sm:px-4"
                      disabled={busy || !affordable}
                      onClick={() => void buy(item)}
                      aria-label={`${item.kind === 'upgrade' ? copy.shop.buyNext : copy.shop.buy} ${item.name}, ${copy.shop.buyFor(item.price)}`}
                    >
                      {affordable
                        ? copy.shop.buyFor(item.price)
                        : `${copy.shop.buyFor(item.price)} · ${copy.shop.missing(item.price - spendable)}`}
                    </Button>
                  )}
                  {messageFor(item.id)}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {tab === 'passes' && (
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="text-4xl" aria-hidden>
            🎟️
          </span>
          <span className="min-w-0 flex-1 basis-40">
            <span className="block font-bold">{copy.shop.passTitle}</span>
            <span className="text-muted block text-sm">
              {copy.economy.passesLabel(wallet.data?.passes ?? 0)}
            </span>
            <span className="text-muted block text-sm">{copy.shop.passPriceNote}</span>
          </span>
          <Button
            className="w-full sm:w-auto sm:shrink-0 sm:px-4"
            disabled={busy || coins < passPrice}
            onClick={() => void buyPass()}
          >
            {coins < passPrice
              ? `${copy.shop.passPrice(passPrice)} · ${copy.shop.missingCoins(passPrice - coins)}`
              : copy.shop.passPrice(passPrice)}
          </Button>
          {messageFor('pass')}
        </Card>
      )}

      {tab === 'vouchers' && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">{copy.shop.ordersTitle}</h2>
          {orders.data && orders.data.length === 0 && (
            <p className="text-muted">{copy.shop.noOrders}</p>
          )}
          <ul className="flex flex-col gap-2">
            {orders.data?.map((order) => (
              <li key={order.id}>
                <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 !py-3">
                  <span className="text-2xl" aria-hidden>
                    {order.icon}
                  </span>
                  <span className="min-w-0 flex-1 basis-24 font-bold">{order.name}</span>
                  <span className="font-display text-xl tracking-wider">{order.code}</span>
                  <span className="text-muted text-sm">{copy.shop.orderStatus[order.status]}</span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}
