/**
 * Dirección pública de la app (sin barra final). Sale de UNA sola variable: VITE_APP_URL.
 * El día de la mudanza de dominio solo se cambia esa variable (ver docs/DOMINIO.md).
 * Sin la variable, se usa la dirección actual en Netlify.
 */
export const DEFAULT_APP_URL = 'https://udm-appfidelizacion.netlify.app'

export function normalizeAppUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  return value === '' ? DEFAULT_APP_URL : value
}

export const appUrl = normalizeAppUrl(import.meta.env.VITE_APP_URL)
