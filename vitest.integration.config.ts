import { defineConfig } from 'vitest/config'

// Tests contra Supabase local real (con Edge Functions servidas). Ver `npm run test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
