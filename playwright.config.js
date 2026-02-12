import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },

  webServer: {
    // Serve the project root so that both /src/index.html and /config.json
    // are reachable (api.js fetches '../config.json' relative to the page URL)
    command: 'node_modules/.bin/serve . -l 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
