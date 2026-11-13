import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DayCount {
  day: string
  count: number
}

export interface AdminOverview {
  users: { total: number; new_by_day: DayCount[]; active_7d: number; active_30d: number }
  points: {
    issued: number
    redeemed: number
    circulating: number
    top_customers: { display_name: string; balance: number }[]
  }
  sales: { claimed_by_day: DayCount[]; qr_scans_by_day: DayCount[] }
  games: {
    game: string
    plays_by_day: DayCount[]
    plays_total: number
    rewards_given: number
    limit_hits: number
  }[]
  rewards: { name: string; redemptions: number }[]
}

export const OVERVIEW_RANGES = [7, 30, 90] as const
export type OverviewRange = (typeof OVERVIEW_RANGES)[number]

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
const series = (value: unknown): DayCount[] =>
  list<{ day?: unknown; count?: unknown }>(value).map((d) => ({
    day: String(d.day ?? ''),
    count: num(d.count),
  }))

/** Tolera campos ausentes: el servidor puede omitir secciones vacías. */
export function normalizeOverview(raw: unknown): AdminOverview {
  const r = (raw ?? {}) as Record<string, Record<string, unknown> | undefined>
  const users = r.users ?? {}
  const points = r.points ?? {}
  const sales = r.sales ?? {}
  return {
    users: {
      total: num(users.total),
      new_by_day: series(users.new_by_day),
      active_7d: num(users.active_7d),
      active_30d: num(users.active_30d),
    },
    points: {
      issued: num(points.issued),
      redeemed: num(points.redeemed),
      circulating: num(points.circulating),
      top_customers: list<{ display_name?: unknown; balance?: unknown }>(points.top_customers).map(
        (c) => ({ display_name: String(c.display_name ?? ''), balance: num(c.balance) }),
      ),
    },
    sales: {
      claimed_by_day: series(sales.claimed_by_day),
      qr_scans_by_day: series(sales.qr_scans_by_day),
    },
    games: list<Record<string, unknown>>(r.games).map((g) => ({
      game: String(g.game ?? ''),
      plays_by_day: series(g.plays_by_day),
      plays_total: num(g.plays_total),
      rewards_given: num(g.rewards_given),
      limit_hits: num(g.limit_hits),
    })),
    rewards: list<{ name?: unknown; redemptions?: unknown }>(r.rewards).map((x) => ({
      name: String(x.name ?? ''),
      redemptions: num(x.redemptions),
    })),
  }
}

export const sumSeries = (data: DayCount[]) => data.reduce((acc, d) => acc + d.count, 0)

/** ¿No hay ninguna actividad en el período? */
export function isOverviewEmpty(o: AdminOverview): boolean {
  return (
    o.users.total === 0 &&
    o.points.issued === 0 &&
    o.points.redeemed === 0 &&
    sumSeries(o.sales.claimed_by_day) === 0 &&
    sumSeries(o.sales.qr_scans_by_day) === 0 &&
    o.games.every((g) => g.plays_total === 0) &&
    o.rewards.every((r) => r.redemptions === 0)
  )
}

/** Alturas relativas (0 a 1) para dibujar barras; el máximo ocupa todo el alto. */
export function barHeights(data: DayCount[]): number[] {
  const max = Math.max(0, ...data.map((d) => d.count))
  return data.map((d) => (max === 0 ? 0 : d.count / max))
}

export async function fetchAdminOverview(days: number): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview', { p_days: days })
  if (error) throw error
  return normalizeOverview(data)
}

export function useAdminOverview(days: OverviewRange, enabled = true) {
  return useQuery({
    queryKey: ['admin-overview', days],
    enabled,
    queryFn: () => fetchAdminOverview(days),
  })
}
