// Office workspace and game canvas interaction helpers for Playwright E2E tests.
// Manages workspace layout inspection, office navigation state, and dev teleportation.

import { expect, type Page } from '@playwright/test';

/**
 * 2D layout structure representing rooms, walls, and furniture within the office.
 */
export interface Layout {
  width: number;
  height: number;
  rooms: { id: string; name: string; kind: string; x: number; y: number; w: number; h: number }[];
  walls: { x1: number; y1: number; x2: number; y2: number; kind: 'solid' | 'glass'; face?: boolean }[];
  furniture: { id: string; kind: string; x: number; y: number; w: number; h: number; rotation?: number }[];
}

/**
 * Office workspace metadata, active layout, desk allocations, and feature flags.
 */
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

/**
 * Fetches the current workspace configuration, layout, and desks from GET /api/workspace.
 */
export const workspace = (page: Page) => page.evaluate(() => fetch('/api/workspace').then((r) => r.json())) as Promise<Workspace>;

/**
 * Opens /office and waits until the office canvas and live game connection are established.
 */
export async function gotoOffice(page: Page) {
  await page.goto('/office');
  await inOffice(page);
}

/**
 * Waits until the office route is active and the canvas and HUD controls have mounted.
 */
export async function inOffice(page: Page) {
  await page.waitForURL('**/office');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled({ timeout: 120_000 });
}

/**
 * Moves the local player avatar instantly to pixel coordinates (x, y).
 *
 * Requires `window.__devpulse` which is installed by the web app's dev hooks only when dev sign-in
 * is enabled (apps/web/features/dev/devHooks.ts and apps/web/features/office/useOfficeConnection.ts).
 * Under the hood, this emits the server's `dev:teleport` socket event so the server resets its speed check.
 */
export async function teleport(page: Page, x: number, y: number) {
  await page.waitForFunction(() => !!(window as unknown as { __devpulse?: unknown }).__devpulse, undefined, { timeout: 30_000 });
  await page.evaluate(([x, y]) => (window as unknown as { __devpulse: { teleport(x: number, y: number): void } }).__devpulse.teleport(x, y), [x, y] as const);
}

/**
 * Reads the names in the "people in the office" roster list as text, opening and closing the panel.
 */
export async function peopleList(page: Page) {
  await page.getByRole('button', { name: /in the office/ }).click();
  const list = page.locator('ul').last();
  await expect(list).toBeVisible();
  const text = (await list.innerText()).replace(/\s*\n\s*/g, ' | ');
  await page.getByRole('button', { name: /in the office/ }).click();
  await page.locator('canvas').click({ position: { x: 10, y: 10 } }).catch(() => undefined);
  return text;
}
