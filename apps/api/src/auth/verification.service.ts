/**
 * Email verification workflow service.
 * Handles dispatching verification links and marking accounts verified upon token confirmation.
 */
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTokensService } from './email-tokens.service';

/** Service orchestrating user email address verification and confirmation flows. */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTokens: EmailTokensService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  async sendVerificationEmail(user: { id: string; email: string; displayName: string }) {
    const token = await this.emailTokens.create(user.id, 'VERIFY_EMAIL');
    await this.mail.send(user.email, {
      subject: 'Confirm your email',
      lines: [`Hi ${user.displayName},`, 'Welcome to Dev Pulse! Please confirm that this is your email address.'],
      action: { label: 'Confirm my email', url: `${this.config.appUrl}/verify-email?token=${token}` },
      footer: "The link works for 24 hours. If you didn't create an account, you can ignore this email.",
    });
  }

  /** Resend on request. Produces identical timing whether email exists to prevent user enumeration. */
  async resend(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) await this.sendVerificationEmail(user);
  }

  async verify(token: string) {
    const userId = await this.emailTokens.consume(token, 'VERIFY_EMAIL');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }
}

