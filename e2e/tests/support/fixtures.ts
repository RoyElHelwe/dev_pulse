// Shared Playwright fixtures and test extensions for E2E tests.
// Provides a fresh two-person team (organiser + staff) in an office per test,
// console issue assertions, and automatic context cleanup.

import { expect, test as baseTest, type Page } from '@playwright/test';
import { closeContexts, openPage } from './browser';
import { gotoOffice } from './office';
import { devOwner, devUser } from './users';

export interface Team {
  org: Page;
  staff: Page;
}

/**
 * Asserts that no console errors, warnings, page errors, or 4xx/5xx network responses occurred.
 * Logs collected problems with the test title if any were captured.
 */
export function expectCleanConsole(problems: string[], title: string) {
  if (problems.length > 0) {
    console.log(`after "${title}":\n  ${problems.join('\n  ')}`);
  }
  expect(problems).toEqual([]);
}

/**
 * `test` with a `team` fixture: a fresh office with its organiser (Roy) and one teammate (Zakaria), both
 * signed in through the dev API and already on /office. Built per test so tests never depend on each other;
 * the console must stay clean for the test to pass.
 */
export const test = baseTest.extend<{ team: Team }>({
  team: async ({ browser }, use, testInfo) => {
    const a = await openPage(browser, 'organiser');
    const b = await openPage(browser, 'staff');
    const { page: org, problems: orgProblems } = a;
    const { page: staff, problems: staffProblems } = b;

    await devOwner(org, 'Roy', 'E2E HQ');
    await devUser(staff, 'Zakaria', org);
    await gotoOffice(org);
    await gotoOffice(staff);

    try {
      await use({ org, staff });
    } finally {
      // Cleanup first: the contexts must close even when the test (or the console check) fails.
      await closeContexts();
    }
    // A test that already failed reports its own error; the console check only judges passing tests.
    if (testInfo.status === 'passed') expectCleanConsole([...orgProblems, ...staffProblems], testInfo.title);
  },
});

export { expect };
