import { defineConfig } from '@playwright/test';

// One worker: tests share the app's in-memory state and reset it between tests.
export default defineConfig({
  testDir: 'tests',
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5081', trace: 'retain-on-failure' },
  webServer: { command: 'node server.js', url: 'http://localhost:5081/__admin/state', env: { PORT: '5081', BUSINESS_DATE: '2026-10-27' }, reuseExistingServer: false },
});
