import { RallyGame } from '@/games/rally/RallyGame'

/** Rally de Cocina en la sala de juegos: práctica a pantalla completa, sin puntos ni premios. */
export function RallyArcade({ onBack }: { onBack: () => void }) {
  return <RallyGame onExit={onBack} />
}
