import { Outlet } from 'react-router'
import { PopupQueueProvider } from '@/motion/PopupQueue'

/** Raíz del router: los popups viven acá porque necesitan navegar (useNavigate). */
export function RootLayout() {
  return (
    <PopupQueueProvider>
      <Outlet />
    </PopupQueueProvider>
  )
}
