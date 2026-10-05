import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionTokens } from './cookies';
import { hashPassword, verifyPassword } from './crypto/password';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PUBLIC_USER_INCLUDE, type PublicUser, toPublicUser } from './public-user';
import { type ClientInfo, TokensService } from './tokens.service';
import { TwoFactorService } from './two-factor.service';
import { VerificationService } from './verification.service';

/** Result of a sign-in attempt. */
export type SignInResult =
  | { status: 'signed-in'; user: PublicUser; tokens: SessionTokens }
  | { status: 'verification-required'; user: PublicUser }
  | { status: 'two-factor-required'; mfaToken: string };

/** How long the user has to type the 2FA code after the password step. */
const MFA_STEP_SECONDS = 5 * 60;

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
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        field: 'email',
        message: 'An account with this email already exists.',
      });
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
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' });
    }
    const publicUser = toPublicUser(user);
    if (this.config.requireEmailVerification && !publicUser.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first. Check your inbox.',
      });
    }
    return this.startSession(publicUser, client, trustedDevice);
  }

  /** Second step: the code from the authenticator app (or a backup code). */
  async completeTwoFactor(mfaToken: string | undefined, code: string, client: ClientInfo): Promise<SignInResult> {
    const payload = this.tokens.verifyPurposeToken<{ sub: string }>('mfa', mfaToken);
    if (!payload) {
      throw new UnauthorizedException({ code: 'MFA_EXPIRED', message: 'This sign-in expired. Please start again.' });
    }
    await this.twoFactor.verifyCode(payload.sub, code);
    const user = await this.me(payload.sub);
    return { status: 'signed-in', user, tokens: await this.tokens.createSession(user.id, client) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: PUBLIC_USER_INCLUDE });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Account not found.' });
    return toPublicUser(user);
  }

  /**
   * Creates the device session, unless the email must be verified first or a
   * 2FA code is needed (skipped on a browser the user chose to trust).
   */
  async startSession(user: PublicUser, client: ClientInfo, trustedDevice?: string): Promise<SignInResult> {
    if (this.config.requireEmailVerification && !user.emailVerified) {
      return { status: 'verification-required', user };
    }
    if (user.twoFactorEnabled && !(await this.twoFactor.isTrustedDevice(user.id, trustedDevice))) {
      const mfaToken = this.tokens.signPurposeToken('mfa', { sub: user.id }, MFA_STEP_SECONDS);
      return { status: 'two-factor-required', mfaToken };
    }
    return { status: 'signed-in', user, tokens: await this.tokens.createSession(user.id, client) };
  }
}
