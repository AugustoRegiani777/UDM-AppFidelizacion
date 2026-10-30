import { useQuery } from '@tanstack/react-query'
import { LEGAL_VERSION } from '@/legal/company'
import { supabase } from '@/lib/supabase'

export interface ConsentState {
  program_consent_at: string | null
  adult_confirmed_at: string | null
  privacy_accepted_at: string | null
  terms_accepted_at: string | null
  legal_version: string | null
}

/**
 * ¿Hay que (volver a) aceptar los textos legales?
 * Sí si falta alguna confirmación o si la versión aceptada es más vieja que la vigente (AAAA-MM-DD se compara como texto).
 * Quien aceptó solo las reglas antes de existir las casillas nuevas no tiene las fechas y vuelve a pasar por acá.
 */
export function needsLegalAcceptance(state: ConsentState, requiredVersion: string): boolean {
  if (
    !state.program_consent_at ||
    !state.adult_confirmed_at ||
    !state.privacy_accepted_at ||
    !state.terms_accepted_at ||
    !state.legal_version
  ) {
    return true
  }
  return state.legal_version < requiredVersion
}

/** Versión vigente según el servidor (settings.legal). Si no se puede leer, se usa la del paquete de la app. */
export function useRequiredLegalVersion() {
  return useQuery({
    queryKey: ['legal-version'],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'legal')
        .maybeSingle()
      if (error) throw error
      const version = (data?.value as { version?: unknown } | null)?.version
      return typeof version === 'string' && version ? version : LEGAL_VERSION
    },
  })
}
