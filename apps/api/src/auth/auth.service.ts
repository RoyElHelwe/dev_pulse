import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionTokens } from './cookies';
import { hashPassword, verifyPassword } from './crypto/password';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PUBLIC_USER_INCLUDE, type PublicUser, toPublicUser } from './public-user';
import { type ClientInfo, TokensService } from './tokens.service';
import { VerificationService } from './verification.service';

/** Result of a sign-in attempt. */
export type SignInResult =
  | { status: 'signed-in'; user: PublicUser; tokens: SessionTokens }
  | { status: 'verification-required'; user: PublicUser };

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password (no way to guess which emails have accounts).
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly verification: VerificationService,
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

  async login(dto: LoginDto, client: ClientInfo): Promise<SignInResult> {
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
    return this.startSession(publicUser, client);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: PUBLIC_USER_INCLUDE });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Account not found.' });
    return toPublicUser(user);
  }

  /** Creates the device session, unless the email must be verified first. */
  async startSession(user: PublicUser, client: ClientInfo): Promise<SignInResult> {
    if (this.config.requireEmailVerification && !user.emailVerified) {
      return { status: 'verification-required', user };
    }
    return { status: 'signed-in', user, tokens: await this.tokens.createSession(user.id, client) };
  }
}
