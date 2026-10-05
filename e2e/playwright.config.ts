import { defineConfig } from '@playwright/test';

// End-to-end tests: real browsers against the running app.
//   CI:     the API, the web app and serve.mjs (same-origin proxy) on :8080.
//   Docker: E2E_BASE_URL=https://localhost:8443 pnpm test (after `make`).
export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    ignoreHTTPSErrors: true,
    viewport: { width: 1200, height: 760 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // WebGL without a GPU (CI machines, containers); a fake microphone for voice.
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--no-proxy-server',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
});
