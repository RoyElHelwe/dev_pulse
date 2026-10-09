import { expect, type Page, test } from '@playwright/test';
import { closeContexts, inOffice, openPage, shotPath, workspace, type Workspace, type Layout } from './helpers';
import { position, walkTo } from './nav';

test.describe.configure({ mode: 'serial' });

let page: Page;
const problems: string[][] = [];

test.beforeAll(async ({ browser }) => {
  const p = await openPage(browser, 'owner');
  page = p.page;
  problems.push(p.problems);
});

test.afterAll(closeContexts);

async function navigateToLegoWall(page: Page, layout: Layout, legoX = 26.5) {
  // Step 1: Walk to chill room doorway using walkTo
  console.log('[LEGO-NAV] Starting at:', await position(page));
  await walkTo(page, layout, 23.5, 10.5);
  console.log('[LEGO-NAV] After walkTo doorway:', await position(page));

  // Step 2: Walk west into the clear corridor between west wall (x: 21.0) and foosball (x: 22.7)
  for (let i = 0; i < 20; i++) {
    const pos = await position(page);
    if (pos.x <= 21.9) break;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(60);
  }
  console.log('[LEGO-NAV] After walking west:', await position(page));

  // Step 3: Walk north past foosball (ends at y: 3.7) up to y <= 2.0
  for (let i = 0; i < 30; i++) {
    const pos = await position(page);
    if (pos.y <= 2.0) break;
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(60);
  }
  console.log('[LEGO-NAV] After walking north:', await position(page));

  // Step 4: Walk east along the open north corridor to align with Lego wall (x ~ legoX)
  for (let i = 0; i < 25; i++) {
    const pos = await position(page);
    if (pos.x >= legoX - 0.2) break;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(60);
  }
  console.log('[LEGO-NAV] After walking east:', await position(page));

  // Step 5: Fine-tune standing position (y ~ 1.8..2.0)
  for (let i = 0; i < 10; i++) {
    const pos = await position(page);
    if (pos.y <= 1.8) break;
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(60);
  }
  console.log('[LEGO-NAV] Final standing position:', await position(page));
}

test('dev-login as owner, walk to Lego wall, place and erase brick', async () => {
  // 1. Dev-login as an owner who has a legoBoard in their office layout
  const devRes = await page.request.get('/api/auth/dev');
  expect(devRes.ok()).toBe(true);
  const devData = await devRes.json();
  const users: Array<{ id: string; displayName: string; email: string; officeName: string | null; role: string | null }> = devData.users || [];
  const owners = users.filter((u) => u.role === 'OWNER' && u.officeName).reverse();

  let selectedOwnerId: string | null = null;
  for (const o of owners) {
    const loginRes = await page.request.post('/api/auth/dev/login', { data: { userId: o.id } });
    if (!loginRes.ok()) continue;
    const wsRes = await page.request.get('/api/workspace');
    if (!wsRes.ok()) continue;
    const ws = await wsRes.json();
    if (ws.templateId === 'loft' && (!ws.wings || ws.wings.length === 0) && ws.layout?.furniture?.some((f: { kind: string }) => f.kind === 'legoBoard')) {
      selectedOwnerId = o.id;
      break;
    }
  }

  let w: Workspace;

  if (selectedOwnerId) {
    await page.goto('/office');
    await inOffice(page);
    w = await workspace(page);
  } else {
    // If no existing owner with a legoBoard exists, create a new dev user and loft office
    await page.request.post('/api/auth/dev/users', { data: { name: 'Lego Owner' } });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /Create an office/ }).click();
    await page.getByLabel('Office name').fill(`Lego HQ ${Date.now()}`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create the office' }).click();
    await inOffice(page);
    w = await workspace(page);
  }

  // 2. Locate legoBoard in workspace layout
  const legoBoard = w.layout.furniture.find((f) => f.kind === 'legoBoard');
  expect(legoBoard).toBeDefined();
  if (!legoBoard) throw new Error('legoBoard not found in layout');

  // Navigate next to the chill room's Lego wall
  await navigateToLegoWall(page, w.layout, legoBoard.x);

  // Focus canvas to ensure Phaser captures key inputs
  await page.locator('canvas').first().click({ position: { x: 600, y: 300 } }).catch(() => undefined);

  // 3. Press E to open the Lego dialog
  const dialog = page.getByRole('dialog', { name: 'Lego wall' });
  await expect(async () => {
    await page.keyboard.press('e');
    await expect(dialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  const legoCanvas = dialog.locator('canvas');
  await expect(legoCanvas).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shotPath('lego-panel.png') });

  // Full screen at both reference sizes: whole viewport, Leave reachable, board fits.
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    // The browser's own fullscreen (requested by the game) blocks resizing: leave it, the in-page layout stays.
    await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    const dbox = await dialog.boundingBox();
    expect(dbox?.width).toBe(vp.width);
    expect(dbox?.height).toBe(vp.height);
    await expect(dialog.getByTestId('game-leave')).toBeInViewport();
    await expect(legoCanvas).toBeInViewport({ ratio: 0.98 });
    await page.screenshot({ path: shotPath(`lego-panel-${vp.width}x${vp.height}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);

  // Pick a free cell to place a brick (stud 24, 16 is near the center)
  const box = await legoCanvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('legoCanvas boundingBox is null');

  // Center stud click position
  const clickPos = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };

  // 4. Click a cell on the canvas to place a brick
  await legoCanvas.click({ position: clickPos });

  // 5. Assert via the page's authenticated request context that GET /api/workspace/lego
  // (poll up to 3s) returns a board containing at least one brick
  await expect.poll(async () => {
    const res = await page.request.get('/api/workspace/lego');
    if (!res.ok()) return 0;
    const data = await res.json();
    const board = data.boards?.find((b: { id: string }) => b.id === legoBoard.id) ?? data.boards?.[0];
    return board?.bricks?.length ?? 0;
  }, { timeout: 3000 }).toBeGreaterThan(0);

  // 6. Close the dialog with Close game button
  const closeBtn = dialog.getByRole('button', { name: 'Close game' });
  await closeBtn.click();
  await expect(dialog).toBeHidden({ timeout: 5000 });

  // Refocus canvas and reopen it with E
  await page.locator('canvas').first().click({ position: { x: 600, y: 300 } }).catch(() => undefined);
  await expect(async () => {
    await page.keyboard.press('e');
    await expect(dialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Select Erase tool
  const eraseBtn = dialog.getByRole('button', { name: 'Erase' });
  await eraseBtn.click();

  // Click the same cell on the canvas to erase the brick
  await legoCanvas.click({ position: clickPos });

  // Assert board is clean (0 bricks)
  await expect.poll(async () => {
    const res = await page.request.get('/api/workspace/lego');
    if (!res.ok()) return -1;
    const data = await res.json();
    const board = data.boards?.find((b: { id: string }) => b.id === legoBoard.id) ?? data.boards?.[0];
    return board?.bricks?.length ?? 0;
  }, { timeout: 3000 }).toBe(0);

  // Leave clean: close dialog
  const closeFinalBtn = dialog.getByRole('button', { name: 'Close game' });
  await closeFinalBtn.click();
  await expect(dialog).toBeHidden();
});

test('the browser console stayed clean', () => {
  expect(problems.flat()).toEqual([]);
});
