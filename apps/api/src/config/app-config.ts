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
  /** Overrides APP_URL/api/auth/oauth/<provider>/callback, e.g. a public relay page (Google rejects IPs). */
  redirectUri?: string;
}

/** Outgoing SMTP mail server connection settings. */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

/** The blockchain behind PulseCoin and the kitchen shop (see docs/code/kitchen.md). */
export interface ChainConfig {
  /** JSON-RPC endpoint: the local Anvil container by default, or e.g. Avalanche Fuji. */
  rpcUrl: string;
  /** Private key of the account that deploys the contracts and pays the gas; null = derived from JWT_SECRET. */
  relayerKey: string | null;
  /** Time between two daily PulseCoin claims, set on-chain at startup (60 to test, 86400 normally). */
  dailyPeriodSeconds: number;
}

const MIN_JWT_SECRET_LENGTH = 32;
const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;
const DEFAULT_DAILY_PERIOD_S = 24 * 3600;
const MIN_DAILY_PERIOD_S = 10;
/** Same upper bound as PulseCoin.setDailyPeriod. */
const MAX_DAILY_PERIOD_S = 7 * 24 * 3600;
// 15-minute access token limits the blast radius of stolen tokens without requiring server-side revocation checks on every call.
const DEFAULT_ACCESS_TOKEN_TTL_S = 15 * 60;
// 30-day refresh token balances convenience with regular session lifecycle expiration.
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_SMTP_PORT = 587;

/**
 * Whether dev-only features (dev sign-in, dev:teleport) are active.
 * Gated by both DEV_LOGIN=true and NODE_ENV !== 'production' to prevent accidental exposure in production.
 */
export const isDevLoginEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env.DEV_LOGIN === 'true' && env.NODE_ENV !== 'production';

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
  readonly chain: ChainConfig;

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

    const client = (id?: string, secretValue?: string, redirectUri?: string) =>
      id && secretValue
        ? { clientId: id, clientSecret: secretValue, redirectUri: redirectUri || undefined }
        : undefined;
    this.oauth = {
      google: client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI),
      github: client(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
      '42': client(env.FORTYTWO_CLIENT_ID, env.FORTYTWO_CLIENT_SECRET),
    };

    const relayerKey = env.CHAIN_RELAYER_KEY || null;
    if (relayerKey && !PRIVATE_KEY.test(relayerKey))
      throw new Error('CHAIN_RELAYER_KEY must be a 0x-prefixed 32-byte hex private key.');
    const period = env.CHAIN_DAILY_PERIOD_SECONDS
      ? Number(env.CHAIN_DAILY_PERIOD_SECONDS)
      : DEFAULT_DAILY_PERIOD_S;
    if (!Number.isInteger(period) || period < MIN_DAILY_PERIOD_S || period > MAX_DAILY_PERIOD_S) {
      throw new Error(
        `CHAIN_DAILY_PERIOD_SECONDS must be a whole number of seconds between ${MIN_DAILY_PERIOD_S} and ${MAX_DAILY_PERIOD_S}.`,
      );
    }
    this.chain = {
      rpcUrl: env.CHAIN_RPC_URL || 'http://chain:8545',
      relayerKey,
      dailyPeriodSeconds: period,
    };
  }
}
