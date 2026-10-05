// Small fetch wrapper for our NestJS API (same origin, through nginx).
// Tokens live in httpOnly cookies, so this code never sees them: the browser
// sends them automatically.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    /** Which form field the error is about, when the API says so. */
    readonly field: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Errors that mean "get a new access token and try again". */
const EXPIRED = new Set(['TOKEN_EXPIRED', 'NOT_AUTHENTICATED']);

export async function api<T = void>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
    });

  let res = await send();
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (EXPIRED.has(body.code) && (await refreshTokens())) res = await send();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  // Expected mistakes (wrong password, expired link...) come back as
  // 200 { error } so the browser console stays clean; see FormError in the API.
  if (data && typeof data === 'object' && 'error' in data && data.error?.code) {
    throw new ApiError(res.status, data.error.code, data.error.field, data.error.message);
  }
  return data as T;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  // NestJS validation errors come as an array of messages.
  const message = Array.isArray(body.message) ? body.message[0] : body.message;
  return new ApiError(res.status, body.code, body.field, message || friendlyStatus(res.status));
}

function friendlyStatus(status: number) {
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Something went wrong. Please try again.';
}

// ---- token refresh ------------------------------------------------------------

let refreshing: Promise<boolean> | null = null;

/**
 * Gets a new access token. Only one refresh runs at a time, even across
 * tabs (Web Locks), because each refresh token can only be used once.
 */
export function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const before = accessTokenExpiry();
    const run = async () => {
      // Another tab may have refreshed while we waited for the lock.
      if (accessTokenExpiry() !== before && isAccessTokenFresh()) return true;
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      return res.ok;
    };
    return navigator.locks ? navigator.locks.request('dev-pulse-refresh', run) : run();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** When the access token expires (ms), from the readable signed_in cookie. */
export function accessTokenExpiry(): number | null {
  const match = document.cookie.match(/(?:^|;\s*)signed_in=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function isSignedInCookieSet() {
  return accessTokenExpiry() !== null;
}

/** True if the access token is still valid for at least `marginMs`. */
export function isAccessTokenFresh(marginMs = 30_000) {
  const expiry = accessTokenExpiry();
  return expiry !== null && expiry - Date.now() > marginMs;
}
