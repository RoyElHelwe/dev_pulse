import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../common/auth/auth-user';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionTokens } from './cookies';
import { randomToken, sha256 } from './crypto/secrets';

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

/** Short-lived signed tokens used during sign-in steps. */
type PurposeToken = 'mfa' | 'trust' | 'oauth';

/** A refresh token reused within this window is a race between tabs, not theft. */
const REUSE_GRACE_MS = 30_000;

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  // ---- access token (JWT) --------------------------------------------------

  signAccessToken(userId: string, sessionId: string): string {
    return this.jwt.sign(
      { sub: userId, sid: sessionId, typ: 'access' },
      { expiresIn: this.config.accessTokenTtlSeconds },
    );
  }

  /** Returns the user, or null if the token is missing, forged or expired. */
  verifyAccessToken(token: string): AuthUser | null {
    try {
      const payload = this.jwt.verify<{ sub: string; sid: string; typ: string }>(token);
      return payload.typ === 'access' ? { id: payload.sub, sessionId: payload.sid } : null;
    } catch {
      return null;
    }
  }

  // ---- purpose tokens (2FA step, trusted device, OAuth state) --------------

  signPurposeToken(typ: PurposeToken, data: Record<string, unknown>, expiresInSeconds: number): string {
    return this.jwt.sign({ ...data, typ }, { expiresIn: expiresInSeconds });
  }

  verifyPurposeToken<T extends Record<string, unknown>>(typ: PurposeToken, token: string | undefined): T | null {
    if (!token) return null;
    try {
      const payload = this.jwt.verify<T & { typ: string }>(token);
      return payload.typ === typ ? payload : null;
    } catch {
      return null;
    }
  }

  // ---- refresh tokens --------------------------------------------------------

  /** Starts a new device session: a new refresh-token family. */
  async createSession(userId: string, client: ClientInfo): Promise<SessionTokens> {
    const familyId = randomToken(16);
    const refreshToken = await this.storeRefreshToken(userId, familyId, client);
    return { accessToken: this.signAccessToken(userId, familyId), refreshToken };
  }

  /**
   * Exchanges a refresh token for a new pair. The old token is revoked; if a
   * revoked token is presented again later, someone copied it, so the whole
   * family (that device) is signed out.
   */
  async rotate(refreshToken: string | undefined, client: ClientInfo): Promise<SessionTokens & { userId: string }> {
    const invalid = (code: string) => new UnauthorizedException({ code, message: 'Please sign in again.' });
    if (!refreshToken) throw invalid('NO_REFRESH_TOKEN');

    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row) throw invalid('INVALID_REFRESH_TOKEN');

    if (row.revokedAt) {
      // Revoked without a replacement: signed out, or password changed.
      if (!row.replacedById) throw invalid('SESSION_ENDED');
      // Already exchanged: either two tabs refreshed at once, or a copy is being replayed.
      const raceBetweenTabs = Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS;
      if (!raceBetweenTabs) await this.revokeSession(row.userId, row.familyId);
      throw invalid('REFRESH_TOKEN_REUSED');
    }
    if (row.expiresAt.getTime() < Date.now()) throw invalid('REFRESH_TOKEN_EXPIRED');

    const newToken = randomToken();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Only one request can revoke the row: protects against double use.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count !== 1) return null;
      const next = await tx.refreshToken.create({
        data: this.refreshTokenData(row.userId, row.familyId, newToken, client),
      });
      await tx.refreshToken.update({ where: { id: row.id }, data: { replacedById: next.id } });
      return next;
    });
    if (!rotated) throw invalid('REFRESH_TOKEN_REUSED');

    return {
      userId: row.userId,
      accessToken: this.signAccessToken(row.userId, row.familyId),
      refreshToken: newToken,
    };
  }

  /** Signs out one device. */
  async revokeSession(userId: string, familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Signs out every device, optionally keeping the current one. */
  async revokeAllSessions(userId: string, exceptFamilyId?: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(exceptFamilyId && { familyId: { not: exceptFamilyId } }) },
      data: { revokedAt: new Date() },
    });
  }

  /** Signed-in devices: the newest live token of each family. */
  async listSessions(userId: string) {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    const families = await this.prisma.refreshToken.groupBy({
      by: ['familyId'],
      where: { familyId: { in: rows.map((r) => r.familyId) } },
      _min: { createdAt: true },
    });
    const startedAt = new Map(families.map((f) => [f.familyId, f._min.createdAt]));
    return rows.map((r) => ({
      id: r.familyId,
      userAgent: r.userAgent,
      ip: r.ip,
      signedInAt: startedAt.get(r.familyId) ?? r.createdAt,
      lastActiveAt: r.createdAt,
    }));
  }

  private async storeRefreshToken(userId: string, familyId: string, client: ClientInfo) {
    const token = randomToken();
    await this.prisma.refreshToken.create({ data: this.refreshTokenData(userId, familyId, token, client) });
    return token;
  }

  private refreshTokenData(userId: string, familyId: string, token: string, client: ClientInfo) {
    return {
      userId,
      familyId,
      tokenHash: sha256(token),
      userAgent: client.userAgent?.slice(0, 300),
      ip: client.ip,
      expiresAt: new Date(Date.now() + this.config.refreshTokenTtlDays * 24 * 3600 * 1000),
    };
  }
}
