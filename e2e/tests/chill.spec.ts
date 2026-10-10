import { expect, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, devUser, gotoOffice, inOffice, openPage, shotPath, workspace, type Layout } from './helpers';
import { jumpTo } from './nav';

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
  await jumpTo(page, legoX, 1.8);
}

test('Loft office has chill room, take chill-room screenshot, Lego live miniature updates for Bob', async () => {
  test.setTimeout(600_000);
  const stamp = Date.now();
  console.log('[CHILL] Setting up Alice with devOwner...');
  await devOwner(org, `Alice${stamp}`, 'ChillHQ', 'loft');
  await gotoOffice(org);

  // (a) fresh Loft office has a room with kind 'chill' and furniture kinds foosball, cardTable, legoBoard
  const ws = await workspace(org);
  expect(ws.layout.rooms.some((r) => r.kind === 'chill')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'foosball')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'cardTable')).toBe(true);
  expect(ws.layout.furniture.some((f) => f.kind === 'legoBoard')).toBe(true);

  // Alice walks into chill room near the doorway
  console.log('[CHILL] Alice jumping into chill room doorway...');
  await jumpTo(org, 23.5, 10.5);

  // Screenshot chill-room.png
  await org.screenshot({ path: shotPath('chill-room.png') });

  // Bob joins office
  console.log('[CHILL] Setting up Bob with devUser...');
  await devUser(staff, `Bob${stamp}`, org);
  await gotoOffice(staff);

  // (c) Lego live miniature for the OTHER user:
  // Alice and Bob both in Loft office near the Lego wall (Bob where the wall is visible)
  // Alice first: she stands in the doorway after the screenshot, which would block Bob's way in.
  console.log('[CHILL] Alice navigating to Lego wall...');
  const legoBoard = ws.layout.furniture.find((f) => f.kind === 'legoBoard')!;
  await navigateToLegoWall(org, ws.layout, legoBoard.x - 0.5);
  console.log('[CHILL] Bob navigating to Lego wall...');
  await navigateToLegoWall(staff, ws.layout, legoBoard.x + 0.3);

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

  // Alice places three big bricks (the wall in the office is a thin strip, so make them count)
  await legoDialog.getByRole('button', { name: '2×4' }).click();
  for (const fx of [0.25, 0.5, 0.75]) {
    await legoCanvas.click({ position: { x: Math.round(box!.width * fx), y: clickPos.y } });
    await org.waitForTimeout(400);
  }
  await expect.poll(async () => {
    const res = await org.request.get('/api/workspace/lego');
    const data = await res.json();
    return (data.boards ?? []).reduce((n: number, b: { bricks: unknown[] }) => n + b.bricks.length, 0);
  }, { timeout: 5_000 }).toBeGreaterThanOrEqual(3);

  // Bob's page screenshot of the same region must differ (poll up to ~10 s)
  await expect.poll(async () => {
    const currentShot = await bobCanvas.screenshot();
    return !currentShot.equals(beforeShot);
  }, { timeout: 10_000 }).toBe(true);

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
  console.log('[CHILL] Setting up Carol for Studio office with devUser...');
  await devUser(owner, `Carol${stamp}`);
  await owner.goto('/onboarding');
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
  // ...but the user still gets a confirmation after the card is gone.
  await expect(owner.getByTestId('chill-added')).toBeVisible();

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
