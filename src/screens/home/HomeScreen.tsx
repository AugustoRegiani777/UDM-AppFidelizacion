import { useState } from 'react'
import { CountUp } from '@/motion/CountUp'
import { Pressable } from '@/motion/Pressable'

/** Pantalla de prueba de la Fase 1: comprueba fuentes, tokens y animaciones. */
export function HomeScreen() {
  const [balance, setBalance] = useState(179)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-muted font-semibold">Tus puntos</p>
      <CountUp value={balance} className="font-display text-brand text-[96px] leading-none" />
      <Pressable
        onClick={() => setBalance((b) => b + 62)}
        className="bg-ink text-bg min-h-12 rounded-chip px-6 font-bold"
      >
        Sumar 62 puntos
      </Pressable>
    </main>
  )
}
