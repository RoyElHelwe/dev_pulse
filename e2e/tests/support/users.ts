// User provisioning and authentication utilities for E2E tests.
// Provides standard form registration flows and accelerated dev sign-in API helpers.

import { expect, type Page } from '@playwright/test';

/**
 * Completes full user registration via the /register page form and waits for onboarding.
 * Handles dev login switcher bypassing when running against an instance with dev sign-in enabled.
 */
export async function register(page: Page, name: string, email: string) {
  // With DEV_LOGIN on, /register first shows the identity switcher; settle the /auth/dev check, then use the real form.
  const devCheck = page.waitForResponse((r) => r.url().includes('/auth/dev'), { timeout: 10_000 }).catch(() => undefined);
  await page.goto('/register');
  const enabled = await (await devCheck)?.json().then((s: { enabled?: boolean }) => !!s.enabled).catch(() => false);
  if (enabled) await page.getByRole('button', { name: 'Use the real sign-in' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('supersecret1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding**');
}

/**
 * Setup through the dev sign-in API instead of the forms (the specs that test the forms still use register()).
 * Creates a verified user, signs the page's browser context in and, when `host` is given, puts the user in the
 * host's office. Never use this in the specs that test sign-up, onboarding or invitations.
 */
export async function devUser(page: Page, name: string, host?: Page): Promise<string> {
  const joinUserId = host ? await userId(host) : undefined;
  const res = await page.context().request.post('/api/auth/dev/users', { data: { name, joinUserId } });
  expect(res.ok(), `dev sign-in failed: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { user: { id: string } }).user.id;
}

/**
 * Retrieves the currently authenticated user's ID by querying the /api/auth/me endpoint.
 */
export async function userId(page: Page): Promise<string> {
  const res = await page.context().request.get('/api/auth/me');
  return ((await res.json()) as { id: string }).id;
}

/**
 * Creates the office of a signed-in user through the API (same body as the onboarding form).
 */
async function createOffice(page: Page, name: string, templateId = 'loft', character = 'maya') {
  const res = await page.context().request.post('/api/workspace', { data: { name, templateId, character } });
  expect(res.ok(), `create office failed: ${res.status()}`).toBeTruthy();
}

/**
 * Convenience setup creating a signed-in office owner without using UI forms: provisions dev user and office.
 */
export async function devOwner(page: Page, name: string, officeName = 'Acme HQ', templateId = 'loft') {
  await devUser(page, name);
  await createOffice(page, officeName, templateId);
}

/**
 * Converts an absolute link constructed with APP_URL into a same-origin URL matching the test page's host.
 */
const local = (page: Page, link: string) => new URL(new URL(link).pathname, page.url()).toString();

/**
 * Issues an invitation for an email address via POST /api/workspace/invitations and returns a same-origin accept link.
 */
export async function invite(page: Page, email: string): Promise<string> {
  const result = await page.evaluate(
    (email) =>
      fetch('/api/workspace/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: 'MEMBER' }),
      }).then((r) => r.json()),
    email,
  );
  return local(page, result.link);
}
