import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/useAuth'
import { supabase } from '@/lib/supabase'

/** ¿El usuario es administrador? Solo sirve para mostrar u ocultar pantallas: el servidor vuelve a chequearlo siempre. */
export function useIsAdmin() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['is-admin', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data
    },
  })
}

export interface PendingMission {
  id: string
  mission: string
  note: string | null
  display_name: string
  created_at: string
  /** Hay una reseña de Google que parece ser la de este cliente. */
  suggested: boolean
}

export function usePendingMissions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-pending-missions'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pending_missions')
      if (error) throw error
      return data as PendingMission[]
    },
  })
}

export async function reviewMission(claimId: string, approve: boolean) {
  const { error } = await supabase.rpc('admin_review_mission', {
    p_claim: claimId,
    p_approve: approve,
  })
  if (error) throw error
}

export interface PendingPlace {
  id: string
  name: string
  category: string
  maps_url: string | null
  address: string | null
  note: string
  display_name: string
}

export function usePendingPlaces(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-pending-places'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_pending_places')
      if (error) throw error
      return data as unknown as PendingPlace[]
    },
  })
}

export async function reviewPlace(placeId: string, approve: boolean) {
  const { error } = await supabase.rpc('admin_review_place', {
    p_place: placeId,
    p_approve: approve,
  })
  if (error) throw error
}

export interface ReportedComment {
  id: string
  body: string
  place: string
  reports: number
}

export function useReportedComments(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-reported-comments'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_reported_comments')
      if (error) throw error
      return data as unknown as ReportedComment[]
    },
  })
}

export async function reviewComment(commentId: string, keep: boolean) {
  const { error } = await supabase.rpc('admin_review_comment', {
    p_comment: commentId,
    p_keep: keep,
  })
  if (error) throw error
}

export async function createPlace(place: {
  name: string
  category: string
  mapsUrl: string
  address: string
  note: string
}) {
  const { error } = await supabase.rpc('admin_create_place', {
    p_name: place.name,
    p_category: place.category,
    p_maps_url: place.mapsUrl,
    p_address: place.address,
    p_note: place.note,
  })
  if (error) throw error
}

export interface GoogleSyncResult {
  configured: boolean
  new_reviews: number
  approved: number
  suggested: number
  error?: string
}

/** Pide a la función del servidor que busque reseñas nuevas en Google y verifique las pendientes. */
export async function syncGoogleReviews(): Promise<GoogleSyncResult> {
  const { data, error } = await supabase.functions.invoke<GoogleSyncResult>('sync-google-reviews', {
    body: {},
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}

export interface GoogleLocations {
  accounts: { account: string; accountName: string; locations: { name: string; title: string }[] }[]
}

/** Lista las cuentas y locales de Google a los que tiene acceso la conexión (para configurar `GOOGLE_BP_LOCATION`). */
export async function discoverGoogleLocations(): Promise<GoogleLocations> {
  const { data, error } = await supabase.functions.invoke<GoogleLocations>('sync-google-reviews', {
    body: { discover: true },
  })
  if (error || !data) throw error ?? new Error('empty_response')
  return data
}
