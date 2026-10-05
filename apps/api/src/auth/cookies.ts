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
  /** Not secret, readable by the frontend: only says "someone is signed in". */
  signedIn: 'signed_in',
} as const;

const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' };

export const COOKIE_OPTIONS = {
  access: { ...base, path: '/' },
  refresh: { ...base, sameSite: 'strict', path: '/api/auth' },
  mfa: { ...base, path: '/api/auth' },
  trustedDevice: { ...base, path: '/api/auth' },
  oauth: { ...base, path: '/api/auth/oauth' },
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
  res.cookie(COOKIES.signedIn, '1', { ...COOKIE_OPTIONS.signedIn, maxAge: refreshMaxAge });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(COOKIES.access, COOKIE_OPTIONS.access);
  res.clearCookie(COOKIES.refresh, COOKIE_OPTIONS.refresh);
  res.clearCookie(COOKIES.signedIn, COOKIE_OPTIONS.signedIn);
}
