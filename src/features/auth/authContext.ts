import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export interface AuthState {
  session: Session | null
  /** true hasta que sepamos si hay sesión guardada. */
  loading: boolean
}

export const AuthContext = createContext<AuthState>({ session: null, loading: true })
