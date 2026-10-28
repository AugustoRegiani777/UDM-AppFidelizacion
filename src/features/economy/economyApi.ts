// Partidas oficiales (ranking, monedas y pases), billetera y rankings. El servidor decide todo: acá solo se
// pide la partida, se manda el registro de entradas y se muestra lo que respondió.

import { FunctionsHttpError } from '@supabase/supabase-js'
import type { GameConfig } from '@engine/config.ts'
import type { SkateConfig } from '@skate/config.ts'
import { supabase } from '@/lib/supabase'

export type RankedGame = 'survivors' | 'skate'

export type StartRunResult = { run_id: string; stage: number; seed: number } & (
  { game: 'survivors'; config: GameConfig } | { game: 'skate'; config: SkateConfig }
)

export interface FinishRunResult {
  won: boolean
  score: number
  coins: number
  pass_granted: boolean
  new_best: boolean
  game: RankedGame
  stage: number
}

export interface Wallet {
  /** Puntos de compra ganados (solo suben: definen los escalones de comida). */
  balance: number
  /** Puntos de compra que se pueden gastar en la tienda. */
  spendable: number
  coins: number
  coins_today: number
  coins_daily_cap: number
  passes: number
  pass_cap: number
  show_in_rankings: boolean
}

export interface BoardRow {
  rank: number
  name: string
  score: number
  me: boolean
}

export interface Board {
  rows: BoardRow[]
  me: { rank: number; score: number } | null
}

/** Errores del servidor que se explican con amabilidad en pantalla. */
export class RunError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

async function call<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
  })
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => ({}))
    throw new RunError(typeof payload.error === 'string' ? payload.error : 'unknown')
  }
  if (error || !data) throw error ?? new RunError('empty_response')
  return data
}

export const startRun = (game: RankedGame, stage: number) =>
  call<StartRunResult>('start-run', { game, stage })

export const finishRun = (runId: string, log: unknown) =>
  call<FinishRunResult>('finish-run', { run_id: runId, log })

export async function fetchWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('my_wallet')
  if (error) throw error
  return data as unknown as Wallet
}

export async function fetchBoard(game: RankedGame, stage: number): Promise<Board> {
  const { data, error } = await supabase.rpc('leaderboard', {
    p_game: game,
    p_stage: stage,
    p_limit: 20,
  })
  if (error) throw error
  return data as unknown as Board
}

export async function fetchPointsBoard(): Promise<Board> {
  const { data, error } = await supabase.rpc('leaderboard_points', { p_limit: 20 })
  if (error) throw error
  return data as unknown as Board
}

export async function setShowInRankings(show: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_show_in_rankings', { p_show: show })
  if (error) throw error
}
