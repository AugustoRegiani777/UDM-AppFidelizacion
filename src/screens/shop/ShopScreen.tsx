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

/** Tienda: mejoras y premios del local con puntos de compra; pases con monedas de juego. */
export function ShopScreen() {
  const queryClient = useQueryClient()
  const wallet = useWallet()
  const catalog = useCatalog()
  const orders = useOrders()
  const [tab, setTab] = useState<Tab>('upgrades')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; code?: string; error?: boolean } | null>(
    null,
  )

  const refresh = async () => {
    await Promise.all(
      ['wallet', 'shop'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )
  }

  const fail = (error: unknown) => {
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
    setMessage({ text, error: true })
  }

  const buy = async (item: ShopItem) => {
    setBusy(true)
    setMessage(null)
    try {
      const result: BuyResult = await buyItem(item.id)
      setMessage(
        result.kind === 'upgrade'
          ? { text: copy.shop.upgradeDone(result.name, result.level) }
          : { text: copy.shop.voucherDone, code: result.code },
      )
      await refresh()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const buyPass = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await buyPassWithCoins()
      setMessage({ text: copy.shop.passDone })
      await refresh()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const items = (catalog.data?.items ?? []).filter((item) =>
    tab === 'upgrades' ? item.kind === 'upgrade' : item.kind === 'voucher',
  )
  const spendable = wallet.data?.spendable ?? 0
  const coins = wallet.data?.coins ?? 0
  const passPrice = catalog.data?.pass_coin_price ?? 80

  return (
    <Screen className="gap-4">
      <Link to="/juegos" className="min-h-12 content-center self-start underline">
        {copy.shop.back}
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
            className={`rounded-chip min-h-11 flex-1 px-2 text-sm font-bold ${
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

      {message && (
        <div
          role="status"
          className={`rounded-card px-4 py-3 font-semibold ${
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
      )}

      {tab !== 'passes' && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const affordable = spendable >= item.price
            return (
              <li key={item.id}>
                <Card className="flex items-center gap-4">
                  <span className="text-4xl" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="flex-1">
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
                      className="w-auto shrink-0 px-4"
                      disabled={busy || !affordable}
                      onClick={() => void buy(item)}
                      aria-label={`${item.kind === 'upgrade' ? copy.shop.buyNext : copy.shop.buy} ${item.name}, ${copy.shop.price(item.price)}`}
                    >
                      {copy.shop.price(item.price)}
                    </Button>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {tab === 'passes' && (
        <Card className="flex items-center gap-4">
          <span className="text-4xl" aria-hidden>
            🎟️
          </span>
          <span className="flex-1">
            <span className="block font-bold">{copy.shop.passTitle}</span>
            <span className="text-muted block text-sm">
              {copy.economy.passesLabel(wallet.data?.passes ?? 0)}
            </span>
          </span>
          <Button
            className="w-auto shrink-0 px-4"
            disabled={busy || coins < passPrice}
            onClick={() => void buyPass()}
          >
            {copy.shop.passPrice(passPrice)}
          </Button>
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
                <Card className="flex items-center gap-3 !py-3">
                  <span className="text-2xl" aria-hidden>
                    {order.icon}
                  </span>
                  <span className="flex-1 font-bold">{order.name}</span>
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
