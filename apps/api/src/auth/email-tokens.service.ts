/**
 * Email action token lifecycle management.
 * Generates, hashes, checks, and consumes single-use tokens for email verification, password reset, and session takeover.
 */
import { Injectable } from '@nestjs/common';
import type { AuthTokenType } from '@prisma/client';
import { FormError } from '../common/form-error';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from './crypto/secrets';

// 24 hours gives sufficient time for email delivery and account onboarding.
const VERIFY_EMAIL_TTL_MS = 24 * 3600 * 1000;
// 1 hour limits the exposure window if an email reset link is intercepted.
const RESET_PASSWORD_TTL_MS = 3600 * 1000;
// 15 minutes enforces prompt completion during an urgent security takeover intervention.
const CLOSE_SESSIONS_TTL_MS = 15 * 60 * 1000;

const LIFETIME_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: VERIFY_EMAIL_TTL_MS,
  RESET_PASSWORD: RESET_PASSWORD_TTL_MS,
  CLOSE_SESSIONS: CLOSE_SESSIONS_TTL_MS,
};

/** Service managing cryptographically hashed, single-use action tokens sent via email links. */
@Injectable()
export class EmailTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token and cancels older unused ones of the same type. */
  async create(userId: string, type: AuthTokenType, bindingHash?: string): Promise<string> {
    const token = randomToken();
    // Invalidate any previously issued pending tokens of the same type to enforce single active link invariant.
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.authToken.create({
        data: { userId, type, bindingHash, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LIFETIME_MS[type]) },
      }),
    ]);
    return token;
  }

  /** When the last token of this type was sent to the user (for cooldowns). */
  async lastCreatedAt(userId: string, type: AuthTokenType) {
    const last = await this.prisma.authToken.findFirst({ where: { userId, type }, orderBy: { createdAt: 'desc' } });
    return last?.createdAt ?? null;
  }

  /** A valid, unused token, without using it up yet (extra checks come first). */
  async find(token: string, type: AuthTokenType) {
    const row = await this.prisma.authToken.findFirst({
      where: { tokenHash: sha256(token), type, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row) throw invalidLink();
    return row;
  }

  /** Uses the token up; only one request can win. */
  async markUsed(id: string) {
    const { count } = await this.prisma.authToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) throw invalidLink();
  }

  /** Marks the token as used and returns its user, or throws if invalid. */
  async consume(token: string, type: AuthTokenType): Promise<string> {
    const { count } = await this.prisma.authToken.updateMany({
      where: { tokenHash: sha256(token), type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    const row = count === 1 ? await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } }) : null;
    if (!row) throw invalidLink();
    return row.userId;
  }
}

function invalidLink() {
  return new FormError('INVALID_LINK', 'This link is invalid or has expired. Please ask for a new one.');
}

