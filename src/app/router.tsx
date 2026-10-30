import {
  createBrowserRouter,
  Navigate,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { isSaleUuid, savePendingSale } from '@/features/claims/pendingSale'
import { env } from '@/lib/env'
import { LandingScreen } from '@/screens/landing/LandingScreen'
import { MissionsScreen } from '@/screens/missions/MissionsScreen'
import { LoginScreen } from '@/screens/login/LoginScreen'
import { PanelScreen } from '@/screens/panel/PanelScreen'
import { SaleScreen } from '@/screens/sale/SaleScreen'
import { WelcomeScreen } from '@/screens/welcome/WelcomeScreen'
import { RequireAuth, RequireOnboarded } from './guards'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

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
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullScreenLoader />,
    children: [
      { path: '/', element: <LandingScreen /> },
      { path: '/login', element: <LoginScreen /> },
      {
        path: '/privacidad',
        lazy: async () => ({
          Component: (await import('@/screens/privacy/PrivacyScreen')).PrivacyScreen,
        }),
      },
      {
        path: '/aviso-legal',
        lazy: async () => ({
          Component: (await import('@/screens/legal/LegalScreens')).AvisoLegalScreen,
        }),
      },
      {
        path: '/cookies',
        lazy: async () => ({
          Component: (await import('@/screens/legal/LegalScreens')).CookiesScreen,
        }),
      },
      {
        path: '/bases',
        lazy: async () => ({
          Component: (await import('@/screens/legal/LegalScreens')).BasesScreen,
        }),
      },
      {
        path: '/normas',
        lazy: async () => ({
          Component: (await import('@/screens/legal/LegalScreens')).NormasScreen,
        }),
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/bienvenida', element: <WelcomeScreen /> },
          {
            element: <RequireOnboarded />,
            children: [
              { path: '/panel', element: <PanelScreen /> },
              { path: '/misiones', element: <MissionsScreen /> },
              {
                path: '/comunidad',
                lazy: async () => ({
                  Component: (await import('@/screens/community/CommunityScreen')).CommunityScreen,
                }),
              },
              {
                path: '/comunidad/:id',
                lazy: async () => ({
                  Component: (await import('@/screens/community/PlaceScreen')).PlaceScreen,
                }),
              },
              {
                path: '/admin',
                lazy: async () => ({
                  Component: (await import('@/screens/admin/AdminScreen')).AdminScreen,
                }),
              },
              {
                path: '/juegos',
                lazy: async () => ({
                  Component: (await import('@/screens/arcade/ArcadeScreen')).ArcadeScreen,
                }),
              },
              {
                path: '/tienda',
                lazy: async () => ({
                  Component: (await import('@/screens/shop/ShopScreen')).ShopScreen,
                }),
              },
              {
                path: '/ranking',
                lazy: async () => ({
                  Component: (await import('@/screens/ranking/RankingScreen')).RankingScreen,
                }),
              },
              {
                path: '/ruleta',
                lazy: async () => ({
                  Component: (await import('@/screens/games/RouletteScreen')).RouletteScreen,
                }),
              },
              {
                path: '/raspadita/:claimId',
                lazy: async () => ({
                  Component: (await import('@/screens/games/ScratchScreen')).ScratchScreen,
                }),
              },
              {
                path: '/cofre/:rewardId',
                lazy: async () => ({
                  Component: (await import('@/screens/chest/ChestScreen')).ChestScreen,
                }),
              },
              {
                path: '/canje/:id',
                lazy: async () => ({
                  Component: (await import('@/screens/redeem/RedeemScreen')).RedeemScreen,
                }),
              },
              {
                path: '/historial',
                lazy: async () => ({
                  Component: (await import('@/screens/history/HistoryScreen')).HistoryScreen,
                }),
              },
              {
                path: '/escanear',
                lazy: async () => ({
                  Component: (await import('@/screens/scanner/ScannerScreen')).ScannerScreen,
                }),
              },
              {
                path: '/perfil',
                lazy: async () => ({
                  Component: (await import('@/screens/profile/ProfileScreen')).ProfileScreen,
                }),
              },
              { path: '/s/:uuid', loader: saleLoader, element: <SaleScreen /> },
            ],
          },
        ],
      },
      ...devRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
