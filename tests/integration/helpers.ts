// Ayudas para los tests de integración: Supabase local + Edge Functions servidas (npm run test:integration).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { signedHeaders } from '../../supabase/functions/_shared/hmac'
import type { Database } from '../../src/lib/database.types'

// Claves de DEMO de Supabase local (públicas, iguales en toda instalación local).
const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
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
export async function createCustomer(label = 'cliente'): Promise<Customer> {
  const email = `${label}-${randomUUID()}@test.local`
  const password = 'secret-123456'
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
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
export async function giveSalePoints(customer: Customer, euros: number): Promise<void> {
  const sale = await createMockSale({ total_cents: euros * 100 })
  await claimSale(customer, sale)
}

export async function rewardId(name: string): Promise<string> {
  const { data, error } = await admin.from('rewards').select('id').eq('name', name).single()
  if (error) throw error
  return data.id
}

export const createRedemption = (customer: Customer, reward: string) =>
  callFunction('create-redemption', { reward_id: reward }, { token: customer.token })
