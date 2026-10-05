export type OAuthProvider = 'google' | 'github' | '42';

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

/**
 * All settings read from the environment, checked once at startup so a
 * missing or weak secret fails loudly instead of at the first sign-in.
 */
export class AppConfig {
  /** Public URL of the app, e.g. https://localhost:8443 (used in emails and OAuth). */
  readonly appUrl: string;
  readonly jwtSecret: string;
  readonly accessTokenTtlSeconds = 15 * 60;
  readonly refreshTokenTtlDays = 30;
  /** When true, people must click the email link before they can sign in. */
  readonly requireEmailVerification: boolean;
  readonly smtp: SmtpConfig | null;
  readonly emailFrom: string;
  readonly oauth: Partial<Record<OAuthProvider, OAuthClient>>;

  constructor(env: NodeJS.ProcessEnv) {
    this.appUrl = (env.APP_URL ?? 'https://localhost:8443').replace(/\/$/, '');

    const secret = env.JWT_SECRET ?? '';
    if (secret.length < 32 || secret.includes('change-me')) {
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
          port: Number(env.SMTP_PORT ?? 587),
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
