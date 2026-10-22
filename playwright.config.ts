import { defineConfig, devices } from '@playwright/test'

// Flujos completos contra Supabase local + Edge Functions servidas. Ver `npm run test:e2e`.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Celular de gama media: es el dispositivo objetivo.
    ...devices['Pixel 5'],
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
