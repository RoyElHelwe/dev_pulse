import { Injectable, NotFoundException } from '@nestjs/common';
import { FormError } from '../common/form-error';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionTokens } from './cookies';
import { hashPassword, verifyPassword } from './crypto/password';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PUBLIC_USER_INCLUDE, type PublicUser, toPublicUser } from './public-user';
import { type ClientInfo, TokensService } from './tokens.service';
import { describeUserAgent } from './user-agent';
import { TwoFactorService } from './two-factor.service';
import { VerificationService } from './verification.service';

/** Result of a sign-in attempt. */
export type SignInResult =
  | { status: 'signed-in'; user: PublicUser; tokens: SessionTokens }
  | { status: 'verification-required'; user: PublicUser }
  | { status: 'two-factor-required'; mfaToken: string }
  | { status: 'session-active'; takeoverToken: string; device: { name: string; lastActiveAt: Date } };

/** How long the user has to type the 2FA code after the password step. */
const MFA_STEP_SECONDS = 5 * 60;

/** How long the "close the other session" button keeps working after signing in. */
export const TAKEOVER_SECONDS = 10 * 60;

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password (no way to guess which emails have accounts).
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly verification: VerificationService,
    private readonly twoFactor: TwoFactorService,
    private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<SignInResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new FormError('EMAIL_TAKEN', 'An account with this email already exists.', 'email');
    }
    const user = await this.prisma.user.create({
      data: { email: dto.email, displayName: dto.displayName, passwordHash: await hashPassword(dto.password) },
      include: PUBLIC_USER_INCLUDE,
    });
    await this.verification.sendVerificationEmail(user);
    return this.startSession(toPublicUser(user), client);
  }

  async login(dto: LoginDto, client: ClientInfo, trustedDevice?: string): Promise<SignInResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: PUBLIC_USER_INCLUDE });
    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !user.passwordHash || !valid) {
      throw new FormError('INVALID_CREDENTIALS', 'Wrong email or password.');
    }
    const publicUser = toPublicUser(user);
    if (this.config.requireEmailVerification && !publicUser.emailVerified) {
      throw new FormError('EMAIL_NOT_VERIFIED', 'Please verify your email first. Check your inbox.');
    }
    return this.startSession(publicUser, client, trustedDevice);
  }

  /** Second step: the code from the authenticator app (or a backup code). */
  async completeTwoFactor(mfaToken: string | undefined, code: string, client: ClientInfo): Promise<SignInResult> {
    const payload = this.tokens.verifyPurposeToken<{ sub: string }>('mfa', mfaToken);
    if (!payload) {
      throw new FormError('MFA_EXPIRED', 'This sign-in expired. Please start again.');
    }
    await this.twoFactor.verifyCode(payload.sub, code);
    return this.openSession(await this.me(payload.sub), client);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: PUBLIC_USER_INCLUDE });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Account not found.' });
    return toPublicUser(user);
  }

  /**
   * Creates the device session, unless the email must be verified first, a
   * 2FA code is needed (skipped on a browser the user chose to trust) or the
   * account is in use on another device.
   */
  async startSession(user: PublicUser, client: ClientInfo, trustedDevice?: string): Promise<SignInResult> {
    if (this.config.requireEmailVerification && !user.emailVerified) {
      return { status: 'verification-required', user };
    }
    if (user.twoFactorEnabled && !(await this.twoFactor.isTrustedDevice(user.id, trustedDevice))) {
      const mfaToken = this.tokens.signPurposeToken('mfa', { sub: user.id }, MFA_STEP_SECONDS);
      return { status: 'two-factor-required', mfaToken };
    }
    return this.openSession(user, client);
  }

  /**
   * One account = one device at a time. Called only once the user has fully
   * proven who they are (password or OAuth, plus 2FA when it's on).
   *
   * - Another device used it in the last 20 minutes: refuse, and hand this
   *   browser a short-lived takeover token so it can ask for the email link.
   * - Otherwise: close any idle leftover sessions, then sign in here.
   */
  private async openSession(user: PublicUser, client: ClientInfo): Promise<SignInResult> {
    const active = await this.tokens.findActiveSession(user.id, client.refreshToken);
    if (active) {
      const takeoverToken = this.tokens.signPurposeToken(
        'takeover',
        { sub: user.id, ua: client.userAgent?.slice(0, 300), ip: client.ip },
        TAKEOVER_SECONDS,
      );
      return {
        status: 'session-active',
        takeoverToken,
        device: { name: describeUserAgent(active.userAgent), lastActiveAt: active.createdAt },
      };
    }
    await this.tokens.revokeAllSessions(user.id, undefined, 'signed_in_elsewhere');
    return { status: 'signed-in', user, tokens: await this.tokens.createSession(user.id, client) };
  }
}
