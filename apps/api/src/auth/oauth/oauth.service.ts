import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppConfig, type OAuthProvider } from '../../config/app-config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, type SignInResult } from '../auth.service';
import { randomToken } from '../crypto/secrets';
import { PUBLIC_USER_INCLUDE, toPublicUser } from '../public-user';
import { type ClientInfo, TokensService } from '../tokens.service';
import { type OAuthProfile, PROVIDER_ORDER, PROVIDERS } from './providers';

/** Shown on the sign-in page as ?error=<code>. */
export class OAuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

interface StatePayload {
  state: string;
  verifier: string;
  provider: OAuthProvider;
  redirect: string;
}

const STATE_SECONDS = 10 * 60;

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  /** Providers that have credentials in .env (the sign-in page shows only these). */
  available() {
    return PROVIDER_ORDER.filter((id) => this.config.oauth[id])
      .map((id) => ({ id, label: PROVIDERS[id].label }));
  }

  /** Step 1: where to send the browser, plus a signed cookie to check on the way back. */
  start(provider: OAuthProvider, redirect: string) {
    const client = this.config.oauth[provider];
    if (!client) throw new OAuthError('oauth_unavailable');
    const spec = PROVIDERS[provider];
    const state = randomToken(24);
    const verifier = randomToken(32);
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: this.callbackUrl(provider),
      response_type: 'code',
      scope: spec.scope,
      state,
    });
    if (spec.pkce) {
      params.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
      params.set('code_challenge_method', 'S256');
    }
    if (provider === 'google') params.set('prompt', 'select_account');
    const cookie = this.tokens.signPurposeToken('oauth', { state, verifier, provider, redirect }, STATE_SECONDS);
    return { url: `${spec.authorizeUrl}?${params}`, cookie, maxAgeMs: STATE_SECONDS * 1000 };
  }

  /** Step 2: the provider sent the browser back with ?code&state. */
  async finish(
    provider: OAuthProvider,
    query: { code?: string; state?: string; error?: string },
    stateCookie: string | undefined,
    client: ClientInfo,
    trustedDevice: string | undefined,
  ): Promise<{ result: SignInResult; redirect: string }> {
    if (query.error) throw new OAuthError('oauth_denied');
    const saved = this.tokens.verifyPurposeToken<StatePayload & Record<string, unknown>>('oauth', stateCookie);
    if (!saved || saved.provider !== provider || !query.state || saved.state !== query.state || !query.code) {
      throw new OAuthError('oauth_state');
    }

    let profile: OAuthProfile;
    try {
      const accessToken = await this.exchangeCode(provider, query.code, saved.verifier);
      profile = await PROVIDERS[provider].fetchProfile(accessToken);
    } catch (error) {
      this.logger.warn(`${provider} sign-in failed: ${(error as Error).message}`);
      throw new OAuthError('oauth_failed');
    }

    const user = await this.findOrCreateUser(provider, profile);
    const result = await this.auth.startSession(toPublicUser(user), client, trustedDevice);
    return { result, redirect: saved.redirect };
  }

  private callbackUrl(provider: OAuthProvider) {
    return `${this.config.appUrl}/api/auth/oauth/${provider}/callback`;
  }

  private async exchangeCode(provider: OAuthProvider, code: string, verifier: string): Promise<string> {
    const client = this.config.oauth[provider]!;
    const spec = PROVIDERS[provider];
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl(provider),
      client_id: client.clientId,
      client_secret: client.clientSecret,
    });
    if (spec.pkce) body.set('code_verifier', verifier);
    const res = await fetch(spec.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { access_token?: string; error?: string };
    if (!res.ok || !json.access_token) throw new Error(`token exchange: ${json.error ?? res.status}`);
    return json.access_token;
  }

  /**
   * 1. Known Google/GitHub/42 account -> that user.
   * 2. Same verified email as an existing user -> link it to that user.
   * 3. Otherwise create a new user (no password).
   */
  private async findOrCreateUser(provider: OAuthProvider, profile: OAuthProfile) {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.id } },
      include: { user: { include: PUBLIC_USER_INCLUDE } },
    });
    if (linked) return linked.user;

    if (!profile.email) throw new OAuthError('oauth_email_missing');
    // Linking on an unverified email would let anyone take over an account.
    if (!profile.emailVerified) throw new OAuthError('oauth_email_unverified');
    const email = profile.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await this.prisma.oAuthAccount.create({ data: { provider, providerUserId: profile.id, userId: existing.id } });
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          avatarUrl: existing.avatarUrl ?? profile.avatarUrl,
        },
        include: PUBLIC_USER_INCLUDE,
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        displayName: profile.name.trim().slice(0, 50) || email.split('@')[0],
        avatarUrl: profile.avatarUrl,
        emailVerifiedAt: new Date(),
        oauthAccounts: { create: { provider, providerUserId: profile.id } },
      },
      include: PUBLIC_USER_INCLUDE,
    });
  }
}
