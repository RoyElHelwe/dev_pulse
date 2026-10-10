import { expect, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, gotoOffice, openPage, shotPath, workspace, type Workspace } from './helpers';
import { jumpTo } from './nav';

test.describe.configure({ mode: 'serial' });

let page: Page;
const problems: string[][] = [];

test.beforeAll(async ({ browser }) => {
  const p = await openPage(browser, 'owner');
  page = p.page;
  problems.push(p.problems);
});

test.afterAll(closeContexts);

test('dev-login as owner, walk to Lego wall, place and erase brick', async () => {
  await devOwner(page, 'Lego Owner', 'Lego HQ', 'loft');
  await gotoOffice(page);
  const w: Workspace = await workspace(page);

  // 2. Locate legoBoard in workspace layout
  const legoBoard = w.layout.furniture.find((f) => f.kind === 'legoBoard');
  expect(legoBoard).toBeDefined();
  if (!legoBoard) throw new Error('legoBoard not found in layout');

  // Navigate next to the chill room's Lego wall
  await jumpTo(page, legoBoard.x, 1.8);

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
