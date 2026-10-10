import { expect, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, devUser, gotoOffice, openPage, shotPath } from './helpers';
import { jumpTo } from './nav';

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
  console.log('[E2E] Setting up Alice and UnoHQ...');
  await devOwner(org, 'Alice', 'UnoHQ', 'loft');
  await gotoOffice(org);

  console.log('[E2E] Setting up Bob...');
  await devUser(staff, 'Bob', org);
  await gotoOffice(staff);

  // User A walks to card table
  console.log('[E2E] Alice walking into chill room...');
  await jumpTo(org, 27.5, 7.5); // beside the card table, in reach of E

  // User B walks to card table BEFORE any modals open
  console.log('[E2E] Bob walking into chill room...');
  await jumpTo(staff, 27.5, 7.5);

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
  await org.screenshot({ path: shotPath('uno-lobby.png') });
  await org.getByTestId('uno-start').click();

  // Assert both see their own hand (7 cards)
  await expect(org.locator('[data-testid^="uno-card-"]')).toHaveCount(7, { timeout: 10_000 });
  await expect(staff.locator('[data-testid^="uno-card-"]')).toHaveCount(7, { timeout: 10_000 });
  await org.screenshot({ path: shotPath('uno-playing.png') });

  // Full screen at both reference sizes: whole viewport, Leave reachable, no page scrolling.
  const unoDialog = org.getByRole('dialog', { name: 'Uno table' });
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    // The browser's own fullscreen (requested by the game) blocks resizing: leave it, the in-page layout stays.
    await org.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
    await org.setViewportSize(vp);
    const box = await unoDialog.boundingBox();
    expect(box?.width).toBe(vp.width);
    expect(box?.height).toBe(vp.height);
    await expect(unoDialog.getByTestId('game-leave')).toBeInViewport();
    await expect(org.getByTestId('uno-draw')).toBeInViewport();
    await expect(org.locator('[data-testid^="uno-card-"]').first()).toBeInViewport();
    await org.screenshot({ path: shotPath(`uno-playing-${vp.width}x${vp.height}.png`) });
  }

  // Assert turn indicator (uno-turn) shows on exactly one of them
  const orgTurn = org.getByTestId('uno-turn');
  const staffTurn = staff.getByTestId('uno-turn');

  await expect.poll(async () => {
    const [o, s] = await Promise.all([orgTurn.isVisible(), staffTurn.isVisible()]);
    return (o && !s) || (s && !o);
  }, { timeout: 15_000 }).toBe(true);

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
  await expect(activePage.getByTestId('uno-draw')).toBeEnabled({ timeout: 10_000 });
  await activePage.getByTestId('uno-draw').click();

  // Assert active player hand count increased to 8
  await expect(activePage.locator('[data-testid^="uno-card-"]')).toHaveCount(8, { timeout: 10_000 });

  // Assert waiting player sees card counts update (8 cards for opponent)
  await expect(waitingPage.getByText('8 cards')).toBeVisible({ timeout: 10_000 });

  // Assert waiting player only sees their own 7 cards and never sees the active player's cards
  await expect(waitingPage.locator('[data-testid^="uno-card-"]')).toHaveCount(7);
});

test('the browser console stayed clean', () => {
  expect(problems.flat()).toEqual([]);
});
