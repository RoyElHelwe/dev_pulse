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

test('1. A clicks Board button, task board opens, HUD positioned below board', async () => {
  const boardButton = org.getByRole('button', { name: /^Board/ });
  await expect(boardButton).toHaveAttribute('aria-expanded', 'false');

  await boardButton.click();
  await expect(boardButton).toHaveAttribute('aria-expanded', 'true');

  const board = org.getByRole('region', { name: 'Task board' });
  await expect(board).toBeVisible();

  // The Board button must remain visible and be positioned below the board's bottom edge
  await expect(boardButton).toBeVisible();
  await expect.poll(async () => {
    const boardBox = await board.boundingBox();
    const btnBox = await boardButton.boundingBox();
    if (!boardBox || !btnBox) return false;
    return btnBox.y >= (boardBox.y + boardBox.height) - 1;
  }, { timeout: 10_000 }).toBe(true);
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

  // Second Escape closes board (Board button aria-expanded=false, region hidden/inert)
  await org.keyboard.press('Escape');
  const boardButton = org.getByRole('button', { name: /^Board/ });
  await expect(boardButton).toHaveAttribute('aria-expanded', 'false');
  await expect(boardOrg).toBeHidden();
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
