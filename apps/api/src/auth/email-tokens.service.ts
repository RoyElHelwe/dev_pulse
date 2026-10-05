import { Injectable } from '@nestjs/common';
import type { AuthTokenType } from '@prisma/client';
import { FormError } from '../common/form-error';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from './crypto/secrets';

const LIFETIME_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 24 * 3600 * 1000,
  RESET_PASSWORD: 3600 * 1000,
  CLOSE_SESSIONS: 15 * 60 * 1000,
};

/** One-time links sent by email. Only the hash is stored. */
@Injectable()
export class EmailTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token and cancels older unused ones of the same type. */
  async create(userId: string, type: AuthTokenType, bindingHash?: string): Promise<string> {
    const token = randomToken();
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
