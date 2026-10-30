import { supabase } from '@/lib/supabase'

/** Entra con Google y vuelve a `returnPath` (ej. /s/<uuid>, para no perder la compra). */
export async function signInWithGoogle(returnPath = '/') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${returnPath}` },
  })
  if (error) throw error
}

/**
 * Guarda el progreso de un invitado: vincula su cuenta anónima a Google. Es el MISMO usuario (mismo id),
 * así que puntos, monedas, mejoras y premios quedan donde están. Si esa cuenta de Google ya existía,
 * Supabase vuelve con `identity_already_exists` (ver linkErrors.ts) y no se mezcla ni se borra nada.
 */
export async function linkGoogleToGuest(returnPath = '/perfil') {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${returnPath}` },
  })
  if (error) throw error
}

/** Modo de prueba: crea una cuenta de invitado (anónima) en este navegador. */
export async function signInAsGuest() {
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

/** Solo desarrollo: login por email/contraseña de Supabase local; crea el usuario si no existe. */
export async function signInWithEmailDev(email: string, password: string) {
  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error) return
  const signUp = await supabase.auth.signUp({ email, password })
  if (signUp.error) throw signUp.error
}

export const signOut = () => supabase.auth.signOut()
