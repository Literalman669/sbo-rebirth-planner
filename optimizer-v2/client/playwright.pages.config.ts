import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-pages',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174/sbo-rebirth-planner',
  },
  webServer: {
    command: 'node e2e-pages/pages-artifact-server.mjs',
    url: 'http://127.0.0.1:4174/sbo-rebirth-planner/',
    reuseExistingServer: false,
  },
});
