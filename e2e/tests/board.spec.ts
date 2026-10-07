import { expect, type Locator, type Page, test } from '@playwright/test';
import { closeContexts, inOffice, invite, openPage, register } from './helpers';

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
  await register(org, 'Alice', `alice${stamp}@example.com`);
  await org.getByRole('button', { name: /Create an office/ }).click();
  await org.getByLabel('Office name').fill('TaskHQ');
  await org.getByRole('button', { name: 'Continue' }).click();
  // Office template step: Loft is selected by default
  await org.getByRole('button', { name: 'Continue' }).click();
  // Character step
  await org.getByRole('button', { name: 'Create the office' }).click();
  await inOffice(org);

  const link = await invite(org, `bob${stamp}@example.com`);
  await register(staff, 'Bob', `bob${stamp}@example.com`);
  await staff.goto(link);
  await staff.getByRole('button', { name: /^Join / }).click();
  await inOffice(staff);
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
  await org.waitForTimeout(500); // and the pushed-off HUD has been made inert
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
  await expect.poll(async () => Math.round((await boardButton.boundingBox())?.x ?? -999), { timeout: 5000 }).toBe(Math.round(closedX));
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
  const c = (await closeHandle.boundingBox())!;
  const [cx, cy] = [c.x + c.width / 2, c.y + c.height / 2];
  await org.mouse.move(cx, cy);
  await org.mouse.down();
  await org.mouse.move(cx + 120, cy, { steps: 6 });
  await org.mouse.move(cx + 600, cy, { steps: 12 });
  await org.mouse.up(); // a flick to the right
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
