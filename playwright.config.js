import { defineConfig } from '@playwright/test';

// One worker: tests share the app's state and reset it between tests.
// "server" runs the Node app; "pages" runs the static GitHub Pages build.
export default defineConfig({
  testDir: 'tests',
  workers: 1,
  fullyParallel: false,
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'server', testMatch: 'order-entry.spec.js', use: { baseURL: 'http://localhost:5081' } },
    { name: 'pages', testMatch: 'pages.spec.js', use: { baseURL: 'http://localhost:5091/contoso-order-entry/' } },
  ],
  webServer: [
    { command: 'node server.js', url: 'http://localhost:5081/__admin/state', env: { PORT: '5081', BUSINESS_DATE: '2026-10-27' }, reuseExistingServer: false },
    {
      command: 'node scripts/build-web.mjs && node scripts/preview-web.mjs',
      url: 'http://localhost:5091/contoso-order-entry/',
      env: { PORT: '5091', BASE_PATH: '/contoso-order-entry/' },
      reuseExistingServer: false,
    },
  ],
});
