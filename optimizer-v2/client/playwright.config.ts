import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SPACETIME_URI: 'http://127.0.0.1:3000',
      VITE_SPACETIME_DATABASE: 'sbo-rebirth-optimizer-v2-test',
      VITE_TEST_AUTH_TOKEN: process.env.SBO_TEST_USER_TOKEN ?? '',
    },
  },
});
