import { Outlet } from 'react-router'
import { LinkConflictNotice } from '@/features/auth/LinkConflictNotice'
import { PopupQueueProvider } from '@/motion/PopupQueue'

/** Raíz del router: los popups viven acá porque necesitan navegar (useNavigate). */
export function RootLayout() {
  return (
    <PopupQueueProvider>
      <Outlet />
      <LinkConflictNotice />
    </PopupQueueProvider>
  )
}
