import { createContext, type ReactNode } from 'react'

export interface Popup {
  id: string
  /** Un popup "espontáneo" (no causado por una acción del cliente) se muestra máximo una vez por sesión. */
  spontaneous?: boolean
  render: (close: () => void) => ReactNode
}

export const PopupContext = createContext<{ show: (popup: Popup) => void }>({ show: () => {} })
