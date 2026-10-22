import type { HTMLAttributes } from 'react'

/** Contenedor estándar de pantalla: columna angosta, aire y respeto de las zonas seguras del celular. */
export function Screen({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${className}`}
      {...props}
    />
  )
}
