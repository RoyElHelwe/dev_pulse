/** The signed-in user, as returned by GET /api/auth/me. */
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  providers: string[];
  createdAt: string;
}

/** Result of sign-in / sign-up / 2FA calls. */
export type SignInResponse =
  | { status: 'signed-in'; user: User }
  | { status: 'verification-required'; user: User }
  | { status: 'two-factor-required' };
