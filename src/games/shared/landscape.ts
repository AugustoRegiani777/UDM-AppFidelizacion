import { useEffect, useState } from 'react'

/** En el celular intenta pasar a pantalla completa y bloquear la orientación horizontal (si el navegador lo permite). */
export async function enterLandscape() {
  try {
    await document.documentElement.requestFullscreen?.()
    await (
      screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    ).lock?.('landscape')
  } catch {
    // No todos los navegadores lo permiten: el aviso de "girá el celular" cubre ese caso.
  }
}

export function usePortrait() {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = () => setPortrait(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return portrait
}
