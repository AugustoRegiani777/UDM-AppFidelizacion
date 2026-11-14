// Informa al servidor el progreso de los juegos del celular (ranking no oficial). El servidor solo guarda el
// mayor valor y rechaza lo imposible; si no hay sesión o falla la red, se ignora y el juego sigue andando.

import { supabase } from '@/lib/supabase'

export type CasualGame = 'racing' | 'skatepark' | 'sokoban' | 'ninja' | 'rally' | 'truco'

export function reportScore(game: CasualGame, score: number): Promise<void> {
  const value = Math.floor(score)
  if (!Number.isFinite(value) || value <= 0) return Promise.resolve()
  return Promise.resolve(supabase.rpc('submit_game_score', { p_game: game, p_score: value })).then(
    () => undefined,
    () => undefined,
  )
}
