import { expect, type Locator, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, devUser, gotoOffice, openPage, workspace } from './helpers';
import { position, walkTo } from './nav';

// Serial run: two users collaborating on the task board.
test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
let org: Page;
let staff: Page;
const problems: string[][] = [];

test.beforeAll(async ({ browser }) => {
  const a = await openPage(browser, 'organiser');
  const b = await openPage(browser, 'staff');
  [org, staff] = [a.page, b.page];
  problems.push(a.problems, b.problems);
});

test.afterAll(closeContexts);

let reported = 0;
test.afterEach(({}, info) => {
  const all = problems.flat();
  if (all.length > reported) console.log(`after "${info.title}":\n  ${all.slice(reported).join('\n  ')}`);
  reported = all.length;
});

function getColumn(board: Locator, label: string): Locator {
  return board.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
}

async function dragCardToColumn(card: Locator, targetColumn: Locator) {
  const taskId = (await card.getAttribute('data-task-id'))!;

  // Attempt standard Playwright dragTo
  try {
    await card.dragTo(targetColumn, { timeout: 3000 });
  } catch {
    // If Playwright dragTo fails, fallback below
  }

  // Check if target column contains the card; if not, dispatch HTML5 drag & drop events
  const inTarget = await targetColumn.locator(`[data-task-id="${taskId}"]`).isVisible().catch(() => false);
  if (!inTarget) {
    const colHandle = await targetColumn.elementHandle();
    await card.evaluate((cardEl, { col, id }) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', id);
      cardEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: 100 }));
      col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: 100 }));
      cardEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, { col: colHandle!, id: taskId });
  }
}

test('setup: organiser creates office and teammate joins', async () => {
  await devOwner(org, 'Alice', 'TaskHQ', 'loft');
  await gotoOffice(org);

  await devUser(staff, 'Bob', org);
  await gotoOffice(staff);
});

const SHOTS = process.env.E2E_SHOTS; // optional dir for review screenshots

let closedX = 0; // where the HUD's Board button sits with the board shut

test('1. A clicks Board button: the board floats in from the right and pushes the whole office off to the left', async () => {
  const boardButton = org.getByRole('button', { name: /^Board/ });
  const zoomIn = org.getByRole('button', { name: 'Zoom in' });
  await expect(org.getByRole('button', { name: 'Open task board' })).toBeVisible();
  closedX = (await boardButton.boundingBox())!.x;
  if (SHOTS) await org.screenshot({ path: `${SHOTS}/board-1-closed.png` });

  await boardButton.click();
  const board = org.getByRole('region', { name: 'Task board' });
  await expect(board).toBeVisible();
  await expect(org.getByRole('button', { name: 'Close task board' })).toBeVisible();

  const view = org.viewportSize()!;
  // Settled: the board floats ~20px in from the top, right and bottom borders, rounded, not stuck to them.
  await expect.poll(async () => {
    const b = await board.boundingBox();
    const right = b ? view.width - (b.x + b.width) : -999;
    return right > 14 && right < 26; // at rest, inset from the edge
  }, { timeout: 10_000 }).toBe(true);
  const box = (await board.boundingBox())!;
  expect(view.width - (box.x + box.width)).toBeGreaterThan(14);
  expect(box.y).toBeGreaterThan(14);
  expect(box.y).toBeLessThan(30);
  expect(view.height - (box.y + box.height)).toBeGreaterThan(14);
  // The whole office layer moved: the left HUD (Board button) left the screen and is not reachable there,
  // the right-hand HUD (zoom) is what is still on screen at the left.
  const b = (await boardButton.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(0);
  await expect.poll(() => boardButton.getAttribute('inert'), { timeout: 5000 }).not.toBeNull();
  const z = (await zoomIn.boundingBox())!;
  expect(z.x).toBeGreaterThanOrEqual(0);
  expect(z.x + z.width).toBeLessThan(box.x);
  if (SHOTS) await org.screenshot({ path: `${SHOTS}/board-3-open.png` });
});

test('2. A creates card "Fix login bug", appears in "To do", B sees it live', async () => {
  const boardOrg = org.getByRole('region', { name: 'Task board' });
  const headerCreateBtn = boardOrg.locator('header').getByRole('button', { name: 'Create' });
  await headerCreateBtn.click();

  const createDialog = org.getByRole('dialog', { name: 'Create issue' });
  await expect(createDialog).toBeVisible();

  await createDialog.getByLabel('Title').fill('Fix login bug');
  await createDialog.getByRole('button', { name: 'Create' }).click();
  await expect(createDialog).toBeHidden();

  // Organiser sees card in "To do" column
  const todoColOrg = getColumn(boardOrg, 'To do');
  await expect(todoColOrg.getByText('Fix login bug')).toBeVisible();

  // Teammate B opens the board and sees the card live without reload
  const staffBoardBtn = staff.getByRole('button', { name: /^Board/ });
  await staffBoardBtn.click();
  const boardStaff = staff.getByRole('region', { name: 'Task board' });
  await expect(boardStaff).toBeVisible();

  const todoColStaff = getColumn(boardStaff, 'To do');
  await expect(todoColStaff.getByText('Fix login bug')).toBeVisible();
});

test('3. B drags card to "In progress", A sees it live, API confirms status', async () => {
  const boardStaff = staff.getByRole('region', { name: 'Task board' });
  const todoColStaff = getColumn(boardStaff, 'To do');
  const inProgressColStaff = getColumn(boardStaff, 'In progress');

  const cardStaff = todoColStaff.getByRole('button', { name: /Fix login bug/ });
  await expect(cardStaff).toBeVisible();

  await dragCardToColumn(cardStaff, inProgressColStaff);
  await expect(inProgressColStaff.getByText('Fix login bug')).toBeVisible();

  // Organiser A sees the card in "In progress" column live
  const boardOrg = org.getByRole('region', { name: 'Task board' });
  const inProgressColOrg = getColumn(boardOrg, 'In progress');
  await expect(inProgressColOrg.getByText('Fix login bug')).toBeVisible();

  // Verify via GET /api/workspace/tasks that the status is IN_PROGRESS
  await expect.poll(async () => {
    const res = await org.request.get('/api/workspace/tasks');
    if (!res.ok()) return null;
    const data = await res.json();
    const task = data.tasks?.find((t: { title: string }) => t.title === 'Fix login bug');
    return task?.status;
  }, { timeout: 10_000 }).toBe('IN_PROGRESS');
});

test('4. Esc closes card dialog then board, leaving board hidden', async () => {
  const boardOrg = org.getByRole('region', { name: 'Task board' });
  const inProgressColOrg = getColumn(boardOrg, 'In progress');
  const cardOrg = inProgressColOrg.getByRole('button', { name: /Fix login bug/ });

  // Open the card dialog
  await cardOrg.click();
  const editDialog = org.getByRole('dialog');
  await expect(editDialog).toBeVisible();

  // First Escape closes dialog but board stays open
  await org.keyboard.press('Escape');
  await expect(editDialog).toBeHidden();
  await expect(boardOrg).toBeVisible();

  // Second Escape closes board (region hidden/inert) and the office slides back, usable again
  await org.keyboard.press('Escape');
  const boardButton = org.getByRole('button', { name: /^Board/ });
  await expect(boardOrg).toBeHidden();
  await expect(org.getByRole('button', { name: 'Open task board' })).toBeVisible();
  await expect(boardButton).toBeVisible();
  await expect.poll(async () => {
    const x = (await boardButton.boundingBox())?.x;
    return x !== undefined ? Math.abs(x - closedX) : 999;
  }, { timeout: 5000 }).toBeLessThanOrEqual(20);
  expect(await boardButton.getAttribute('inert')).toBeNull();
});

test('4b. Dragging the edge handle follows the pointer, snaps open past 35% and shut again', async () => {
  const board = org.getByRole('region', { name: 'Task board' });
  const boardButton = org.getByRole('button', { name: /^Board/ });
  await expect(board).toBeHidden();
  const view = org.viewportSize()!;
  const openHandle = org.getByRole('button', { name: 'Open task board' });
  const closeHandle = org.getByRole('button', { name: 'Close task board' });
  // The handle rests on the screen edge once an animation has finished.
  const settled = () =>
    expect.poll(async () => Math.round(((await openHandle.boundingBox())?.x ?? 0) + 20), { timeout: 5000 }).toBe(view.width);

  await settled();
  const h = (await openHandle.boundingBox())!;
  const [hx, hy] = [h.x + h.width / 2, h.y + h.height / 2];

  // A short drag (< 35% of the width) springs back shut.
  await org.mouse.move(hx, hy);
  await org.mouse.down();
  await org.mouse.move(hx - 60, hy, { steps: 6 });
  await org.waitForTimeout(250); // pause: no flick
  await org.mouse.up();
  await expect(openHandle).toBeVisible();
  await expect(board).toBeHidden();
  await settled();

  // A long slow drag: the office tracks the pointer mid-drag, then the board snaps open on release.
  await org.mouse.move(hx, hy);
  await org.mouse.down();
  await org.mouse.move(hx - 120, hy, { steps: 8 });
  await org.waitForTimeout(150);
  await org.mouse.move(hx - 400, hy, { steps: 12 });
  await org.waitForTimeout(100);
  const mid = (await boardButton.boundingBox())!;
  expect(mid.x).toBeLessThan(closedX - 380); // the HUD moved with the pointer (office pushed a bit further than it)
  expect(mid.x).toBeGreaterThan(closedX - 520);
  if (SHOTS) await org.screenshot({ path: `${SHOTS}/board-2-half-dragged.png` });
  await org.waitForTimeout(150); // pause: no flick
  await org.mouse.up();
  await expect(closeHandle).toBeVisible();
  await expect(board).toBeVisible();
  await expect.poll(async () => (await board.boundingBox())?.x ?? 9999).toBeLessThan(view.width - 700);

  // Drag it back to the right: closes.
  // Wait for the opening animation to finish: the handle must stand still before it is grabbed.
  let still = -1;
  await expect
    .poll(async () => {
      const x = (await closeHandle.boundingBox())?.x ?? -2;
      const same = x === still;
      still = x;
      return same;
    }, { intervals: [200], timeout: 10_000 })
    .toBe(true);
  const c = (await closeHandle.boundingBox())!;
  const [cx, cy] = [c.x + c.width / 2, c.y + c.height / 2];
  await org.mouse.move(cx, cy);
  await org.mouse.down();
  // Far past the threshold, with a pause before releasing (position decides, not the speed of a flick,
  // which depends on how fast this machine delivers the mouse events).
  const open = (await board.boundingBox())!;
  await org.mouse.move(cx + 120, cy, { steps: 6 });
  await org.waitForTimeout(100);
  await org.mouse.move(cx + Math.min(open.width * 0.9, view.width - cx - 4), cy, { steps: 12 });
  await org.waitForTimeout(150);
  await org.mouse.up();
  await expect(openHandle).toBeVisible();
  await expect(board).toBeHidden();
  await expect.poll(async () => Math.round((await boardButton.boundingBox())?.x ?? -999), { timeout: 5000 }).toBe(Math.round(closedX));
});

test('5. Esc closes people list popover when opened', async () => {
  const peopleBtn = org.getByRole('button', { name: /in the office/ });
  await peopleBtn.click();
  await expect(peopleBtn).toHaveAttribute('aria-expanded', 'true');

  const list = org.locator('ul').last();
  await expect(list).toBeVisible();

  await org.keyboard.press('Escape');
  await expect(peopleBtn).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toBeHidden();
});

let zedUserId = '';

test('6. >8 members: row shows exactly 8 faces (count buttons with aria-label starting "Filter by " inside [data-testid=filter-faces], excluding Unassigned) and the + button shows a +N badge with correct N', async ({ playwright }) => {
  const authRes = await org.request.get('/api/auth/me');
  expect(authRes.ok()).toBe(true);
  const me = await authRes.json();
  const aliceId: string = me.id;

  const api = await playwright.request.newContext({
    ignoreHTTPSErrors: true,
    baseURL: new URL(org.url()).origin,
  });

  for (let i = 1; i <= 12; i++) {
    const name = i === 12 ? 'Zed Zebra' : `Member${String(i).padStart(2, '0')} ${stamp}`;
    const res = await api.post('/api/auth/dev/users', {
      data: { name, joinUserId: aliceId },
    });
    expect(res.ok()).toBe(true);
    if (i === 12) {
      const data = await res.json().catch(() => ({}));
      zedUserId = data.user?.id || '';
    }
  }
  await api.dispose();

  if (!zedUserId) {
    const membersRes = await org.request.get('/api/workspace/members');
    const membersList = await membersRes.json();
    const zed = membersList.find((m: { displayName: string }) => m.displayName === 'Zed Zebra');
    zedUserId = zed?.userId;
  }

  // Re-open board so members are fetched
  const board = org.getByRole('region', { name: 'Task board' });
  if (await board.isVisible()) {
    await org.getByRole('button', { name: 'Close task board' }).click();
    await expect(board).toBeHidden();
  }
  const boardButton = org.getByRole('button', { name: /^Board/ });
  await boardButton.click();
  await expect(board).toBeVisible();

  const filterFaces = org.getByTestId('filter-faces');
  await expect(filterFaces).toBeVisible();

  // Count buttons with aria-label starting "Filter by " inside [data-testid=filter-faces], excluding Unassigned
  const faceButtons = filterFaces.locator('button[aria-label^="Filter by "]:not([aria-label="Filter by Unassigned"])');
  await expect(faceButtons).toHaveCount(8);

  // Unassigned button is visible
  await expect(filterFaces.getByRole('button', { name: 'Filter by Unassigned' })).toBeVisible();

  // The + button shows a +N badge with correct N
  const membersRes = await org.request.get('/api/workspace/members');
  const membersList = await membersRes.json();
  const extraCount = membersList.length - 8;
  const plusBtn = filterFaces.getByRole('button', { name: 'Find more people' });
  await expect(plusBtn).toBeVisible();
  await expect(plusBtn).toContainText(`+${extraCount}`);

  if (SHOTS) await org.screenshot({ path: `${SHOTS}/board-17-row.png` });
});

test('7. + opens dialog: search input is focused; typing "Zebra" narrows rows to the matching person(s); Enter toggles the active row (checkmark / aria-selected=true); filter pins that person into the 8-face row (aria-pressed=true button for them appears) while selected, row still has exactly 8 faces; Esc closes ONLY the dialog (board region still visible); Clear selection empties it (re-open dialog, click "Clear selection", assert no aria-pressed=true faces); also click a row with the mouse to toggle and check the board cards filter', async () => {
  const board = org.getByRole('region', { name: 'Task board' });
  await expect(board).toBeVisible();
  const filterFaces = org.getByTestId('filter-faces');
  const plusBtn = filterFaces.getByRole('button', { name: 'Find more people' });

  // + opens dialog
  await plusBtn.click();
  const dialog = org.getByRole('dialog', { name: 'Find people' });
  await expect(dialog).toBeVisible();

  // search input is focused
  const searchInput = dialog.getByLabel('Search people');
  await expect(searchInput).toBeFocused();

  // typing "Zebra" narrows rows to the matching person(s)
  await searchInput.fill('Zebra');
  const rows = dialog.getByTestId('people-picker-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Zed Zebra');

  // Enter toggles the active row (checkmark / aria-selected=true)
  await org.keyboard.press('Enter');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
  await expect(rows.first().locator('.lucide-check')).toBeVisible();

  if (SHOTS) await org.screenshot({ path: `${SHOTS}/board-17-dialog.png` });

  // filter pins that person into the 8-face row (aria-pressed=true button for them appears) while selected, row still has exactly 8 faces
  const zedFaceBtn = filterFaces.getByRole('button', { name: 'Filter by Zed Zebra' });
  await expect(zedFaceBtn).toBeVisible();
  await expect(zedFaceBtn).toHaveAttribute('aria-pressed', 'true');

  const faceButtons = filterFaces.locator('button[aria-label^="Filter by "]:not([aria-label="Filter by Unassigned"])');
  await expect(faceButtons).toHaveCount(8);

  // Esc closes ONLY the dialog (board region still visible)
  await org.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(board).toBeVisible();

  // Clear selection empties it (re-open dialog, click "Clear selection", assert no aria-pressed=true faces)
  await plusBtn.click();
  await expect(dialog).toBeVisible();

  const clearBtn = dialog.getByRole('button', { name: 'Clear selection' });
  await expect(clearBtn).toBeEnabled();
  await clearBtn.click();

  const pressedFaces = filterFaces.locator('button[aria-pressed="true"]');
  await expect(pressedFaces).toHaveCount(0);

  // Also click a row with the mouse to toggle and check the board cards filter
  const taskRes = await org.request.post('/api/workspace/tasks', {
    data: {
      title: 'Zebra task for filter test',
      assigneeId: zedUserId,
    },
  });
  expect(taskRes.ok()).toBe(true);

  // Search "Zebra" and click row with mouse to toggle
  await searchInput.fill('Zebra');
  await expect(rows).toHaveCount(1);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true');

  // Close dialog via Done button
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();

  // Board cards filter: Zebra task is visible, "Fix login bug" is hidden
  await expect(board.getByText('Zebra task for filter test')).toBeVisible();
  await expect(board.getByText('Fix login bug')).toBeHidden();

  // Click face button in face row to toggle off
  await zedFaceBtn.click();
  const pressedFacesAfter = filterFaces.locator('button[aria-pressed="true"]');
  await expect(pressedFacesAfter).toHaveCount(0);
  await expect(board.getByText('Fix login bug')).toBeVisible();
  await expect(board.getByText('Zebra task for filter test')).toBeVisible();
});

test('8. a toast stays visible while the task board is open', async () => {
  const board = org.getByRole('region', { name: 'Task board' });
  if (await board.isVisible()) {
    await org.keyboard.press('Escape');
    await expect(board).toBeHidden();
  }

  const boardButton = org.getByRole('button', { name: /^Board/ });
  await boardButton.click();
  await expect(board).toBeVisible();

  await org.context().setOffline(true);
  const status = org.getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Connection lost');

  const view = org.viewportSize()!;
  const box = (await status.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y).toBeGreaterThanOrEqual(0);

  await org.context().setOffline(false);
  await expect(status).toBeHidden();

  // With the board open and settled (wait ~1.5 s), canvas is paused-but-alive
  await org.waitForTimeout(1500);

  // Close the board, wait, then walk to assert canvas resumed
  await org.keyboard.press('Escape');
  await expect(board).toBeHidden();
  await org.waitForTimeout(500);

  const { layout } = await workspace(org);
  const before = await position(org);
  const targetY = before.y > 20 ? before.y - 2 : before.y + 2;
  await walkTo(org, layout, before.x, targetY);
  const after = await position(org);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.5);
});

