import { Injectable } from '@nestjs/common';
import type { Invitation, Role } from '@prisma/client';
import { randomToken, sha256 } from '../auth/crypto/secrets';
import { FormError } from '../common/form-error';
import { AppConfig } from '../config/app-config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomCharacter } from '../workspace/characters';
import { DesksService } from '../workspace/desks.service';
import { CAN_MANAGE, MembershipService } from '../workspace/membership.service';

const VALID_DAYS = 7;
const MAX_PENDING = 50;

/**
 * Invitations to join an office. The link only works for the invited email
 * address, once, for 7 days; only its hash is stored.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly desks: DesksService,
  ) {}

  async create(userId: string, email: string, role: Role) {
    const me = await this.membership.require(userId, CAN_MANAGE);
    if (role === 'ADMIN' && me.role !== 'OWNER') {
      throw new FormError('NOT_ALLOWED', 'Only the organiser can invite admins.', 'role');
    }
    const existing = await this.prisma.user.findUnique({ where: { email }, include: { membership: true } });
    if (existing?.membership?.workspaceId === me.workspaceId) {
      throw new FormError('ALREADY_MEMBER', 'This person is already in your office.', 'email');
    }
    const pending = await this.prisma.invitation.count({ where: { workspaceId: me.workspaceId, status: 'PENDING' } });
    if (pending >= MAX_PENDING) throw new FormError('TOO_MANY', 'Too many pending invitations. Revoke some first.');

    // A new invitation to the same email replaces the old one.
    await this.prisma.invitation.updateMany({
      where: { workspaceId: me.workspaceId, email, status: 'PENDING' },
      data: { status: 'REVOKED', answeredAt: new Date() },
    });
    const token = randomToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId: me.workspaceId,
        email,
        role,
        tokenHash: sha256(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + VALID_DAYS * 86400 * 1000),
      },
      include: { invitedBy: true },
    });
    const link = await this.sendEmail(invitation, token, me.workspace.name, invitation.invitedBy.displayName);
    return { invitation: this.summary(invitation), link };
  }

  /** Pending invitations of my office. */
  async list(userId: string) {
    const me = await this.membership.require(userId, CAN_MANAGE);
    const rows = await this.prisma.invitation.findMany({
      where: { workspaceId: me.workspaceId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.summary(r));
  }

  /** New link (the old one stops working) and a new email. */
  async resend(userId: string, id: string) {
    const me = await this.membership.require(userId, CAN_MANAGE);
    const row = await this.prisma.invitation.findFirst({ where: { id, workspaceId: me.workspaceId, status: 'PENDING' } });
    if (!row) throw new FormError('NOT_FOUND', 'This invitation no longer exists.');
    const token = randomToken();
    const invitation = await this.prisma.invitation.update({
      where: { id },
      data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + VALID_DAYS * 86400 * 1000) },
    });
    const sender = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const link = await this.sendEmail(invitation, token, me.workspace.name, sender.displayName);
    return { invitation: this.summary(invitation), link };
  }

  async revoke(userId: string, id: string) {
    const me = await this.membership.require(userId, CAN_MANAGE);
    await this.prisma.invitation.updateMany({
      where: { id, workspaceId: me.workspaceId, status: 'PENDING' },
      data: { status: 'REVOKED', answeredAt: new Date() },
    });
  }

  /** What the invitation page shows before accepting (anyone with the link). */
  async peek(token: string) {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { workspace: true, invitedBy: true },
    });
    if (!row) throw new FormError('INVALID_INVITATION', 'This invitation link is not valid.');
    const accountExists = (await this.prisma.user.count({ where: { email: row.email } })) > 0;
    return {
      workspaceName: row.workspace.name,
      invitedBy: row.invitedBy.displayName,
      email: row.email,
      role: row.role,
      status: this.status(row),
      expiresAt: row.expiresAt,
      accountExists,
    };
  }

  /** Joins the office: must be signed in with the invited email and not in another office. */
  async accept(userId: string, token: string, character?: string) {
    const row = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || this.status(row) !== 'pending') {
      throw new FormError('INVALID_INVITATION', 'This invitation is no longer valid. Ask for a new one.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } });
    if (user.email !== row.email) {
      throw new FormError('WRONG_ACCOUNT', `This invitation is for ${row.email}. You are signed in as ${user.email}.`);
    }
    if (user.membership) {
      throw new FormError(
        'ALREADY_IN_WORKSPACE',
        user.membership.workspaceId === row.workspaceId
          ? 'You are already in this office.'
          : 'You already belong to another office. Leave it first to join this one.',
      );
    }
    // Both writes or none; and only one acceptance can win.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', answeredAt: new Date() },
      });
      if (count !== 1) throw new FormError('INVALID_INVITATION', 'This invitation was already used.');
      await tx.workspaceMember.create({
        data: { userId, workspaceId: row.workspaceId, role: row.role, character: character ?? randomCharacter() },
      });
    });
    await this.desks.sync(row.workspaceId);
  }

  async decline(token: string) {
    await this.prisma.invitation.updateMany({
      where: { tokenHash: sha256(token), status: 'PENDING' },
      data: { status: 'DECLINED', answeredAt: new Date() },
    });
  }

  private status(row: Invitation): 'pending' | 'expired' | 'accepted' | 'declined' | 'revoked' {
    if (row.status === 'PENDING') return row.expiresAt > new Date() ? 'pending' : 'expired';
    return row.status.toLowerCase() as 'accepted' | 'declined' | 'revoked';
  }

  private summary(row: Invitation) {
    return { id: row.id, email: row.email, role: row.role, createdAt: row.createdAt, expiresAt: row.expiresAt, expired: row.expiresAt < new Date() };
  }

  private async sendEmail(invitation: Invitation, token: string, workspaceName: string, inviterName: string) {
    const link = `${this.config.appUrl}/invite/${token}`;
    await this.mail.send(invitation.email, {
      subject: `${inviterName} invited you to ${workspaceName}`,
      lines: [
        `Hi,`,
        `${inviterName} invited you to join ${workspaceName} on Dev Pulse: a virtual office where your team works, meets and talks.`,
      ],
      action: { label: `Join ${workspaceName}`, url: link },
      footer: `The invitation works for ${VALID_DAYS} days and only with this email address.`,
    });
    return link;
  }
}
