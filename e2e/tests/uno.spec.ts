import { expect, type Page, test } from '@playwright/test';
import { closeContexts, inOffice, invite, openPage, register, workspace } from './helpers';
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

test('2 players join office, walk to Uno table, start game and take turn', async () => {
  const stamp = Date.now();
  console.log('[E2E] Registering Alice...');
  await register(org, 'Alice', `alice${stamp}@example.com`);
  await org.getByRole('button', { name: /Create an office/ }).click();
  await org.getByLabel('Office name').fill('UnoHQ');
  await org.getByRole('button', { name: 'Continue' }).click();
  // Office template step: Loft is selected by default
  await org.getByRole('button', { name: 'Continue' }).click();
  // Character step
  await org.getByRole('button', { name: 'Create the office' }).click();
  console.log('[E2E] Waiting for Alice inOffice...');
  await inOffice(org);

  console.log('[E2E] Inviting Bob...');
  const link = await invite(org, `bob${stamp}@example.com`);
  console.log('[E2E] Registering Bob...');
  await register(staff, 'Bob', `bob${stamp}@example.com`);
  await staff.goto(link);
  await staff.getByRole('button', { name: /^Join / }).click();
  console.log('[E2E] Waiting for Bob inOffice...');
  await inOffice(staff);

  // User A walks to card table
  console.log('[E2E] Alice walking into chill room...');
  const w = await workspace(org);
  await walkTo(org, w.layout, 25.5, 7.5);
  for (let i = 0; i < 25; i++) {
    const pos = await position(org);
    if (pos.x >= 26.8) break;
    await org.keyboard.down('ArrowRight');
    await org.waitForTimeout(60);
    await org.keyboard.up('ArrowRight');
    await org.waitForTimeout(60);
  }
  console.log('[E2E] Alice arrived at:', await position(org));

  // User B walks to card table BEFORE any modals open
  console.log('[E2E] Bob walking into chill room...');
  await walkTo(staff, w.layout, 25.5, 7.5);
  for (let i = 0; i < 25; i++) {
    const pos = await position(staff);
    if (pos.x >= 26.8) break;
    await staff.keyboard.down('ArrowRight');
    await staff.waitForTimeout(60);
    await staff.keyboard.up('ArrowRight');
    await staff.waitForTimeout(60);
  }
  console.log('[E2E] Bob arrived at:', await position(staff));

  // User A opens Uno panel
  console.log('[E2E] Alice pressing E to open Uno...');
  await expect(async () => {
    await org.keyboard.press('e');
    await expect(org.getByRole('dialog', { name: 'Uno table' })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  console.log('[E2E] Alice opened Uno dialog!');

  // User A sees Uno lobby
  await expect(org.getByTestId('uno-start')).toBeVisible();
  await expect(org.getByTestId('uno-start')).toBeDisabled();

  // User B opens Uno panel
  console.log('[E2E] Bob pressing E to open Uno...');
  await expect(async () => {
    await staff.keyboard.press('e');
    await expect(staff.getByRole('dialog', { name: 'Uno table' })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  console.log('[E2E] Bob opened Uno dialog!');

  // User A is host: once Bob joins, start button becomes enabled
  await expect(org.getByTestId('uno-start')).toBeEnabled({ timeout: 10_000 });
  await org.getByTestId('uno-start').click();

  // Assert both see their own hand (7 cards)
  await expect(org.locator('[data-testid^="uno-card-"]')).toHaveCount(7, { timeout: 10_000 });
  await expect(staff.locator('[data-testid^="uno-card-"]')).toHaveCount(7, { timeout: 10_000 });

  // Assert turn indicator (uno-turn) shows on exactly one of them
  const orgTurn = org.getByTestId('uno-turn');
  const staffTurn = staff.getByTestId('uno-turn');

  const orgHasTurn = await orgTurn.isVisible();
  if (orgHasTurn) {
    await expect(orgTurn).toBeVisible();
    await expect(staffTurn).toBeHidden();
  } else {
    await expect(staffTurn).toBeVisible();
    await expect(orgTurn).toBeHidden();
  }

  const activePage = orgHasTurn ? org : staff;
  const waitingPage = orgHasTurn ? staff : org;

  // The player on turn clicks draw (uno-draw)
  await expect(activePage.getByTestId('uno-draw')).toBeEnabled();
  await activePage.getByTestId('uno-draw').click();

  // Assert active player hand count increased to 8
  await expect(activePage.locator('[data-testid^="uno-card-"]')).toHaveCount(8, { timeout: 10_000 });

  // Assert waiting player sees card counts update (8 cards for opponent)
  await expect(waitingPage.getByText('8 cards')).toBeVisible({ timeout: 10_000 });

  // Assert waiting player only sees their own 7 cards and never sees the active player's cards
  await expect(waitingPage.locator('[data-testid^="uno-card-"]')).toHaveCount(7);
});
