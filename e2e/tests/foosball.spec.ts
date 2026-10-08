import { expect, type Page, test } from '@playwright/test';
import { closeContexts, inOffice, invite, openPage, register, shotPath } from './helpers';
import { position, walkTo } from './nav';

test.describe.configure({ mode: 'serial' });

let org: Page;
let staff: Page;
const problems: string[][] = [];

test.afterAll(closeContexts);

test.beforeAll(async ({ browser }) => {
  const a = await openPage(browser, 'organiser');
  const b = await openPage(browser, 'staff');
  [org, staff] = [a.page, b.page];
  problems.push(a.problems, b.problems);
});

async function walkToFoosball(page: Page, layout: any, label = '') {
  console.log(`[FOOSBALL] ${label} walking into chill room...`);
  await walkTo(page, layout, 25.5, 7.5);
  console.log(`[FOOSBALL] ${label} in chill room:`, await position(page));
  for (let i = 0; i < 20; i++) {
    const pos = await position(page);
    if (pos.y <= 6.0) break;
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(60);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(60);
  }
  console.log(`[FOOSBALL] ${label} arrived at foosball:`, await position(page));
}

test('2 players join office, play foosball, kick, forfeit and check leaderboard', async () => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  console.log('[FOOSBALL] Registering Alice...');
  await register(org, 'Alice', `alice${stamp}@example.com`);
  await org.getByRole('button', { name: /Create an office/ }).click();
  await org.getByLabel('Office name').fill('FoosballHQ');
  await org.getByRole('button', { name: 'Continue' }).click();
  // Template step: Loft
  await org.getByRole('button', { name: 'Continue' }).click();
  // Character step
  await org.getByRole('button', { name: 'Create the office' }).click();
  console.log('[FOOSBALL] Waiting for Alice inOffice...');
  await inOffice(org);

  console.log('[FOOSBALL] Inviting Bob...');
  const link = await invite(org, `bob${stamp}@example.com`);
  console.log('[FOOSBALL] Registering Bob...');
  await register(staff, 'Bob', `bob${stamp}@example.com`);
  await staff.goto(link);
  await staff.getByRole('button', { name: /^Join / }).click();
  console.log('[FOOSBALL] Waiting for Bob inOffice...');
  await inOffice(staff);

  const wsRes = await org.request.get('/api/workspace');
  const ws = await wsRes.json();

  await walkToFoosball(org, ws.layout, 'Alice');
  await walkToFoosball(staff, ws.layout, 'Bob');

  // Alice opens Foosball table
  const orgDialog = org.getByRole('dialog', { name: 'Foosball table' });
  await expect(async () => {
    await org.keyboard.press('e');
    await expect(orgDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  // Bob opens Foosball table
  const staffDialog = staff.getByRole('dialog', { name: 'Foosball table' });
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

  // Press W / S on Alice's page and verify rod position changes
  const activeRodPos = orgDialog.getByTestId('active-rod-pos');
  const initialY = Number(await activeRodPos.getAttribute('data-y'));
  await org.keyboard.down('KeyS');
  await expect.poll(async () => {
    return Number(await activeRodPos.getAttribute('data-y'));
  }, { timeout: 5_000 }).not.toBe(initialY);
  await org.keyboard.up('KeyS');

  // Press Space to kick
  await org.keyboard.press('Space');

  // Bob closes his dialog via "Close game" button
  await staffDialog.getByRole('button', { name: 'Close game' }).click();
  await expect(staffDialog).toBeHidden({ timeout: 5_000 });

  // After >10s forfeit: Alice's dialog shows ended / winner
  await expect(panel).toHaveAttribute('data-phase', 'ended', { timeout: 25_000 });
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
  const dialog = org.getByRole('dialog', { name: 'Foosball table' });
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

  // Take a seat so rod buttons are visible
  const sitLeft = dialog.getByRole('button', { name: 'Sit Left' });
  if (await sitLeft.isVisible()) {
    await sitLeft.click();
  }

  // Click a rod button inside the panel so it receives focus
  const rodBtn = dialog.getByRole('button', { name: /1: Goalkeeper/i });
  await expect(rodBtn).toBeVisible({ timeout: 5_000 });
  await rodBtn.click();

  // Press Escape
  await org.keyboard.press('Escape');

  // Verify dialog must be hidden
  await expect(dialog).toBeHidden({ timeout: 5_000 });
});

test('the browser console stayed clean', () => {
  expect(problems.flat()).toEqual([]);
});
