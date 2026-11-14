import { defineConfig, devices } from '@playwright/test'

// Config propia (puerto 5291) para los e2e de tienda y ranking sin pisar a otros agentes.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5291', trace: 'retain-on-failure', ...devices['Pixel 5'] },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --port 5291 --strictPort',
    url: 'http://localhost:5291',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

