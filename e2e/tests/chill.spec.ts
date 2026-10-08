import { expect, type Page, test } from '@playwright/test';
import { closeContexts, inOffice, invite, openPage, register, shotPath, workspace, type Layout } from './helpers';
import { position, walkTo } from './nav';

test.describe.configure({ mode: 'serial' });

let org: Page;
let staff: Page;
let owner: Page;
const problems: string[][] = [];

test.afterAll(closeContexts);

test.beforeAll(async ({ browser }) => {
  const a = await openPage(browser, 'organiser');
  const b = await openPage(browser, 'staff');
  const c = await openPage(browser, 'owner');
  [org, staff, owner] = [a.page, b.page, c.page];
  problems.push(a.problems, b.problems, c.problems);
});

async function navigateToLegoWall(page: Page, layout: Layout, legoX = 26.5) {
  await walkTo(page, layout, 23.5, 10.5);

  // Walk west into the corridor
  for (let i = 0; i < 20; i++) {
    const pos = await position(page);
    if (pos.x <= 21.9) break;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(60);
  }

  // Walk north past foosball up to y <= 2.0
  for (let i = 0; i < 30; i++) {
    const pos = await position(page);
    if (pos.y <= 2.0) break;
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(60);
  }

  // Walk east along the north corridor
  for (let i = 0; i < 25; i++) {
    const pos = await position(page);
    if (pos.x >= legoX - 0.2) break;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(60);
  }

  // Fine tune y ~ 1.8
  for (let i = 0; i < 10; i++) {
    const pos = await position(page);
    if (pos.y <= 1.8) break;
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(60);
  }
}

test('Loft office has chill room, take chill-room screenshot, Lego live miniature updates for Bob', async () => {
  test.setTimeout(600_000);
  const stamp = Date.now();
  console.log('[CHILL] Registering Alice...');
  await register(org, 'Alice', `alice${stamp}@example.com`);
  await org.getByRole('button', { name: /Create an office/ }).click();
  await org.getByLabel('Office name').fill('ChillHQ');
  await org.getByRole('button', { name: 'Continue' }).click();
  // Template step: Loft
  await org.getByRole('button', { name: 'Continue' }).click();
  // Character step
  await org.getByRole('button', { name: 'Create the office' }).click();
  console.log('[CHILL] Waiting for Alice inOffice...');
  await inOffice(org);

  // (a) fresh Loft office has a room with kind 'chill' and furniture kinds foosball, cardTable, legoBoard
  const ws = await workspace(org);
  expect(ws.layout.rooms.some((r) => r.kind === 'chill')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'foosball')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'cardTable')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'legoBoard')).toBe(true);

  // Alice walks into chill room near the doorway
  console.log('[CHILL] Alice walking into chill room doorway...');
  await walkTo(org, ws.layout, 23.5, 10.5);

  // Screenshot chill-room.png
  await org.screenshot({ path: shotPath('chill-room.png') });

  // Invite Bob
  console.log('[CHILL] Inviting Bob...');
  const link = await invite(org, `bob${stamp}@example.com`);
  console.log('[CHILL] Registering Bob...');
  await register(staff, 'Bob', `bob${stamp}@example.com`);
  await staff.goto(link);
  await staff.getByRole('button', { name: /^Join / }).click();
  console.log('[CHILL] Waiting for Bob inOffice...');
  await inOffice(staff);

  // (c) Lego live miniature for the OTHER user:
  // Alice and Bob both in Loft office near the Lego wall (Bob where the wall is visible)
  console.log('[CHILL] Bob navigating to Lego wall...');
  await navigateToLegoWall(staff, ws.layout, 26.5);
  console.log('[CHILL] Alice navigating to Lego wall...');
  await navigateToLegoWall(org, ws.layout, 25.0);

  // Bob focuses canvas, takes canvas screenshot before Alice places a brick
  const bobCanvas = staff.locator('canvas').first();
  await bobCanvas.click({ position: { x: 300, y: 200 } }).catch(() => undefined);
  await staff.waitForTimeout(500);

  const beforeShot = await bobCanvas.screenshot();
  await bobCanvas.screenshot({ path: shotPath('lego-wall-bob-before.png') });

  // Alice opens 'Lego wall' dialog
  const legoDialog = org.getByRole('dialog', { name: 'Lego wall' });
  await expect(async () => {
    await org.keyboard.press('e');
    await expect(legoDialog).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });

  const legoCanvas = legoDialog.locator('canvas');
  await expect(legoCanvas).toBeVisible();

  const box = await legoCanvas.boundingBox();
  expect(box).not.toBeNull();
  const clickPos = { x: Math.round(box!.width / 2), y: Math.round(box!.height / 2) };

  // Alice clicks canvas to place a brick
  await legoCanvas.click({ position: clickPos });

  // Bob's page screenshot of the same region must differ (poll up to ~5 s)
  await expect.poll(async () => {
    const currentShot = await bobCanvas.screenshot();
    return !currentShot.equals(beforeShot);
  }, { timeout: 5_000 }).toBe(true);

  await bobCanvas.screenshot({ path: shotPath('lego-wall-bob-after.png') });

  // Alice erases the brick (optional)
  const eraseBtn = legoDialog.getByRole('button', { name: 'Erase' });
  await eraseBtn.click();
  await legoCanvas.click({ position: clickPos });

  // Close dialog
  const closeBtn = legoDialog.getByRole('button', { name: 'Close game' });
  await closeBtn.click();
  await expect(legoDialog).toBeHidden();
});

test('Create office with Studio template without chill room, add chill room via Team page', async () => {
  const stamp = Date.now();
  console.log('[CHILL] Registering Carol for Studio office...');
  await register(owner, 'Carol', `carol${stamp}@example.com`);
  await owner.getByRole('button', { name: /Create an office/ }).click();
  await owner.getByLabel('Office name').fill('StudioHQ');
  await owner.getByRole('button', { name: 'Continue' }).click();

  // (b) Create a second office using a template WITHOUT a chill room (Studio)
  await owner.getByRole('radio', { name: /Studio/i }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  // Character step
  await owner.getByRole('button', { name: 'Create the office' }).click();
  console.log('[CHILL] Waiting for Carol inOffice...');
  await inOffice(owner);

  // Initial check: Studio has NO room with kind 'chill' and canAddChill is true
  const initialWs = await workspace(owner);
  expect(initialWs.layout.rooms.some((r) => r.kind === 'chill')).toBe(false);
  expect(initialWs.canAddChill).toBe(true);

  // Go to Team page
  await owner.goto('/team');

  // Click 'Add chill room'
  const addBtn = owner.getByRole('button', { name: 'Add chill room' });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await addBtn.click();

  // The card disappears once the (only) chill room is there (one per office, Studio can't add desk wings).
  await expect(owner.getByRole('button', { name: 'Add chill room' })).toBeHidden({ timeout: 15_000 });

  // Verify workspace().layout now has a chill room with the three furniture kinds, and canAddChill false
  const updatedWs = await workspace(owner);
  expect(updatedWs.layout.rooms.some((r) => r.kind === 'chill')).toBe(true);
  expect(updatedWs.layout.furniture.some((f) => f.kind === 'foosball')).toBe(true);
  expect(updatedWs.layout.furniture.some((f) => f.kind === 'cardTable')).toBe(true);
  expect(updatedWs.layout.furniture.some((f) => f.kind === 'legoBoard')).toBe(true);
  expect(updatedWs.canAddChill).toBe(false);

  // And button is hidden
  await expect(owner.getByRole('button', { name: 'Add chill room' })).toBeHidden();
});

test('the browser console stayed clean', () => {
  expect(problems.flat()).toEqual([]);
});
