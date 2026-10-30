import { supabase } from '@/lib/supabase'

/** Las tres confirmaciones obligatorias; el servidor las exige y guarda la fecha y la versión vigente. */
export interface LegalConsents {
  adult: boolean
  privacy: boolean
  terms: boolean
}

export async function completeOnboarding(
  displayName: string,
  promoConsent: boolean,
  consents: LegalConsents,
) {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_display_name: displayName,
    p_promo_consent: promoConsent,
    p_adult: consents.adult,
    p_privacy: consents.privacy,
    p_terms: consents.terms,
  })
  if (error) throw error
}

/** Vuelve a aceptar los textos cuando cambió la versión legal (no toca el nombre ni las promos). */
export async function acceptLegal(consents: LegalConsents) {
  const { error } = await supabase.rpc('accept_legal', {
    p_adult: consents.adult,
    p_privacy: consents.privacy,
    p_terms: consents.terms,
  })
  if (error) throw error
}

export async function updateProfile(displayName: string, promoConsent: boolean) {
  const { error } = await supabase.rpc('update_profile', {
    p_display_name: displayName,
    p_promo_consent: promoConsent,
  })
  if (error) throw error
}

/** Derecho de acceso y portabilidad: baja un JSON con todo lo que la app guarda del usuario. */
export async function downloadMyData() {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) throw error
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mis-datos-uno-de-miga-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: { confirm: true },
  })
  if (error) throw error
  await supabase.auth.signOut({ scope: 'local' })
}
