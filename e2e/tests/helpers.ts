import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContext, type BrowserContextOptions, expect, type Page } from '@playwright/test';

export function shotPath(name: string): string {
  // Screenshots for looking at (not asserted on): SHOTS_DIR, else test-results/shots next to the tests.
  const dir = process.env.SHOTS_DIR || fileURLToPath(new URL('../test-results/shots', import.meta.url));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, name);
}

export interface Layout {
  width: number;
  height: number;
  rooms: { id: string; name: string; kind: string; x: number; y: number; w: number; h: number }[];
  walls: { x1: number; y1: number; x2: number; y2: number; kind: 'solid' | 'glass'; face?: boolean }[];
  furniture: { id: string; kind: string; x: number; y: number; w: number; h: number; rotation?: number }[];
}

export interface Workspace {
  id?: string;
  templateId: string;
  layout: Layout;
  layoutVersion: number;
  character: string;
  deskId: string | null;
  desks: { deskId: string; userId: string; name: string }[];
  canExpand?: boolean;
  canAddChill?: boolean;
}

/** A browser page that remembers its console errors (the app must keep the console clean). */
const openContexts: BrowserContext[] = [];

/** Closes every page opened with openPage (call from afterAll, so the next spec starts on an idle machine). */
export async function closeContexts() {
  await Promise.all(openContexts.splice(0).map((c) => c.close().catch(() => undefined)));
}

export async function openPage(browser: Browser, name: string, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ permissions: ['microphone'], ...options });
  openContexts.push(context);
  const page = await context.newPage();
  // Software-rendered canvases starve every page on the machine: cap the office at 15 fps (E2E_FPS to change).
  await page.addInitScript((fps) => {
    (window as unknown as { __devpulseFps: number }).__devpulseFps = fps;
    (window as unknown as { __devpulseLowRes: boolean }).__devpulseLowRes = true;
  }, Number(process.env.E2E_FPS ?? 15));
  // Without a GPU, blurred overlays above an animated canvas cost ~1 s per frame: drop the blur (looks only).
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
      document.head.appendChild(style);
    });
  });
  // Keep the voice connections, so tests can check that a call really connected.
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

export async function register(page: Page, name: string, email: string) {
  // With DEV_LOGIN on, /register first shows the identity switcher; settle the /auth/dev check, then use the real form.
  const devCheck = page.waitForResponse((r) => r.url().includes('/auth/dev'), { timeout: 10_000 }).catch(() => undefined);
  await page.goto('/register');
  const enabled = await (await devCheck)?.json().then((s: { enabled?: boolean }) => !!s.enabled).catch(() => false);
  if (enabled) await page.getByRole('button', { name: 'Use the real sign-in' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('supersecret1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding**');
}

/**
 * Setup through the dev sign-in API instead of the forms (the specs that test the forms still use register()).
 * Creates a verified user, signs the page's browser context in and, when `host` is given, puts the user in the
 * host's office. Never use this in the specs that test sign-up, onboarding or invitations.
 */
export async function devUser(page: Page, name: string, host?: Page): Promise<string> {
  const joinUserId = host ? await userId(host) : undefined;
  const res = await page.context().request.post('/api/auth/dev/users', { data: { name, joinUserId } });
  expect(res.ok(), `dev sign-in failed: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { user: { id: string } }).user.id;
}

export async function userId(page: Page): Promise<string> {
  const res = await page.context().request.get('/api/auth/me');
  return ((await res.json()) as { id: string }).id;
}

/** Creates the office of a signed-in user through the API (same body as the onboarding form). */
export async function createOffice(page: Page, name: string, templateId = 'loft', character = 'maya') {
  const res = await page.context().request.post('/api/workspace', { data: { name, templateId, character } });
  expect(res.ok(), `create office failed: ${res.status()}`).toBeTruthy();
}

/** A signed-in office owner, without the forms: dev user + office. */
export async function devOwner(page: Page, name: string, officeName = 'Acme HQ', templateId = 'loft') {
  await devUser(page, name);
  await createOffice(page, officeName, templateId);
}

/** Opens /office and waits until it is live. */
export async function gotoOffice(page: Page) {
  await page.goto('/office');
  await inOffice(page);
}

/** Moves the local player (dev sign-in mode only; the server resets its speed check). Pixels. */
export async function teleport(page: Page, x: number, y: number) {
  await page.waitForFunction(() => !!(window as unknown as { __devpulse?: unknown }).__devpulse, undefined, { timeout: 30_000 });
  await page.evaluate(([x, y]) => (window as unknown as { __devpulse: { teleport(x: number, y: number): void } }).__devpulse.teleport(x, y), [x, y] as const);
}

export const workspace = (page: Page) => page.evaluate(() => fetch('/api/workspace').then((r) => r.json())) as Promise<Workspace>;

/** Waits until the office is loaded (the canvas and the live connection are up). */
export async function inOffice(page: Page) {
  await page.waitForURL('**/office');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled({ timeout: 120_000 });
}

/** The "people in the office" list as text (opens and closes it). */
export async function peopleList(page: Page) {
  await page.getByRole('button', { name: /in the office/ }).click();
  const list = page.locator('ul').last();
  await expect(list).toBeVisible();
  const text = (await list.innerText()).replace(/\s*\n\s*/g, ' | ');
  await page.getByRole('button', { name: /in the office/ }).click();
  await page.locator('canvas').click({ position: { x: 10, y: 10 } }).catch(() => undefined);
  return text;
}

/** Same-origin version of a link the API built with APP_URL. */
export const local = (page: Page, link: string) => new URL(new URL(link).pathname, page.url()).toString();

export async function invite(page: Page, email: string): Promise<string> {
  const result = await page.evaluate(
    (email) =>
      fetch('/api/workspace/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'MEMBER' }),
      }).then((r) => r.json()),
    email,
  );
  return local(page, result.link);
}

/** Voice calls of this page that are connected right now. */
export const connectedCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __calls: RTCPeerConnection[] }).__calls.filter((c) => c.connectionState === 'connected').length);
