import { expect, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, devUser, gotoOffice, openPage, shotPath } from './helpers';
import { jumpTo } from './nav';

test.describe.configure({ mode: 'serial' });

let org: Page;
let staff: Page;
const problems: string[][] = [];

test.afterAll(closeContexts);

// When a test fails, show what the browsers logged: that is usually where the cause is.
test.afterEach(({}, info) => {
  if (info.status !== info.expectedStatus) console.log(`browser problems:\n  ${problems.flat().slice(-30).join('\n  ')}`);
});

test.beforeAll(async ({ browser }) => {
  const a = await openPage(browser, 'organiser');
  const b = await openPage(browser, 'staff');
  [org, staff] = [a.page, b.page];
  problems.push(a.problems, b.problems);
});

async function walkToFoosball(page: Page, label = '') {
  console.log(`[FOOSBALL] ${label} jumping into chill room...`);
  await jumpTo(page, 25.5, 5.9);
}

test('2 players join office, play foosball, kick, forfeit and check leaderboard', async () => {
  test.setTimeout(480_000);
  console.log('[FOOSBALL] Setting up Alice and FoosballHQ...');
  await devOwner(org, 'Alice', 'FoosballHQ', 'loft');
  await gotoOffice(org);

  console.log('[FOOSBALL] Setting up Bob...');
  await devUser(staff, 'Bob', org);
  await gotoOffice(staff);

  await walkToFoosball(org, 'Alice');
  await walkToFoosball(staff, 'Bob');

  // Alice opens the Baby foot table
  const orgDialog = org.getByRole('dialog', { name: 'Baby foot table' });
  await expect(async () => {
    await org.keyboard.press('e');
    await expect(orgDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Bob opens the Baby foot table
  const staffDialog = staff.getByRole('dialog', { name: 'Baby foot table' });
  await expect(async () => {
    await staff.keyboard.press('e');
    await expect(staffDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Alice sits on side A, Bob sits on side B
  await orgDialog.getByRole('button', { name: 'Sit Left' }).click();
  await staffDialog.getByRole('button', { name: 'Sit Right' }).click();

  // Save foosball-lobby.png (Alice full-page screenshot with dialog open)
  await org.screenshot({ path: shotPath('foosball-lobby.png') });

  // Alice starts the match
  const startBtn = orgDialog.getByTestId('foosball-start');
  await expect(startBtn).toBeEnabled({ timeout: 10_000 });
  await startBtn.click();

  // Wait for countdown to finish and phase to become 'playing'
  const panel = orgDialog.getByTestId('foosball-panel');
  await expect(panel).toHaveAttribute('data-phase', 'playing', { timeout: 15_000 });

  // Save foosball-playing.png
  await org.screenshot({ path: shotPath('foosball-playing.png') });

  // Full screen: the dialog covers the whole viewport, nothing needs scrolling, Leave is reachable.
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    // The browser's own fullscreen (requested by the game) blocks resizing: leave it, the in-page layout stays.
    await org.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
    await org.setViewportSize(vp);
    const box = await orgDialog.boundingBox();
    expect(box?.width).toBe(vp.width);
    expect(box?.height).toBe(vp.height);
    await expect(orgDialog.getByTestId('game-leave')).toBeInViewport();
    const tbl = await orgDialog.getByTestId('foosball-canvas').boundingBox();
    expect(tbl!.y + tbl!.height).toBeLessThanOrEqual(vp.height);
    expect(tbl!.width).toBeGreaterThan(vp.width * 0.5);
    await org.screenshot({ path: shotPath(`babyfoot-playing-${vp.width}x${vp.height}.png`) });
  }

  // Back to the normal size: a software-rendered full-HD canvas starves the page of CPU for the rest of the test.
  await org.setViewportSize({ width: 1200, height: 760 });
  // Mouse controls (pointer lock is not available here: the in-table position fallback is used).
  const canvas = orgDialog.getByTestId('foosball-canvas');
  const cb = (await canvas.boundingBox())!;
  const activeRodPos = orgDialog.getByTestId('active-rod-pos');
  const yAt = async () => Number(await activeRodPos.getAttribute('data-y'));
  await org.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.1, { steps: 12 });
  await expect.poll(yAt, { timeout: 5_000 }).toBeLessThan(-2);
  const up = await yAt();
  await org.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.9, { steps: 12 });
  await expect.poll(yAt, { timeout: 5_000 }).toBeGreaterThan(up + 4);

  // Click on another owned rod selects it, a click elsewhere kicks.
  await orgDialog.getByTestId('foosball-rod-3').click();
  await expect(orgDialog.getByTestId('foosball-rod-3')).toHaveClass(/bg-amber-400/);
  await org.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.3, { steps: 6 });
  await org.mouse.down();
  await org.mouse.up();
  // A quick flick up and down (kick by velocity).
  await org.waitForTimeout(500);
  await org.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.9);
  await org.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.1);

  // Bob leaves via the top bar "Leave" button
  await staffDialog.getByTestId('game-leave').click();
  await expect(staffDialog).toBeHidden({ timeout: 5_000 });

  // After >10s forfeit: Alice's dialog shows ended / winner (her page must be in front: background pages get no frames)
  await org.bringToFront();
  // (Generous: a busy machine paints this page slowly; the server forfeits after 10 s.)
  await expect(panel).toHaveAttribute('data-phase', 'ended', { timeout: 90_000 });
  await expect(orgDialog.getByText(/Won!/)).toBeVisible({ timeout: 5_000 });

  // Save foosball-ended.png (Alice full-page screenshot with dialog open)
  await org.screenshot({ path: shotPath('foosball-ended.png') });

  // Check leaderboard via page.request
  await expect.poll(async () => {
    const res = await org.request.get('/api/workspace/games/leaderboard?game=foosball&days=7');
    if (!res.ok()) return false;
    const data = await res.json();
    const alice = data.entries?.find((e: { name: string; wins: number; losses: number }) => e.name === 'Alice');
    const bob = data.entries?.find((e: { name: string; wins: number; losses: number }) => e.name === 'Bob');
    return (alice?.wins ?? 0) >= 1 && (bob?.losses ?? 0) >= 1;
  }, { timeout: 15_000 }).toBe(true);
});

test('Escape closes the dialog even when a button inside is focused', async () => {
  // Ensure dialog is closed first if still open
  const dialog = org.getByRole('dialog', { name: 'Baby foot table' });
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'Close game' }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  }

  // Refocus office canvas and freshly open the foosball dialog
  await org.locator('canvas').first().click({ position: { x: 600, y: 300 } }).catch(() => undefined);
  await expect(async () => {
    await org.keyboard.press('e');
    await expect(dialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Click a button inside the dialog so it has the focus (rod buttons only exist during a match,
  // and the match has ended by now).
  const focusBtn = dialog.getByRole('button', { name: 'Leaderboard' });
  await expect(focusBtn).toBeVisible({ timeout: 5_000 });
  await focusBtn.focus();
  await expect(focusBtn).toBeFocused();

  // Press Escape
  await org.keyboard.press('Escape');

  // Verify dialog must be hidden
  await expect(dialog).toBeHidden({ timeout: 5_000 });
});

test('the browser console stayed clean', () => {
  expect(problems.flat()).toEqual([]);
});
