/** Variables de entorno del frontend, validadas una sola vez. */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`)
  return value
}

/** En desarrollo se pasa por el proxy de Vite (`/_sb`): funciona igual desde el celular y con HTTPS. */
function resolveSupabaseUrl(url: string): string {
  return import.meta.env.DEV ? `${window.location.origin}/_sb` : url
}

export const env = {
  supabaseUrl: resolveSupabaseUrl(required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  /** Herramientas de desarrollo (login por email, /dev). Nunca existen en un build de producción. */
  devTools: import.meta.env.DEV && import.meta.env.VITE_DEV_TOOLS === 'true',
  /**
   * Modo de prueba: en vez de Google, cualquiera entra como invitado (cuenta anónima, sin datos
   * personales) y recibe los puntos de entrada de `settings.demo`. Se apaga sacando la variable.
   */
  guestMode: import.meta.env.VITE_GUEST_MODE === 'true',
}
