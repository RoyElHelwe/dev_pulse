/**
 * Authentication cookie names, security options, and helper utilities.
 * Configures cookie security flags (HttpOnly, Secure, SameSite) and manages session cookie lifecycles.
 */
import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/app-config';

const MS_PER_SECOND = 1000;
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = 3600;
const MS_PER_DAY = HOURS_PER_DAY * SECONDS_PER_HOUR * MS_PER_SECOND;

/** Cookie name keys used across authentication flows. */
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

// httpOnly prevents script access (mitigating XSS); secure requires TLS; lax permits top-level navigation.
const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' };

/** Predefined cookie options specifying path boundaries and SameSite security rules. */
export const COOKIE_OPTIONS = {
  // Access cookie is needed across all routes for standard API access.
  access: { ...base, path: '/' },
  // Refresh token is locked down to strict same-site and /api/auth path to prevent CSRF on token refresh.
  refresh: { ...base, sameSite: 'strict', path: '/api/auth' },
  mfa: { ...base, path: '/api/auth' },
  trustedDevice: { ...base, path: '/api/auth' },
  oauth: { ...base, path: '/api/auth/oauth' },
  takeover: { ...base, sameSite: 'strict', path: '/api/auth/sessions' },
  closeSessions: { ...base, sameSite: 'strict', path: '/api/auth/sessions' },
  // Non-HttpOnly cookie intentionally readable by JavaScript to schedule proactive token renewals.
  signedIn: { secure: true, sameSite: 'lax', path: '/' },
} satisfies Record<string, CookieOptions>;

/** Pair of JWT access token and opaque refresh token representing an active session. */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/** Sets access, refresh, and frontend expiration indicator cookies on the HTTP response. */
export function setSessionCookies(res: Response, tokens: SessionTokens, config: AppConfig) {
  const refreshMaxAge = config.refreshTokenTtlDays * MS_PER_DAY;
  res.cookie(COOKIES.access, tokens.accessToken, {
    ...COOKIE_OPTIONS.access,
    maxAge: config.accessTokenTtlSeconds * MS_PER_SECOND,
  });
  res.cookie(COOKIES.refresh, tokens.refreshToken, { ...COOKIE_OPTIONS.refresh, maxAge: refreshMaxAge });
  const accessExpiresAt = Date.now() + config.accessTokenTtlSeconds * MS_PER_SECOND;
  res.cookie(COOKIES.signedIn, String(accessExpiresAt), { ...COOKIE_OPTIONS.signedIn, maxAge: refreshMaxAge });
}

/** Clears all session authentication cookies from the HTTP client. */
export function clearSessionCookies(res: Response) {
  res.clearCookie(COOKIES.access, COOKIE_OPTIONS.access);
  res.clearCookie(COOKIES.refresh, COOKIE_OPTIONS.refresh);
  res.clearCookie(COOKIES.signedIn, COOKIE_OPTIONS.signedIn);
}

