// Ayudas para los tests de integración: Supabase local + Edge Functions servidas (npm run test:integration).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { signedHeaders } from '../../supabase/functions/_shared/hmac'
import type { Database } from '../../src/lib/database.types'

// Claves de DEMO de Supabase local (públicas, iguales en toda instalación local).
const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const admin: SupabaseClient<Database> = createClient<Database>(URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

export interface Customer {
  id: string
  token: string
  client: SupabaseClient<Database>
}

/** Crea un cliente real (con perfil y sesión) para probar como si fuera la app. */
export async function createCustomer(label = 'cliente', fullName?: string): Promise<Customer> {
  const email = `${label}-${randomUUID()}@test.local`
  const password = 'secret-123456'
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  })
  if (created.error) throw created.error

  const client = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false } })
  const session = await client.auth.signInWithPassword({ email, password })
  if (session.error) throw session.error
  return { id: created.data.user.id, token: session.data.session.access_token, client }
}

export interface MockSaleOptions {
  total_cents?: number
  minutes_ago?: number
  voided?: boolean
  channel?: 'local' | 'glovo' | 'togoo'
  /** La venta recién "aparece" en el POS después de estos segundos. */
  appears_in_seconds?: number
}

/** Inserta una venta en el POS falso (dev_mock_sales). */
export async function createMockSale(options: MockSaleOptions = {}): Promise<string> {
  const now = Date.now()
  const { data, error } = await admin
    .from('dev_mock_sales')
    .insert({
      total_cents: options.total_cents ?? 6200,
      voided: options.voided ?? false,
      channel: options.channel ?? 'local',
      sold_at: new Date(now - (options.minutes_ago ?? 0) * 60_000).toISOString(),
      visible_from: new Date(now + (options.appears_in_seconds ?? 0) * 1000).toISOString(),
    })
    .select('uuid')
    .single()
  if (error) throw error
  return data.uuid
}

export interface FunctionResponse<T = Record<string, unknown>> {
  status: number
  body: T
}

/** Llama a una Edge Function como lo haría la app (JWT del cliente) o sin sesión. */
export async function callFunction<T = Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  name: string,
  payload: unknown,
  options: { token?: string | null; headers?: Record<string, string>; rawBody?: string } = {},
): Promise<FunctionResponse<T>> {
  const response = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...(options.token === null ? {} : { Authorization: `Bearer ${options.token ?? ANON_KEY}` }),
      ...options.headers,
    },
    body: options.rawBody ?? JSON.stringify(payload),
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T }
}

export const claimSale = (customer: Customer, saleUuid: string) =>
  callFunction('claim-sale', { sale_uuid: saleUuid }, { token: customer.token })

export async function balanceOf(customer: Customer): Promise<number> {
  const { data, error } = await customer.client.rpc('customer_dashboard')
  if (error) throw error
  return (data as { balance: number }).balance
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// --- Caja (POS) ---------------------------------------------------------------------------
const POS_INBOUND_SECRET = process.env.POS_INBOUND_HMAC_SECRET ?? 'dev-secret-pos-a-fidelizacion'

/** Llama a validate-redemption como lo haría el servidor del POS: firmado con HMAC. */
export async function validateAsPos(
  code: string,
  options: { secret?: string; timestampOffsetSeconds?: number; tamperBody?: boolean } = {},
) {
  const body = JSON.stringify({ code })
  const now = Math.floor(Date.now() / 1000) + (options.timestampOffsetSeconds ?? 0)
  const headers = await signedHeaders(options.secret ?? POS_INBOUND_SECRET, body, now)
  return callFunction('validate-redemption', null, {
    token: null,
    headers,
    rawBody: options.tamperBody ? JSON.stringify({ code: 'MIGA-AAAA' }) : body,
  })
}

/** Le da puntos a un cliente de la forma real: reclamando una venta del POS falso. */
/** Le da `points` puntos con una venta (la escala es de 10 puntos por euro, ver docs/06). */
export async function giveSalePoints(customer: Customer, points: number): Promise<void> {
  const sale = await createMockSale({ total_cents: points * 10 })
  await claimSale(customer, sale)
}

export async function rewardId(name: string): Promise<string> {
  const { data, error } = await admin.from('rewards').select('id').eq('name', name).single()
  if (error) throw error
  return data.id
}

/** Deja una sola opción de juego en el cofre, con sus reglas (para que las pruebas sean predecibles). */
export async function configureChest(
  game: 'survivors' | 'skate',
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'chest_game')
    .single()
  if (error) throw error
  await admin
    .from('settings')
    .update({
      value: {
        ...(data.value as object),
        games: [game],
        overrides: { [game]: overrides },
      } as never,
    })
    .eq('key', 'chest_game')
}

/** Reglas de "Sobreviví a las migas" para las pruebas (ver supabase/functions/_shared/survivors/config.ts). */
export const setChestOverrides = (overrides: Record<string, unknown>) =>
  configureChest('survivors', overrides)

/** Vuelve a la configuración normal: el cofre solo sortea Sobreviví a las migas (el skate está retirado), reglas por defecto. */
export async function resetChestConfig(): Promise<void> {
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'chest_game')
    .single()
  if (error) throw error
  await admin
    .from('settings')
    .update({
      value: { ...(data.value as object), games: ['survivors'], overrides: {} } as never,
    })
    .eq('key', 'chest_game')
}

/** Partida sin enemigos de 2 segundos: se gana sola, ideal para probar el flujo del cofre. */
export const QUICK_GAME = { spawnMul: 0, boss: false, durationSeconds: 2 }

/** Circuito de skate recortado a 600 unidades: se completa rodando en pocos segundos. */
export const QUICK_SKATE = { courseLimit: 600 }

export const startChest = (customer: Customer, reward: string) =>
  callFunction('start-chest', { reward_id: reward }, { token: customer.token })

export const finishChest = (
  customer: Customer,
  sessionId: string,
  log: unknown = { moves: [], picks: [] },
) => callFunction('finish-chest', { session_id: sessionId, log }, { token: customer.token })

/** Abre el cofre de punta a punta (con QUICK_GAME activo) y devuelve el código de canje. */
export async function openChest(customer: Customer, reward: string) {
  const started = await startChest(customer, reward)
  if (started.status !== 200 || !started.body.session_id) return started
  await sleep(2000)
  const finished = await finishChest(customer, started.body.session_id)
  return { status: finished.status, body: finished.body.redemption ?? finished.body }
}

/** Reglas de la partida oficial de Sobreviví para las pruebas (settings.ranked_game). */
export async function configureRanked(overrides: Record<string, unknown>): Promise<void> {
  await admin
    .from('settings')
    .update({ value: { overrides: { survivors: overrides } } as never })
    .eq('key', 'ranked_game')
}
