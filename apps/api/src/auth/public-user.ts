import type { OAuthAccount, Role, TwoFactor, User, Workspace, WorkspaceMember } from '@prisma/client';

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
  /** The office this user belongs to, or null (then: onboarding or an invitation). */
  workspace: { id: string; name: string; role: Role } | null;
  createdAt: Date;
}

export const PUBLIC_USER_INCLUDE = {
  twoFactor: true,
  oauthAccounts: true,
  membership: { include: { workspace: true } },
} as const;

type UserWithRelations = User & {
  twoFactor: TwoFactor | null;
  oauthAccounts: OAuthAccount[];
  membership: (WorkspaceMember & { workspace: Workspace }) | null;
};

export function toPublicUser(user: UserWithRelations): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
    twoFactorEnabled: Boolean(user.twoFactor?.enabledAt),
    providers: user.oauthAccounts.map((a) => a.provider),
    workspace: user.membership
      ? { id: user.membership.workspace.id, name: user.membership.workspace.name, role: user.membership.role }
      : null,
    createdAt: user.createdAt,
  };
}
