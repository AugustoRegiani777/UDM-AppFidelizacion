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
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      // /s/:uuid y las demás rutas de la SPA caen en index.html; /dev no se cachea offline.
      workbox: { navigateFallbackDenylist: [/^\/functions\//] },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true,
    // La app habla con Supabase local por el mismo origen: sirve desde el celular (sin abrir
    // otros puertos) y evita contenido mixto cuando se prueba con HTTPS.
    proxy: {
      '/supabase': {
        target: 'http://127.0.0.1:54321',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
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
