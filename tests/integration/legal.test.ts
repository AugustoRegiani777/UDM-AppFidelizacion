import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'
import { createCustomer, giveSalePoints } from './helpers'

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

describe('consentimiento legal y derechos del usuario', { timeout: 60_000 }, () => {
  it('la versión legal vigente es pública y un visitante no puede llamar a las funciones', async () => {
    const anon = createClient<Database>(URL, ANON_KEY, { auth: { persistSession: false } })
    const { data } = await anon.from('settings').select('value').eq('key', 'legal').single()
    expect((data?.value as { version: string }).version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect((await anon.rpc('export_my_data')).error).not.toBeNull()
    expect(
      (await anon.rpc('accept_legal', { p_adult: true, p_privacy: true, p_terms: true })).error,
    ).not.toBeNull()
  })

  it('sin las tres confirmaciones no se registra; con ellas queda la versión vigente', async () => {
    const ana = await createCustomer('legal')
    const denied = await ana.client.rpc('complete_onboarding', {
      p_display_name: 'Ana',
      p_promo_consent: false,
      p_adult: true,
      p_privacy: false,
      p_terms: true,
    })
    expect(denied.error?.message).toMatch(/consent_required/)

    const ok = await ana.client.rpc('complete_onboarding', {
      p_display_name: 'Ana',
      p_promo_consent: false,
      p_adult: true,
      p_privacy: true,
      p_terms: true,
    })
    expect(ok.error).toBeNull()
    const { data } = await ana.client.from('profiles').select('*').single()
    expect(data?.legal_version).toBeTruthy()
    expect(data?.adult_confirmed_at).not.toBeNull()
    // El cliente no puede falsificar la prueba escribiendo las columnas.
    const forged = await ana.client
      .from('profiles')
      .update({ legal_version: '1999-01-01' })
      .eq('id', ana.id)
    expect(forged.error).not.toBeNull()
  })

  it('export_my_data devuelve lo propio y nada de otros clientes', async () => {
    const ana = await createCustomer('exp-a', 'Ana Exportable')
    const beto = await createCustomer('exp-b', 'Beto Ajeno')
    await giveSalePoints(ana, 300)
    await giveSalePoints(beto, 500)

    const { data, error } = await ana.client.rpc('export_my_data')
    expect(error).toBeNull()
    const dump = data as Record<string, unknown>
    expect((dump.profile as { id: string }).id).toBe(ana.id)
    expect((dump.point_movements as unknown[]).length).toBeGreaterThan(0)
    const text = JSON.stringify(dump)
    expect(text).not.toContain(beto.id)
    expect(text).not.toContain('Beto Ajeno')
  })
})
