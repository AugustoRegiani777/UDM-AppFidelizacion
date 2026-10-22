import { createBrowserRouter, Navigate, redirect, type LoaderFunctionArgs } from 'react-router'
import { isSaleUuid, savePendingSale } from '@/features/claims/pendingSale'
import { LandingScreen } from '@/screens/landing/LandingScreen'
import { LoginScreen } from '@/screens/login/LoginScreen'
import { PanelScreen } from '@/screens/panel/PanelScreen'
import { PrivacyScreen } from '@/screens/privacy/PrivacyScreen'
import { ProfileScreen } from '@/screens/profile/ProfileScreen'
import { SaleScreen } from '@/screens/sale/SaleScreen'
import { WelcomeScreen } from '@/screens/welcome/WelcomeScreen'
import { RequireAuth, RequireOnboarded } from './guards'

/** Se ejecuta antes de los guards: así el uuid queda guardado aunque haya que loguearse primero. */
function saleLoader({ params }: LoaderFunctionArgs) {
  if (!isSaleUuid(params.uuid)) return redirect('/')
  savePendingSale(params.uuid)
  return null
}

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
          { path: '/perfil', element: <ProfileScreen /> },
          { path: '/s/:uuid', loader: saleLoader, element: <SaleScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
