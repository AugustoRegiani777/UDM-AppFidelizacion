import { supabase } from '@/lib/supabase'

export async function completeOnboarding(displayName: string, promoConsent: boolean) {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_display_name: displayName,
    p_promo_consent: promoConsent,
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

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error) throw error
  await supabase.auth.signOut({ scope: 'local' })
}
