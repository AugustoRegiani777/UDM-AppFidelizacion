import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Providers } from '@/app/Providers'
import { router } from '@/app/router'
import { UpdateBanner } from '@/pwa/UpdateBanner'
import { registerServiceWorker } from '@/pwa/register'
import '@/styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
      <UpdateBanner />
    </Providers>
  </StrictMode>,
)

registerServiceWorker()
