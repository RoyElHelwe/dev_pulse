import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/app-config';

export const COOKIES = {
  /** Short-lived JWT, sent with every request. */
  access: 'access_token',
  /** Long-lived random token, only sent to /api/auth. */
  refresh: 'refresh_token',
  /** "You passed the password step, now give a 2FA code" (5 minutes). */
  mfa: 'mfa_token',
  /** "This browser already passed 2FA" (30 days). */
  trustedDevice: 'trusted_device',
  /** OAuth state + PKCE verifier during a Google/GitHub/42 redirect. */
  oauth: 'oauth_state',
  /** "Signed in correctly, but the account is open elsewhere" (10 minutes). */
  takeover: 'takeover_token',
  /** Ties the "close all sessions" email link to the browser that asked for it. */
  closeSessions: 'close_sessions',
  /**
   * Not secret, readable by the frontend: "someone is signed in, and the
   * access token expires at <ms>". Lets the app refresh before it expires
   * (no failed requests) and lets Next.js redirect signed-out visitors.
   */
  signedIn: 'signed_in',
} as const;

const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' };

export const COOKIE_OPTIONS = {
  access: { ...base, path: '/' },
  refresh: { ...base, sameSite: 'strict', path: '/api/auth' },
  mfa: { ...base, path: '/api/auth' },
  trustedDevice: { ...base, path: '/api/auth' },
  oauth: { ...base, path: '/api/auth/oauth' },
  takeover: { ...base, sameSite: 'strict', path: '/api/auth/sessions' },
  closeSessions: { ...base, sameSite: 'strict', path: '/api/auth/sessions' },
  signedIn: { secure: true, sameSite: 'lax', path: '/' },
} satisfies Record<string, CookieOptions>;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export function setSessionCookies(res: Response, tokens: SessionTokens, config: AppConfig) {
  const refreshMaxAge = config.refreshTokenTtlDays * 24 * 3600 * 1000;
  res.cookie(COOKIES.access, tokens.accessToken, {
    ...COOKIE_OPTIONS.access,
    maxAge: config.accessTokenTtlSeconds * 1000,
  });
  res.cookie(COOKIES.refresh, tokens.refreshToken, { ...COOKIE_OPTIONS.refresh, maxAge: refreshMaxAge });
  const accessExpiresAt = Date.now() + config.accessTokenTtlSeconds * 1000;
  res.cookie(COOKIES.signedIn, String(accessExpiresAt), { ...COOKIE_OPTIONS.signedIn, maxAge: refreshMaxAge });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(COOKIES.access, COOKIE_OPTIONS.access);
  res.clearCookie(COOKIES.refresh, COOKIE_OPTIONS.refresh);
  res.clearCookie(COOKIES.signedIn, COOKIE_OPTIONS.signedIn);
}
