import {
  createBrowserRouter,
  Navigate,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router'
import { isSaleUuid, savePendingSale } from '@/features/claims/pendingSale'
import { env } from '@/lib/env'
import { HistoryScreen } from '@/screens/history/HistoryScreen'
import { LandingScreen } from '@/screens/landing/LandingScreen'
import { LoginScreen } from '@/screens/login/LoginScreen'
import { PanelScreen } from '@/screens/panel/PanelScreen'
import { PrivacyScreen } from '@/screens/privacy/PrivacyScreen'
import { ProfileScreen } from '@/screens/profile/ProfileScreen'
import { RedeemScreen } from '@/screens/redeem/RedeemScreen'
import { SaleScreen } from '@/screens/sale/SaleScreen'
import { ScannerScreen } from '@/screens/scanner/ScannerScreen'
import { WelcomeScreen } from '@/screens/welcome/WelcomeScreen'
import { RequireAuth, RequireOnboarded } from './guards'

/** Se ejecuta antes de los guards: así el uuid queda guardado aunque haya que loguearse primero. */
function saleLoader({ params }: LoaderFunctionArgs) {
  if (!isSaleUuid(params.uuid)) return redirect('/')
  savePendingSale(params.uuid)
  return null
}

/** Herramientas de desarrollo: el chunk ni se genera en producción (import.meta.env.DEV es constante). */
const devRoutes: RouteObject[] =
  import.meta.env.DEV && env.devTools
    ? [
        {
          path: '/dev',
          lazy: async () => ({ Component: (await import('@/screens/dev/DevScreen')).DevScreen }),
        },
      ]
    : []

export const router = createBrowserRouter([
  { path: '/', element: <LandingScreen /> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/privacidad', element: <PrivacyScreen /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/bienvenida', element: <WelcomeScreen /> },
      {
        element: <RequireOnboarded />,
        children: [
          { path: '/panel', element: <PanelScreen /> },
          { path: '/canje/:id', element: <RedeemScreen /> },
          { path: '/historial', element: <HistoryScreen /> },
          { path: '/escanear', element: <ScannerScreen /> },
          { path: '/perfil', element: <ProfileScreen /> },
          { path: '/s/:uuid', loader: saleLoader, element: <SaleScreen /> },
        ],
      },
    ],
  },
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
])
