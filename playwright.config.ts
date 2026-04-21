import { defineConfig } from '@playwright/test'

// Bypass HTTP proxy for localhost to prevent Clash/V2Ray intercepting e2e requests
process.env.NO_PROXY = (process.env.NO_PROXY ?? '') + ',127.0.0.1,localhost'
process.env.no_proxy = process.env.NO_PROXY

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
