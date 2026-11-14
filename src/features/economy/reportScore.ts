// Informa al servidor el progreso de los juegos del celular (ranking no oficial). El servidor solo guarda el
// mayor valor y rechaza lo imposible; si no hay sesión o falla la red, se ignora y el juego sigue andando.
// El cliente de Supabase se carga recién al informar: así los módulos de juego (y sus tests en Node)
// se pueden importar sin tocar el entorno ni la red.

export type CasualGame = 'racing' | 'skatepark' | 'sokoban' | 'ninja' | 'rally' | 'truco'

export async function reportScore(game: CasualGame, score: number): Promise<void> {
  const value = Math.floor(score)
  if (!Number.isFinite(value) || value <= 0) return
  try {
    const { supabase } = await import('@/lib/supabase')
    await supabase.rpc('submit_game_score', { p_game: game, p_score: value })
  } catch {
    // sin sesión o sin red: no pasa nada
  }
}
