import type { OAuthProvider } from '../../config/app-config';

/** What we keep from a Google / GitHub / 42 profile. */
export interface OAuthProfile {
  id: string;
  email: string | null;
  /** Only verified emails may be linked to an existing account. */
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

interface ProviderSpec {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Proof Key for Code Exchange: protects the code if it leaks. */
  pkce: boolean;
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'dev-pulse',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json() as Promise<T>;
}

export const PROVIDERS: Record<OAuthProvider, ProviderSpec> = {
  google: {
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    pkce: true,
    async fetchProfile(token) {
      const p = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string }>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        token,
      );
      return {
        id: p.sub,
        email: p.email ?? null,
        emailVerified: p.email_verified === true,
        name: p.name || p.email?.split('@')[0] || 'Google user',
        avatarUrl: p.picture ?? null,
      };
    },
  },
  github: {
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    pkce: false,
    async fetchProfile(token) {
      const user = await getJson<{ id: number; login: string; name: string | null; avatar_url: string }>(
        'https://api.github.com/user',
        token,
      );
      // The public profile email can be empty: ask for the primary verified one.
      const emails = await getJson<Array<{ email: string; primary: boolean; verified: boolean }>>(
        'https://api.github.com/user/emails',
        token,
      );
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      return {
        id: String(user.id),
        email: primary?.email ?? null,
        emailVerified: Boolean(primary),
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
      };
    },
  },
  '42': {
    label: '42',
    authorizeUrl: 'https://api.intra.42.fr/oauth/authorize',
    tokenUrl: 'https://api.intra.42.fr/oauth/token',
    scope: 'public',
    pkce: false,
    async fetchProfile(token) {
      const me = await getJson<{ id: number; email: string; login: string; displayname?: string; image?: { link?: string } }>(
        'https://api.intra.42.fr/v2/me',
        token,
      );
      // 42 accounts are created by the school with the student's email.
      return {
        id: String(me.id),
        email: me.email ?? null,
        emailVerified: Boolean(me.email),
        name: me.displayname || me.login,
        avatarUrl: me.image?.link ?? null,
      };
    },
  },
};

/** Display order of the sign-in buttons. */
export const PROVIDER_ORDER: OAuthProvider[] = ['google', 'github', '42'];

export function isProvider(value: string): value is OAuthProvider {
  return value in PROVIDERS;
}
