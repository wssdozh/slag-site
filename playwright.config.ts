import { defineConfig, devices } from '@playwright/test';

// The smoke suite runs against the dev server, not the build: it checks behaviour (carousel,
// lightbox, reveals), and a production build adds a fetch-data step that needs GitHub and the
// relay. `npm run test:e2e` starts the server itself, on its own port, so it never fights an
// already running `npm run dev`.
const port = 4323;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx astro dev --port ${port} --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
