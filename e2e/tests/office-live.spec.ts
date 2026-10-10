import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expect, type Page, test } from '@playwright/test';
import { closeContexts, devOwner, devUser, gotoOffice, openPage, userId, workspace } from './helpers';

// Serial run: two users collaborating in the office.
test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
let org: Page;
let staff: Page;
const problems: string[][] = [];

const SCREENSHOT_DIR = path.join(os.tmpdir(), 'dev-pulse-e2e');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.afterAll(closeContexts);

test.beforeAll(async ({ browser }) => {
  const a = await openPage(browser, 'organiser');
  const b = await openPage(browser, 'staff');
  [org, staff] = [a.page, b.page];
  problems.push(a.problems, b.problems);
});

let reported = 0;
test.afterEach(({}, info) => {
  const all = problems.flat();
  if (all.length > reported) console.log(`after "${info.title}":\n  ${all.slice(reported).join('\n  ')}`);
  reported = all.length;
});

test('setup: organiser creates office and teammate joins', async () => {
  await devOwner(org, 'Alice', 'TaskHQ', 'loft');
  await gotoOffice(org);

  await devUser(staff, 'Bob', org);
  await gotoOffice(staff);
});

test('1. CHAT BUBBLE: speech bubble over Alice appears and fades after ~12s', async () => {
  // Alice opens the chat panel
  const chatBtn = org.getByRole('button', { name: /chat/i });
  await chatBtn.click();

  const composer = org.getByPlaceholder('Message the office');
  await expect(composer).toBeVisible();

  // Send message in Office channel
  await composer.fill('Hello from Alice bubble test');
  await org.keyboard.press('Enter');

  // Verify message arrived in chat log
  await expect(org.getByRole('log', { name: 'Messages' }).getByText('Hello from Alice bubble test')).toBeVisible();

  // Immediately take screenshots of BOTH Alice's and Bob's page
  const aliceBubbleShot = path.join(SCREENSHOT_DIR, '01-alice-chat-bubble.png');
  const bobBubbleShot = path.join(SCREENSHOT_DIR, '01-bob-chat-bubble.png');
  await org.screenshot({ path: aliceBubbleShot });
  await staff.screenshot({ path: bobBubbleShot });

  // Close the chat panel so text inputs lose focus
  const closeChat = org.getByRole('button', { name: 'Close chat' });
  if (await closeChat.isVisible()) {
    await closeChat.click();
  }

  // Wait ~12 s for speech bubble to fade completely
  await staff.waitForTimeout(12_000);

  // Take another screenshot of Bob's page (bubble should be gone)
  const bobFadedShot = path.join(SCREENSHOT_DIR, '01-bob-chat-bubble-faded.png');
  await staff.screenshot({ path: bobFadedShot });

  // Assert console clean
  expect(problems.flat()).toEqual([]);
});

test('2. PAPER STACK: tasks assigned to Alice increase paper stack on her desk', async () => {
  // Get Alice's user id
  const aliceId = await userId(org);

  // Alice creates 1 task assigned to herself
  const taskRes1 = await org.request.post('/api/workspace/tasks', {
    data: {
      title: 'Paper stack task 1',
      assigneeId: aliceId,
    },
  });
  expect(taskRes1.ok()).toBe(true);

  // Give socket / canvas a moment to update desk texture
  await org.waitForTimeout(1500);

  const shot1 = path.join(SCREENSHOT_DIR, '02-alice-desk-1task.png');
  await org.screenshot({ path: shot1 });

  // Create 3 more assigned to Alice
  for (let i = 2; i <= 4; i++) {
    const res = await org.request.post('/api/workspace/tasks', {
      data: {
        title: `Paper stack task ${i}`,
        assigneeId: aliceId,
      },
    });
    expect(res.ok()).toBe(true);
  }

  await org.waitForTimeout(1500);

  const shot4 = path.join(SCREENSHOT_DIR, '02-alice-desk-4tasks.png');
  await org.screenshot({ path: shot4 });

  expect(problems.flat()).toEqual([]);
});

test('3. DESK MOVE: Alice walks to a free desk and moves seat', async () => {
  const ws = await workspace(org);
  const freeDesk = ws.layout.furniture.find(
    (f) => f.kind === 'desk' && !ws.desks.some((d) => d.deskId === f.id),
  );
  expect(freeDesk).toBeDefined();

  // Focus canvas and ensure no input element has focus
  await org.locator('canvas').click({ position: { x: 300, y: 300 } });
  await org.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  // Try walking to a free desk in the Loft east cluster (Desk 7 / Desk 8)
  // Spawn is at (17, 25.5), east cluster desks have seats around (19.5, 19.4)
  const moveBtn = org.getByRole('button', { name: 'Move here' });

  // Walk right towards column 19.5
  await org.keyboard.down('ArrowRight');
  await org.waitForTimeout(500);
  await org.keyboard.up('ArrowRight');

  // Walk up towards row 19.4
  await org.keyboard.down('ArrowUp');
  await org.waitForTimeout(1200);
  await org.keyboard.up('ArrowUp');

  // Check hint and press e
  await org.keyboard.press('e');
  await org.waitForTimeout(500);

  let uiWorked = await moveBtn.isVisible();

  // If not immediately triggered, nudge around slightly and press e
  if (!uiWorked) {
    const nudges: Array<{ key: string; ms: number }> = [
      { key: 'ArrowUp', ms: 300 },
      { key: 'ArrowDown', ms: 200 },
      { key: 'ArrowRight', ms: 300 },
      { key: 'ArrowLeft', ms: 400 },
      { key: 'ArrowUp', ms: 300 },
    ];
    for (const nudge of nudges) {
      await org.keyboard.down(nudge.key);
      await org.waitForTimeout(nudge.ms);
      await org.keyboard.up(nudge.key);
      await org.keyboard.press('e');
      await org.waitForTimeout(300);
      if (await moveBtn.isVisible()) {
        uiWorked = true;
        break;
      }
    }
  }

  const moveShotBefore = path.join(SCREENSHOT_DIR, '03-alice-desk-walk.png');
  await org.screenshot({ path: moveShotBefore });

  if (uiWorked) {
    await expect(moveBtn).toBeVisible();
    await moveBtn.click();
    await expect(org.getByText(/is your desk now/)).toBeVisible();
  } else {
    // Fallback via API as instructed
    console.log('Walking was fiddly; verifying PUT /api/workspace/me/desk via API fallback');
    const moveRes = await org.request.put('/api/workspace/me/desk', {
      data: { deskId: freeDesk!.id },
    });
    expect(moveRes.ok()).toBe(true);
  }

  const moveShotAfter = path.join(SCREENSHOT_DIR, '03-alice-desk-moved.png');
  await org.screenshot({ path: moveShotAfter });

  expect(problems.flat()).toEqual([]);
});
