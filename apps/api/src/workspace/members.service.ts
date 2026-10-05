import { Injectable } from '@nestjs/common';
import { FormError } from '../common/form-error';
import { PrismaService } from '../prisma/prisma.service';
import { DesksService } from './desks.service';
import { MembershipService } from './membership.service';
import { WorkspaceEvents } from './workspace-events';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: WorkspaceEvents,
    private readonly desks: DesksService,
  ) {}

  async list(userId: string) {
    const me = await this.membership.require(userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: me.workspaceId },
      include: { user: { select: { displayName: true, email: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      character: m.character,
      deskId: m.deskId,
      joinedAt: m.joinedAt,
    }));
  }

  /** Owner only: make someone an admin (can invite and edit the office) or a member. */
  async changeRole(userId: string, targetId: string, role: 'ADMIN' | 'MEMBER') {
    const me = await this.membership.require(userId, ['OWNER']);
    const target = await this.target(me.workspaceId, targetId);
    if (target.role === 'OWNER') throw new FormError('OWNER_ROLE', "The organiser's role can't be changed.");
    await this.prisma.workspaceMember.update({ where: { userId: targetId }, data: { role } });
    this.events.emit({ type: 'member-updated', workspaceId: me.workspaceId, userId: targetId, role });
  }

  /** The owner removes someone, or anyone (except the owner) leaves. */
  async remove(userId: string, targetId: string) {
    const me = await this.membership.require(userId);
    const leaving = targetId === userId;
    if (!leaving && me.role !== 'OWNER') throw new FormError('NOT_ALLOWED', 'Only the organiser can remove people.');
    const target = await this.target(me.workspaceId, targetId);
    if (target.role === 'OWNER') {
      throw new FormError('OWNER_CANT_LEAVE', 'The organiser can’t leave. Delete the office instead.');
    }
    await this.prisma.workspaceMember.delete({ where: { userId: targetId } });
    this.events.emit({ type: 'member-removed', workspaceId: me.workspaceId, userId: targetId });
    await this.desks.sync(me.workspaceId);
  }

  private async target(workspaceId: string, userId: string) {
    const target = await this.prisma.workspaceMember.findUnique({ where: { userId } });
    if (!target || target.workspaceId !== workspaceId) throw new FormError('NOT_A_MEMBER', 'This person is not in your office.');
    return target;
  }
}
