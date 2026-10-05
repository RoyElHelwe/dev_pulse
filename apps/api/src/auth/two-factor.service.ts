import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './crypto/password';
import {
  decrypt,
  deriveKey,
  encrypt,
  generateBackupCodes,
  normalizeBackupCode,
  sha256,
} from './crypto/secrets';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './crypto/totp';
import { TokensService } from './tokens.service';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const TRUST_DAYS = 30;

@Injectable()
export class TwoFactorService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    config: AppConfig,
  ) {
    this.key = deriveKey(config.jwtSecret, 'totp-secret');
  }

  /** Step 1: create a secret and the QR code link. 2FA is not on yet. */
  async setup(userId: string, password?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { twoFactor: true } });
    if (user.twoFactor?.enabledAt) {
      throw new ConflictException({ code: 'ALREADY_ENABLED', message: 'Two-factor authentication is already on.' });
    }
    if (user.passwordHash && !(password && (await verifyPassword(password, user.passwordHash)))) {
      throw new UnauthorizedException({ code: 'WRONG_PASSWORD', field: 'password', message: 'Wrong password.' });
    }
    const secret = generateTotpSecret();
    const data = { secret: encrypt(secret, this.key), enabledAt: null, backupCodes: [], lastUsedStep: null, failedAttempts: 0, lockedUntil: null };
    await this.prisma.twoFactor.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return { secret, otpauthUrl: otpauthUrl('Dev Pulse', user.email, secret) };
  }

  /** Step 2: the first code from the app turns 2FA on. Returns the backup codes (shown once). */
  async enable(userId: string, sessionId: string, code: string) {
    const record = await this.prisma.twoFactor.findUnique({ where: { userId } });
    if (!record || record.enabledAt) {
      throw new BadRequestException({ code: 'NO_PENDING_SETUP', message: 'Start the setup again.' });
    }
    const step = verifyTotp(decrypt(record.secret, this.key), code.trim());
    if (step === null) {
      throw new BadRequestException({ code: 'INVALID_CODE', field: 'code', message: 'That code is not right. Try the newest one.' });
    }
    const backupCodes = generateBackupCodes();
    await this.prisma.twoFactor.update({
      where: { userId },
      data: { enabledAt: new Date(), lastUsedStep: step, backupCodes: backupCodes.map((c) => sha256(normalizeBackupCode(c))) },
    });
    // Other devices signed in without 2FA: sign them out.
    await this.tokens.revokeAllSessions(userId, sessionId);
    return { backupCodes };
  }

  async disable(userId: string, code: string) {
    await this.verifyCode(userId, code);
    await this.prisma.twoFactor.delete({ where: { userId } });
  }

  async regenerateBackupCodes(userId: string, code: string) {
    await this.verifyCode(userId, code);
    const backupCodes = generateBackupCodes();
    await this.prisma.twoFactor.update({
      where: { userId },
      data: { backupCodes: backupCodes.map((c) => sha256(normalizeBackupCode(c))) },
    });
    return { backupCodes };
  }

  isEnabled(userId: string) {
    return this.prisma.twoFactor.count({ where: { userId, enabledAt: { not: null } } }).then((n) => n > 0);
  }

  /**
   * Checks an app code or a backup code. Each app code works once, each
   * backup code works once, and too many wrong codes lock 2FA for 5 minutes.
   */
  async verifyCode(userId: string, input: string): Promise<void> {
    const record = await this.prisma.twoFactor.findUnique({ where: { userId } });
    if (!record?.enabledAt) {
      throw new BadRequestException({ code: 'NOT_ENABLED', message: 'Two-factor authentication is not on.' });
    }
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new HttpException(
        { code: 'TOO_MANY_ATTEMPTS', message: 'Too many wrong codes. Try again in a few minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = input.trim();
    if (/^\d{6}$/.test(code)) {
      const step = verifyTotp(decrypt(record.secret, this.key), code);
      if (step !== null && step > (record.lastUsedStep ?? -1)) {
        await this.prisma.twoFactor.update({ where: { userId }, data: { lastUsedStep: step, failedAttempts: 0 } });
        return;
      }
    } else {
      const hash = sha256(normalizeBackupCode(code));
      if (record.backupCodes.includes(hash)) {
        await this.prisma.twoFactor.update({
          where: { userId },
          data: { backupCodes: record.backupCodes.filter((c) => c !== hash), failedAttempts: 0 },
        });
        return;
      }
    }

    const failedAttempts = record.failedAttempts + 1;
    const locked = failedAttempts >= MAX_ATTEMPTS;
    await this.prisma.twoFactor.update({
      where: { userId },
      data: locked ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedAttempts },
    });
    throw new BadRequestException({ code: 'INVALID_CODE', field: 'code', message: 'That code is not right.' });
  }

  // ---- "trust this device" -------------------------------------------------

  async trustedDeviceToken(userId: string) {
    const record = await this.prisma.twoFactor.findUniqueOrThrow({ where: { userId } });
    return this.tokens.signPurposeToken('trust', { sub: userId, v: record.enabledAt!.getTime() }, TRUST_DAYS * 86400);
  }

  /** True if this browser passed 2FA for this user since 2FA was last turned on. */
  async isTrustedDevice(userId: string, token: string | undefined) {
    const payload = this.tokens.verifyPurposeToken<{ sub: string; v: number }>('trust', token);
    if (!payload || payload.sub !== userId) return false;
    const record = await this.prisma.twoFactor.findUnique({ where: { userId } });
    return record?.enabledAt?.getTime() === payload.v;
  }

  static readonly trustMaxAgeMs = TRUST_DAYS * 86400 * 1000;
}
