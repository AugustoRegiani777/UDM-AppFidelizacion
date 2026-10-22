/** Variables de entorno del frontend, validadas una sola vez. */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`)
  return value
}

/**
 * En desarrollo, si abrís la app desde el celular por IP (ej. 192.168.1.20:5173),
 * "127.0.0.1" apuntaría al celular. Reemplazamos el host por el de la página.
 */
function resolveSupabaseUrl(url: string): string {
  if (!import.meta.env.DEV) return url
  const target = new URL(url)
  if (['127.0.0.1', 'localhost'].includes(target.hostname))
    target.hostname = window.location.hostname
  return target.origin
}

export const env = {
  supabaseUrl: resolveSupabaseUrl(required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  /** Herramientas de desarrollo (login por email, /dev). Nunca existen en un build de producción. */
  devTools: import.meta.env.DEV && import.meta.env.VITE_DEV_TOOLS === 'true',
}
