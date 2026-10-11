/**
 * Password lifecycle and security management service.
 * Handles forgot password flows, token-based password reset, password changes, and immediate session invalidations.
 */
import { Injectable } from '@nestjs/common';
import { FormError } from '../common/form-error';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './crypto/password';
import type { ChangePasswordDto, ResetPasswordDto } from './dto/password.dto';
import { EmailTokensService } from './email-tokens.service';
import { TokensService } from './tokens.service';

/** Service managing password reset tokens, password modification, and associated session revocations. */
@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailTokensService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  /** Sends a reset link. Silently returns if user does not exist to prevent account enumeration. */
  async forgot(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = await this.emailTokens.create(user.id, 'RESET_PASSWORD');
    await this.mail.send(user.email, {
      subject: 'Reset your password',
      lines: [`Hi ${user.displayName},`, 'Someone asked to reset the password of your Dev Pulse account.'],
      action: { label: 'Choose a new password', url: `${this.config.appUrl}/reset-password?token=${token}` },
      footer: "The link works for 1 hour. If it wasn't you, ignore this email: your password stays the same.",
    });
  }

  /** Sets the new password and signs out every device. */
  async reset(dto: ResetPasswordDto) {
    const userId = await this.emailTokens.consume(dto.token, 'RESET_PASSWORD');
    const user = await this.prisma.user.update({
      where: { id: userId },
      // Following the emailed token proves inbox ownership, so also mark the email verified.
      data: { passwordHash: await hashPassword(dto.password), emailVerifiedAt: new Date() },
    });
    // Revoke all existing sessions to invalidate any unauthorized device after a password reset.
    await this.tokens.revokeAllSessions(userId, undefined, 'password_changed');
    await this.notifyChanged(user);
  }

  /** Changes (or, for Google/GitHub/42 accounts, sets) the password. Other devices are signed out. */
  async change(userId: string, sessionId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      const valid = dto.currentPassword && (await verifyPassword(dto.currentPassword, user.passwordHash));
      if (!valid) {
        throw new FormError('WRONG_PASSWORD', 'Your current password is not correct.', 'currentPassword');
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(dto.newPassword) } });
    // Revoke other device sessions while preserving the current active session.
    await this.tokens.revokeAllSessions(userId, sessionId, 'password_changed');
    await this.notifyChanged(user);
  }

  private notifyChanged(user: { email: string; displayName: string }) {
    return this.mail.send(user.email, {
      subject: 'Your password was changed',
      lines: [
        `Hi ${user.displayName},`,
        'The password of your Dev Pulse account was just changed, and other devices were signed out.',
      ],
      footer: "If this wasn't you, reset your password right away from the sign-in page.",
    });
  }
}

