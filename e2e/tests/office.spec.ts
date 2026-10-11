// Office E2E test suite covering creation, invitations, proximity voice, chat,
// room booking, status changes, desk interactions, layout editing, and teammate management.
// Each test builds its own fresh office environment via fixtures or dev sign-in helpers so tests
// run independently in any order or in parallel without serial dependencies or state leakage.

import { type Page } from '@playwright/test';
import { closeContexts, connectedCalls, openPage } from './support/browser';
import { expect, expectCleanConsole, test } from './support/fixtures';
import { gotoOffice, inOffice, peopleList, workspace } from './support/office';
import { devOwner, devUser, invite, register } from './support/users';
import { jumpTo, walkTo } from './support/walker';

test('the organiser creates an office from a template', async ({ browser }, testInfo) => {
  const { page: org, problems } = await openPage(browser, 'organiser');
  try {
    const email = `roy${Date.now()}-${testInfo.parallelIndex}@example.com`;
    await register(org, 'Roy', email);
    await org.getByRole('button', { name: /Create an office/ }).click();
    await org.getByLabel('Office name').fill('E2E HQ');
    await org.getByRole('button', { name: 'Continue' }).click();
    // No team-size question any more: the Loft is preselected and is what the story uses.
    await expect(org.getByRole('radio', { name: /Loft/ })).toHaveAttribute('aria-checked', 'true');
    await org.getByRole('button', { name: 'Continue' }).click();
    await org.getByRole('button', { name: 'Create the office' }).click();
    await inOffice(org);
    const w = await workspace(org);
    expect(w.deskId).not.toBeNull();
    expectCleanConsole(problems, testInfo.title);
  } catch (err) {
    if (problems.length > 0) console.log(`after "${testInfo.title}":\n  ${problems.join('\n  ')}`);
    throw err;
  } finally {
    await closeContexts();
  }
});

test('an invited teammate picks a character and joins', async ({ browser }, testInfo) => {
  const { page: org, problems: orgProblems } = await openPage(browser, 'organiser');
  const { page: staff, problems: staffProblems } = await openPage(browser, 'staff');
  try {
    await devOwner(org, 'Roy', 'E2E HQ');
    await gotoOffice(org);
    const email = `staff${Date.now()}-${testInfo.parallelIndex}@example.com`;
    const link = await invite(org, email);
    await register(staff, 'Zakaria', email);
    await staff.goto(link);
    await staff.getByRole('radio', { name: 'kai' }).click();
    await staff.getByRole('button', { name: 'Join E2E HQ' }).click();
    await inOffice(staff);
    const w = await workspace(staff);
    expect(w.character).toBe('kai');
    expect(w.desks).toHaveLength(2);
    expectCleanConsole([...orgProblems, ...staffProblems], testInfo.title);
  } catch (err) {
    const problems = [...orgProblems, ...staffProblems];
    if (problems.length > 0) console.log(`after "${testInfo.title}":\n  ${problems.join('\n  ')}`);
    throw err;
  } finally {
    await closeContexts();
  }
});

test('people near each other are "nearby" and hear each other, until one walks away', async ({ team }) => {
  const { org, staff } = team;
  await expect.poll(() => peopleList(org)).toContain('Nearby');
  for (const page of [org, staff]) await page.getByRole('button', { name: 'Join voice' }).click();
  await expect.poll(() => connectedCalls(org), { timeout: 30_000 }).toBe(1);
  await expect.poll(() => connectedCalls(staff)).toBe(1);
  const { layout } = await workspace(staff);
  const open = layout.rooms.find((r) => r.kind === 'open')!;
  await walkTo(staff, layout, open.x + 2, open.y + 2);
  await expect.poll(() => peopleList(org)).not.toContain('Nearby');
  await expect.poll(() => connectedCalls(org)).toBe(0);
  for (const page of [org, staff]) await page.getByRole('button', { name: 'Leave voice' }).click();
  await expect(org.getByRole('button', { name: 'Join voice' })).toBeVisible();
});

test('a message to the office reaches everyone', async ({ team }) => {
  const { org, staff } = team;
  await org.getByRole('button', { name: 'Open chat' }).click();
  await org.getByLabel('Message the office').fill('Stand-up in 5 minutes');
  await org.getByLabel('Message the office').press('Enter');
  await staff.getByRole('button', { name: /Open chat/ }).click();
  await expect(staff.getByRole('log').getByText('Stand-up in 5 minutes')).toBeVisible();
  for (const page of [org, staff]) await page.getByRole('button', { name: 'Close chat' }).click();
});

test('a meeting room is booked once per time slot', async ({ team }) => {
  const { org, staff } = team;
  const { layout } = await workspace(org);
  const room = layout.rooms.find((r) => r.kind === 'meeting')!;
  // Tomorrow 10:00-11:00, so nobody is locked out of the room in the next tests.
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const book = (page: Page, title: string) =>
    page.evaluate(
      (body) => fetch('/api/workspace/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()),
      { roomId: room.id, title, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), attendeeIds: [] },
    );
  expect((await book(org, 'Planning')).error).toBeUndefined();
  expect((await book(staff, 'Retro')).error?.code).toBe('ROOM_TAKEN');
  await staff.getByRole('button', { name: 'Rooms' }).click();
  await expect(staff.getByRole('dialog', { name: 'Meeting rooms' })).toBeVisible();
  await staff.keyboard.press('Escape');
  await expect(staff.getByRole('dialog', { name: 'Meeting rooms' })).toBeHidden();
});

test('a status shows to everyone', async ({ team }) => {
  const { org, staff } = team;
  // Status lives in the top-right user menu now.
  await org.getByRole('button', { name: 'Roy', exact: true }).click();
  await org.getByRole('menuitem', { name: /Status/ }).click();
  await org.getByRole('button', { name: 'Focusing' }).click();
  await expect(org.getByRole('button', { name: 'Focusing' })).toHaveAttribute('aria-pressed', 'true');
  await org.keyboard.press('Escape');
  await expect(org.getByRole('menu')).toBeHidden();
  await org.locator('canvas').click({ position: { x: 600, y: 400 } });
  await expect.poll(() => peopleList(staff)).toContain('Focusing');
});

test('at your desk, E opens it and others see where you are', async ({ team }) => {
  const { org, staff } = team;
  const w = await workspace(org);
  const desk = w.layout.furniture.find((f) => f.id === w.deskId)!;
  const seatY = desk.y + Math.cos(((desk.rotation ?? 0) * Math.PI) / 180) * (desk.h / 2 + 0.45);
  await jumpTo(org, desk.x, seatY);
  // The player may still be sitting down or standing up: press E until the desk answers.
  await expect(async () => {
    await org.keyboard.press('e');
    // E at your own desk opens the task board, filtered to your issues.
    await expect(org.getByRole('region', { name: 'Task board' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(org.getByRole('button', { name: 'Only my issues' })).toHaveAttribute('aria-pressed', 'true');
  await org.keyboard.press('Escape');
  await expect(org.getByRole('button', { name: /^Board/ })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => peopleList(staff)).toContain('At Roy’s desk');
});

test('walking into a meeting room shows it to the others', async ({ team }) => {
  const { org, staff } = team;
  const { layout } = await workspace(staff);
  const room = layout.rooms.find((r) => r.kind === 'meeting')!;
  await jumpTo(staff, room.x + room.w / 2, room.y + room.h - 2);
  await expect.poll(() => peopleList(org)).toContain(`${room.name} · Meeting room`);
});

test('the organiser swaps desks from the team page', async ({ team }) => {
  const { org, staff } = team;
  const before = await workspace(staff);
  await org.goto('/team');
  await org.getByLabel('Desk of Zakaria').selectOption({ label: 'Desk 1 (swap with Roy)' });
  await expect.poll(async () => (await workspace(staff)).deskId).not.toBe(before.deskId);
  await org.goto('/office');
  await inOffice(org);
});

test('the editor selects groups, refuses overlaps and saves for everyone', async ({ team }) => {
  const { org, staff } = team;
  const before = await workspace(org);
  await org.getByRole('button', { name: 'Edit office' }).click();
  await expect(org.getByText('Editing the office')).toBeVisible();
  const box = (await org.locator('canvas').boundingBox())!;
  const spots: [number, number][] = [];
  for (let dy = -200; dy <= 200; dy += 50) for (let dx = -300; dx <= 360; dx += 60) spots.push([box.x + box.width / 2 + dx, box.y + box.height / 2 + dy]);

  const place = async (candidates: [number, number][]) => {
    for (const [x, y] of candidates) {
      await org.getByRole('button', { name: 'Plant', exact: true }).click();
      await org.mouse.move(x, y);
      await org.mouse.click(x, y);
      if ((await org.getByRole('button', { name: 'Plant', exact: true }).getAttribute('aria-pressed')) === 'false') return [x, y];
      await org.keyboard.press('Escape');
    }
    throw new Error('no free spot');
  };
  const p1 = await place(spots);
  const p2 = await place(spots.filter(([x, y]) => Math.hypot(x - p1[0], y - p1[1]) > 90));

  // Shift-click adds a piece to the selection. This runs BEFORE the refused drop on purpose: the drop below
  // leaves the dragged plant's selection and on-screen position in a state that varies with frame timing
  // (the old order, select after the refusal, failed about 1 run in 3), so nothing after it clicks on plants.
  // Each attempt starts from an empty selection (Escape), because a click on an already selected piece
  // keeps the selection and a shift-click on it would remove it again.
  await expect(async () => {
    await org.keyboard.press('Escape');
    try {
      await org.mouse.click(p1[0], p1[1]);
      await org.keyboard.down('Shift');
      await org.mouse.click(p2[0], p2[1]);
    } finally {
      await org.keyboard.up('Shift').catch(() => undefined);
    }
    await expect(org.getByText('2 pieces selected')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  // Escape clears the selection, so the drag below grabs one plant (a drag on a selected piece moves them all).
  await org.keyboard.press('Escape');
  await expect(org.getByText('2 pieces selected')).toBeHidden();

  // Dropping one plant on the other is refused and both stay where they were.
  await org.mouse.move(p2[0], p2[1]);
  await org.mouse.down();
  await org.mouse.move(p1[0], p1[1], { steps: 8 });
  await org.mouse.up();
  await expect(org.getByRole('status').filter({ hasText: 'overlaps' })).toBeVisible();

  await org.getByRole('button', { name: 'Save for everyone' }).click();
  await expect(org.getByText('Editing the office')).toBeHidden();
  await expect(staff.getByRole('status').filter({ hasText: 'rearranged' })).toBeVisible();
  const after = await workspace(staff);
  expect(after.layoutVersion).toBe(before.layoutVersion + 1);
  expect(after.layout.furniture.length).toBe(before.layout.furniture.length + 2);
  // The refused drop was undone: no two plants ended up on the same spot.
  const plants = after.layout.furniture.filter((f) => f.kind === 'plant').map((f) => `${f.x},${f.y}`);
  expect(new Set(plants).size).toBe(plants.length);
});

test('two organisers saving at once: the second is asked to load the latest', async ({ team }) => {
  const { org } = team;
  await org.getByRole('button', { name: 'Edit office' }).click();
  await org.getByRole('button', { name: /Reset to the original furniture/ }).click();
  // Someone else saves meanwhile.
  await org.evaluate(async () => {
    const w = await fetch('/api/workspace').then((r) => r.json());
    await fetch('/api/workspace/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: w.layoutVersion, furniture: w.layout.furniture.slice(0, -1), rooms: [] }),
    });
  });
  await org.getByRole('button', { name: 'Save for everyone' }).click();
  await expect(org.getByText('Someone else saved the office meanwhile')).toBeVisible();
  await org.getByRole('button', { name: 'Load the latest' }).click();
  await expect(org.getByText('Editing the office')).toBeHidden();
});

test('the organiser moves everyone to a bigger office', async ({ team }) => {
  const { org, staff } = team;
  await org.goto('/team');
  await org.getByRole('radio', { name: /Campus/ }).click();
  await org.getByRole('button', { name: 'Move to Campus' }).click();
  // The teammate's notice only shows for 4 s: start waiting for it before the move happens.
  const noticed = expect(staff.getByRole('status').filter({ hasText: 'rearranged' })).toBeVisible();
  await org.getByRole('button', { name: 'Confirm' }).click();
  await expect(org.getByText('Your office is now Campus.')).toBeVisible();
  await expect.poll(async () => (await workspace(staff)).templateId).toBe('campus');
  await noticed;
});

test('on a phone, the joystick walks', async ({ team, browser }, testInfo) => {
  const { org } = team;
  const { page: phone, problems: phoneProblems } = await openPage(browser, 'phone', {
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  await devUser(phone, 'Roy', org);
  await gotoOffice(phone);
  const stick = phone.getByRole('application', { name: /Joystick/ });
  await expect(stick).toBeVisible();

  // Watch Roy from the organiser's minimap while she walks up.
  await org.goto('/office');
  await inOffice(org);
  // Sum of the others' rows on the map: goes down when someone walks up.
  const rows = () =>
    org.locator('circle[fill="#3f3f46"]').evaluateAll((cs) => cs.reduce((sum, c) => sum + Number(c.getAttribute('cy')), 0));
  await expect.poll(() => org.locator('circle[fill="#3f3f46"]').count()).toBe(2);
  const start = await rows();
  const b = (await stick.boundingBox())!;
  await phone.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await phone.mouse.down();
  await phone.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 50, { steps: 5 });
  await expect.poll(async () => start - (await rows()), { timeout: 30_000 }).toBeGreaterThan(1);
  await phone.mouse.up();
  expectCleanConsole(phoneProblems, testInfo.title);
});

test('a removed teammate leaves the office at once', async ({ team }) => {
  const { org, staff } = team;
  await org.goto('/team');
  await org.getByRole('listitem').filter({ hasText: 'Zakaria' }).getByRole('button', { name: 'Remove' }).click();
  await org.getByRole('button', { name: 'Click to confirm' }).click();
  await staff.waitForURL('**/onboarding?notice=removed');
  await expect(staff.getByText('You were removed from your office')).toBeVisible();
});
