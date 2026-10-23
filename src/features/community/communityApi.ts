import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type PlaceCategory = 'pizzeria' | 'medialunas' | 'cafe' | 'helado' | 'otro'
export const CATEGORIES: PlaceCategory[] = ['pizzeria', 'medialunas', 'cafe', 'helado', 'otro']

export interface Place {
  id: string
  name: string
  category: PlaceCategory
  maps_url: string | null
  address: string | null
  note: string
  likes: number
  liked: boolean
  comments: number
  mine: boolean
}

export interface PlaceComment {
  id: string
  body: string
  created_at: string
  alias: string
  mine: boolean
  likes: number
  liked: boolean
}

export interface NewPlace {
  name: string
  category: PlaceCategory
  mapsUrl: string
  address: string
  note: string
}

export interface ToggleResult {
  liked: boolean
  likes: number
  points: number
}

/** El servidor explica con un código por qué rechazó algo; la pantalla lo traduce a un texto amable. */
export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : 'unknown'
}

export function usePlaces(category: PlaceCategory | null) {
  return useQuery({
    queryKey: ['places', category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('community_places', {
        p_category: category ?? undefined,
      })
      if (error) throw error
      return data as unknown as Place[]
    },
  })
}

export function usePlaceComments(placeId: string) {
  return useQuery({
    queryKey: ['place-comments', placeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('place_comments_list', { p_place: placeId })
      if (error) throw error
      return data as unknown as PlaceComment[]
    },
  })
}

/** Refresca lugares, comentarios y el saldo (por si la acción sumó puntos). */
function useRefreshCommunity() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['places'] }),
      queryClient.invalidateQueries({ queryKey: ['place-comments'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

export function useTogglePlaceLike() {
  const refresh = useRefreshCommunity()
  return useMutation({
    mutationFn: async (placeId: string) => {
      const { data, error } = await supabase.rpc('toggle_place_like', { p_place: placeId })
      if (error) throw error
      return data as unknown as ToggleResult
    },
    onSuccess: refresh,
  })
}

export function useToggleCommentLike() {
  const refresh = useRefreshCommunity()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await supabase.rpc('toggle_comment_like', { p_comment: commentId })
      if (error) throw error
      return data as unknown as ToggleResult
    },
    onSuccess: refresh,
  })
}

export function useAddComment(placeId: string) {
  const refresh = useRefreshCommunity()
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc('add_comment', { p_place: placeId, p_body: body })
      if (error) throw error
      return data as unknown as { id: string; points: number }
    },
    onSuccess: refresh,
  })
}

export function useReportComment() {
  const refresh = useRefreshCommunity()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.rpc('report_comment', { p_comment: commentId })
      if (error) throw error
    },
    onSuccess: refresh,
  })
}

export function useSubmitPlace() {
  return useMutation({
    mutationFn: async (place: NewPlace) => {
      const { error } = await supabase.rpc('submit_place', {
        p_name: place.name,
        p_category: place.category,
        p_maps_url: place.mapsUrl,
        p_address: place.address,
        p_note: place.note,
      })
      if (error) throw error
    },
  })
}
