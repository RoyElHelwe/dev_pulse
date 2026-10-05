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
  | { status: 'two-factor-required' }
  /** Signed in correctly, but the account is in use on another device. */
  | { status: 'session-active'; device: ActiveDevice };

export interface ActiveDevice {
  name: string;
  lastActiveAt: string;
}

/** Why this browser was signed out (sent by the API, shown on the sign-in page). */
export type SignedOutReason =
  | 'signed_out'
  | 'sessions_closed'
  | 'signed_in_elsewhere'
  | 'password_changed'
  | 'security_alert'
  | 'expired';
