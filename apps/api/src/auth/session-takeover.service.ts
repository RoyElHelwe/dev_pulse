/**
 * Single-device session takeover workflow service.
 * Implements account takeover protection via email links and browser-binding cookies when an account is active elsewhere.
 */
import { Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { FormError } from '../common/form-error';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './crypto/password';
import { randomToken, sha256 } from './crypto/secrets';
import { EmailTokensService } from './email-tokens.service';
import { type ClientInfo, TokensService } from './tokens.service';
import { describeUserAgent } from './user-agent';

/** Cooldown prevents email spam if a user repeatedly clicks the takeover button. */
const SESSION_TAKEOVER_COOLDOWN_MS = 60 * 1000;

/**
 * Service managing the email link workflow to close remote sessions when an account is active on another device.
 */
@Injectable()
export class SessionTakeoverService {
  private readonly logger = new Logger(SessionTakeoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly emailTokens: EmailTokensService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  /** Returns the masked address it was sent to, and a secret for this browser's cookie. */
  async requestLink(takeoverToken: string | undefined, client: ClientInfo) {
    const payload = this.tokens.verifyPurposeToken<{ sub: string }>('takeover', takeoverToken);
    const user = payload && (await this.prisma.user.findUnique({ where: { id: payload.sub } }));
    if (!user) throw new FormError('TAKEOVER_EXPIRED', 'This took too long. Please sign in again.');

    const last = await this.emailTokens.lastCreatedAt(user.id, 'CLOSE_SESSIONS');
    if (last && Date.now() - last.getTime() < SESSION_TAKEOVER_COOLDOWN_MS) {
      throw new FormError('TOO_SOON', 'We just sent you a link. Check your inbox, or wait a minute to ask again.');
    }

    // Generate browser binding token to ensure the email link can only be consumed without password by this browser.
    const binding = randomToken();
    const token = await this.emailTokens.create(user.id, 'CLOSE_SESSIONS', sha256(binding));
    await this.mail.send(user.email, {
      subject: 'Close your other Dev Pulse sessions',
      lines: [
        `Hi ${user.displayName},`,
        `Someone signed in to your account from ${describeUserAgent(client.userAgent)}${client.ip ? ` (IP ${client.ip})` : ''}, but your account is already open on another device.`,
        'Click the button to close every open session. Then sign in again on the device you want to use.',
      ],
      action: { label: 'Close all my sessions', url: `${this.config.appUrl}/close-sessions?token=${token}` },
      footer: "The link works once, for 15 minutes. If this wasn't you, someone knows your password: change it now.",
    });
    return { sentTo: maskEmail(user.email), binding };
  }

  async closeAll(token: string, binding: string | undefined, password: string | undefined, client: ClientInfo) {
    const row = await this.emailTokens.find(token, 'CLOSE_SESSIONS');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: row.userId } });

    // If opened in another browser (cookie binding missing/mismatched), require password verification.
    if (!sameHash(binding ? sha256(binding) : undefined, row.bindingHash)) {
      if (!user.passwordHash) {
        throw new FormError('SAME_BROWSER_REQUIRED', 'Open this link in the browser where you asked for it.');
      }
      if (!password) {
        throw new FormError(
          'PASSWORD_REQUIRED',
          'This link was opened in another browser. Enter your password to confirm.',
          'password',
        );
      }
      if (!(await verifyPassword(password, user.passwordHash))) {
        throw new FormError('WRONG_PASSWORD', 'Wrong password.', 'password');
      }
    }

    await this.emailTokens.markUsed(row.id);
    await this.tokens.revokeAllSessions(user.id, undefined, 'sessions_closed');
    this.logger.warn(`All sessions of user ${user.id} closed by email link from ${client.ip ?? 'unknown IP'}`);
    await this.mail.send(user.email, {
      subject: 'All your sessions were closed',
      lines: [
        `Hi ${user.displayName},`,
        `Every open session of your Dev Pulse account was just closed, from ${describeUserAgent(client.userAgent)}${client.ip ? ` (IP ${client.ip})` : ''}.`,
      ],
      footer: "If this wasn't you, change your password and turn on two-factor authentication.",
    });
  }
}

/** "r•••@example.com": shows where it went without revealing the full address. */
function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}•••@${domain}`;
}

function sameHash(a: string | undefined, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

