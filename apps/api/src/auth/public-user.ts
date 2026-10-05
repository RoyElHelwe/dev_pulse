import type { OAuthAccount, TwoFactor, User } from '@prisma/client';

/** The user as the frontend sees it: never the password hash or secrets. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  providers: string[];
  createdAt: Date;
}

export const PUBLIC_USER_INCLUDE = { twoFactor: true, oauthAccounts: true } as const;

export function toPublicUser(user: User & { twoFactor: TwoFactor | null; oauthAccounts: OAuthAccount[] }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
    twoFactorEnabled: Boolean(user.twoFactor?.enabledAt),
    providers: user.oauthAccounts.map((a) => a.provider),
    createdAt: user.createdAt,
  };
}
