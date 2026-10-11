// Browser context lifecycle and page setup for Playwright E2E tests.
// Configures render caps, style overrides, and WebRTC interception for test stability.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';

/**
 * Returns an absolute path for saving test screenshots.
 * Directs output to process.env.SHOTS_DIR if provided, otherwise defaulting to e2e/test-results/shots.
 */
export function shotPath(name: string): string {
  // Screenshots for looking at (not asserted on): SHOTS_DIR, else test-results/shots next to the tests.
  const dir = process.env.SHOTS_DIR || fileURLToPath(new URL('../../test-results/shots', import.meta.url));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, name);
}

/**
 * Registry of active browser contexts opened during test execution.
 * Kept so closeContexts can cleanly dispose of all open pages between test suites.
 */
const openContexts: BrowserContext[] = [];

/**
 * Closes every browser context opened with openPage.
 * Should be called from afterAll hooks so the next test spec starts on an idle machine.
 */
export async function closeContexts() {
  await Promise.all(openContexts.splice(0).map((c) => c.close().catch(() => undefined)));
}

/**
 * Creates and configures a browser page that remembers its console errors and network issues.
 *
 * Attaches initialization scripts to optimize performance in software-rendered CI environments
 * and tracks runtime issues (console errors/warnings, uncaught page errors, HTTP >= 400 responses)
 * in the returned `problems` array so specs can assert clean logs.
 *
 * @param browser The Playwright browser instance
 * @param name Label identifier for error attribution
 * @param options Browser context creation options
 * @returns An object containing the Playwright `page` and its accumulated `problems` log
 */
export async function openPage(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ permissions: ['microphone'], ...options });
  openContexts.push(context);
  const page = await context.newPage();

  // (1) Render caps: window.__devpulseFps and window.__devpulseLowRes are test-only flags read
  // by web dev hooks (apps/web/game/createGame.ts and apps/web/features/dev/devHooks.ts).
  // Without GPU hardware, software-rendered Phaser canvases starve parallel test workers;
  // capping FPS (default 15) and lowering resolution ensures CPU headroom for all runners.
  await page.addInitScript((fps) => {
    (window as unknown as { __devpulseFps: number }).__devpulseFps = fps;
    (window as unknown as { __devpulseLowRes: boolean }).__devpulseLowRes = true;
  }, Number(process.env.E2E_FPS ?? 15));

  // (2) Backdrop-filter removal: blurred CSS overlays positioned over an active animated canvas
  // cost ~1 s per frame in software rendering without GPU acceleration. Removing blur keeps
  // styling functional without rendering stalls.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
      document.head.appendChild(style);
    });
  });

  // (3) RTCPeerConnection wrapper: wraps the native constructor and records instances in
  // window.__calls so test assertions via connectedCalls can verify live peer connections.
  await page.addInitScript(() => {
    const calls: RTCPeerConnection[] = [];
    (window as unknown as { __calls: RTCPeerConnection[] }).__calls = calls;
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super(config);
        calls.push(this);
      }
    } as typeof RTCPeerConnection;
  });

  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${name} ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${name} page error: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${name} HTTP ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  page.on('dialog', (d) => void d.accept());
  return { page, problems };
}

/**
 * Returns the number of WebRTC voice calls that are currently connected on the given page.
 * Reads the peer connection instances recorded by openPage's init script wrapper.
 */
export const connectedCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __calls: RTCPeerConnection[] }).__calls.filter((c) => c.connectionState === 'connected').length);
