import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    // HTTPS local con certificado propio: la cámara del celular exige HTTPS (`npm run dev:https`).
    ...(process.env.DEV_HTTPS ? [basicSsl()] : []),
    tailwindcss(),
    VitePWA({
      // La app se registra a mano (src/pwa/register.ts): descarga la versión nueva sola y la aplica
      // cuando no hay un juego en pantalla. Ver docs/DEPLOY.md.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Uno de Miga',
        short_name: 'Uno de Miga',
        description: 'Sumá puntos con cada compra y ganate tu miga.',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#FAF3E3',
        theme_color: '#C8102E',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // /s/:uuid y las demás rutas de la SPA caen en index.html; /dev no se cachea offline.
      workbox: {
        navigateFallbackDenylist: [/^\/functions\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // La simulación del juego es la misma que usa el servidor para validar cada partida.
      '@engine': fileURLToPath(new URL('./supabase/functions/_shared/survivors', import.meta.url)),
      '@skate': fileURLToPath(new URL('./supabase/functions/_shared/skate', import.meta.url)),
    },
  },
  server: {
    host: true,
    // La app habla con Supabase local por el mismo origen: sirve desde el celular (sin abrir
    // otros puertos) y evita contenido mixto cuando se prueba con HTTPS.
    proxy: {
      '/_sb': {
        target: 'http://127.0.0.1:55321',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/_sb/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
  },
})
