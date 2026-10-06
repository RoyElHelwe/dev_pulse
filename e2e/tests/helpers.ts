import { type Browser, type BrowserContext, type BrowserContextOptions, expect, type Page } from '@playwright/test';

export interface Layout {
  width: number;
  height: number;
  rooms: { id: string; name: string; kind: string; x: number; y: number; w: number; h: number }[];
  walls: { x1: number; y1: number; x2: number; y2: number; kind: 'solid' | 'glass'; face?: boolean }[];
  furniture: { id: string; kind: string; x: number; y: number; w: number; h: number; rotation?: number }[];
}

export interface Workspace {
  templateId: string;
  layout: Layout;
  layoutVersion: number;
  character: string;
  deskId: string | null;
  desks: { deskId: string; userId: string; name: string }[];
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
