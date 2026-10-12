/**
 * Application configuration loaded and validated from environment variables.
 * Enforces security invariants on secrets and defines token time-to-live settings.
 */
/** Supported third-party OAuth 2.0 identity providers. */
export type OAuthProvider = 'google' | 'github' | '42';

/** Credentials required to integrate an external OAuth 2.0 provider. */
export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/** Outgoing SMTP mail server connection settings. */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

const MIN_JWT_SECRET_LENGTH = 32;
// 15-minute access token limits the blast radius of stolen tokens without requiring server-side revocation checks on every call.
const DEFAULT_ACCESS_TOKEN_TTL_S = 15 * 60;
// 30-day refresh token balances convenience with regular session lifecycle expiration.
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_SMTP_PORT = 587;

/**
 * Whether dev-only features (dev sign-in, dev:teleport) are active.
 * Gated by both DEV_LOGIN=true and NODE_ENV !== 'production' to prevent accidental exposure in production.
 */
export const isDevLoginEnabled = (env: NodeJS.ProcessEnv): boolean => env.DEV_LOGIN === 'true' && env.NODE_ENV !== 'production';

/**
 * Validated environment configuration parsed once at process startup.
 * Fails fast on missing or weak secrets before any requests are accepted.
 */
export class AppConfig {
  /** Public URL of the app, e.g. https://localhost:8443 (used in emails and OAuth). */
  readonly appUrl: string;
  readonly jwtSecret: string;
  readonly accessTokenTtlSeconds = DEFAULT_ACCESS_TOKEN_TTL_S;
  readonly refreshTokenTtlDays = DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  /** When true, people must click the email link before they can sign in. */
  readonly requireEmailVerification: boolean;
  readonly smtp: SmtpConfig | null;
  readonly emailFrom: string;
  readonly oauth: Partial<Record<OAuthProvider, OAuthClient>>;

  constructor(env: NodeJS.ProcessEnv) {
    this.appUrl = (env.APP_URL ?? 'https://localhost:8443').replace(/\/$/, '');

    const secret = env.JWT_SECRET ?? '';
    // Require >= 32 characters (256 bits) to prevent brute-force attacks against HMAC-SHA256 signatures.
    if (secret.length < MIN_JWT_SECRET_LENGTH || secret.includes('change-me')) {
      throw new Error(
        'JWT_SECRET must be a random string of at least 32 characters. ' +
          'Generate one with: openssl rand -base64 48',
      );
    }
    this.jwtSecret = secret;

    this.requireEmailVerification = env.REQUIRE_EMAIL_VERIFICATION === 'true';

    this.smtp = env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT ?? DEFAULT_SMTP_PORT),
          secure: env.SMTP_SECURE === 'true',
          user: env.SMTP_USER || undefined,
          pass: env.SMTP_PASS || undefined,
        }
      : null;
    this.emailFrom = env.EMAIL_FROM || 'Dev Pulse <no-reply@devpulse.local>';

    const client = (id?: string, secretValue?: string) =>
      id && secretValue ? { clientId: id, clientSecret: secretValue } : undefined;
    this.oauth = {
      google: client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
      github: client(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
      '42': client(env.FORTYTWO_CLIENT_ID, env.FORTYTWO_CLIENT_SECRET),
    };
  }
}

