import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthTokenType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from './crypto/secrets';

const LIFETIME_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 24 * 3600 * 1000,
  RESET_PASSWORD: 3600 * 1000,
};

/** One-time links sent by email. Only the hash is stored. */
@Injectable()
export class EmailTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token and cancels older unused ones of the same type. */
  async create(userId: string, type: AuthTokenType): Promise<string> {
    const token = randomToken();
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LIFETIME_MS[type]) },
      }),
    ]);
    return token;
  }

  /** Marks the token as used and returns its user, or throws if invalid. */
  async consume(token: string, type: AuthTokenType): Promise<string> {
    const { count } = await this.prisma.authToken.updateMany({
      where: { tokenHash: sha256(token), type, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    const row = count === 1 ? await this.prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } }) : null;
    if (!row) {
      throw new BadRequestException({
        code: 'INVALID_LINK',
        message: 'This link is invalid or has expired. Please ask for a new one.',
      });
    }
    return row.userId;
  }
}
