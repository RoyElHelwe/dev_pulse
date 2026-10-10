import { defineConfig } from '@playwright/test';

// End-to-end tests: real browsers against the running app.
//   CI:     the API, the web app and serve.mjs (same-origin proxy) on :8080.
//   Docker: E2E_BASE_URL=https://localhost:8443 pnpm test (after `make`).
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: Number(process.env.E2E_WORKERS ?? 3),
  // Walking is done with real key presses on a software-rendered canvas, so a slow machine can
  // make a walk miss once. A retry reruns the whole serial story with fresh users.
  retries: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    ignoreHTTPSErrors: true,
    viewport: { width: 1200, height: 760 },
    trace: 'on-first-retry',
    screenshot: 'off',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // WebGL without a GPU (CI machines, containers); a fake microphone for voice.
      args: [
        // No WebGL by default: Phaser falls back to its canvas renderer, which is ~10x cheaper than
        // software WebGL (swiftshader) and keeps parallel workers fast. E2E_WEBGL=1 tests the WebGL path.
        ...(process.env.E2E_WEBGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-gpu', '--disable-3d-apis']),
        '--no-proxy-server',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
});
