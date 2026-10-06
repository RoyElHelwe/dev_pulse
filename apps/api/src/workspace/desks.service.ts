import { Injectable, Logger } from '@nestjs/common';
import { FormError } from '../common/form-error';
import { numberedDesks } from '../office/layout/geometry';
import type { OfficeLayout } from '../office/layout/types';
import { PrismaService } from '../prisma/prisma.service';
import { CAN_MANAGE, MembershipService } from './membership.service';
import { WorkspaceEvents } from './workspace-events';

/** Who sits where: shown as name plates on the desks. */
export interface DeskOwner {
  deskId: string;
  userId: string;
  name: string;
  /** Their character: desks decorate themselves for their owner. */
  character: string;
}

/**
 * One desk per member. Everyone gets a free desk when they join (first come,
 * first served, in desk order). Desks follow the office: after an edit, people
 * keep their desk if it still exists, the others get a free one.
 */
@Injectable()
export class DesksService {
  private readonly logger = new Logger(DesksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: WorkspaceEvents,
  ) {}

  async list(workspaceId: string): Promise<DeskOwner[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, deskId: { not: null } },
      include: { user: { select: { displayName: true } } },
    });
    return members.map((m) => ({ deskId: m.deskId!, userId: m.userId, name: m.user.displayName, character: m.character }));
  }

  /** Gives every member a desk that exists (call after joins, removals and layout changes). */
  async sync(workspaceId: string, attempt = 0): Promise<void> {
    try {
      const changed = await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          include: { members: { orderBy: { joinedAt: 'asc' } } },
        });
        if (!workspace) return false;
        const deskIds = numberedDesks(workspace.layout as unknown as OfficeLayout).map((d) => d.desk.id);
        const exists = new Set(deskIds);
        const taken = new Set<string>();
        const homeless = [];
        for (const m of workspace.members) {
          if (m.deskId && exists.has(m.deskId) && !taken.has(m.deskId)) taken.add(m.deskId);
          else homeless.push(m);
        }
        const free = deskIds.filter((id) => !taken.has(id));
        const changes = homeless
          .map((m) => ({ userId: m.userId, from: m.deskId, to: free.shift() ?? null }))
          .filter((c) => c.from !== c.to);
        if (changes.length === 0) return false;
        // Free the old desks first: a desk belongs to one person at a time (unique index).
        for (const c of changes) if (c.from) await tx.workspaceMember.update({ where: { userId: c.userId }, data: { deskId: null } });
        for (const c of changes) if (c.to) await tx.workspaceMember.update({ where: { userId: c.userId }, data: { deskId: c.to } });
        return true;
      });
      if (changed) this.publish(workspaceId);
    } catch (error) {
      // Two joins at the same moment can pick the same desk: try again once.
      if (attempt < 2) return this.sync(workspaceId, attempt + 1);
      this.logger.warn(`desk sync failed for ${workspaceId}: ${String(error)}`);
    }
  }

  /** Owners and admins move someone to a desk; whoever sat there takes their old one. */
  async assign(userId: string, targetId: string, deskId: string | null) {
    const me = await this.membership.require(userId, CAN_MANAGE);
    const layout = me.workspace.layout as unknown as OfficeLayout;
    if (deskId && !numberedDesks(layout).some((d) => d.desk.id === deskId)) {
      throw new FormError('NO_SUCH_DESK', 'This desk no longer exists.', 'deskId');
    }
    await this.prisma.$transaction(async (tx) => {
      const target = await tx.workspaceMember.findUnique({ where: { userId: targetId } });
      if (!target || target.workspaceId !== me.workspaceId) {
        throw new FormError('NOT_A_MEMBER', 'This person is not in your office.');
      }
      if (target.deskId === deskId) return;
      const sitter = deskId ? await tx.workspaceMember.findFirst({ where: { workspaceId: me.workspaceId, deskId } }) : null;
      await tx.workspaceMember.update({ where: { userId: targetId }, data: { deskId: null } });
      if (sitter) await tx.workspaceMember.update({ where: { userId: sitter.userId }, data: { deskId: target.deskId } });
      await tx.workspaceMember.update({ where: { userId: targetId }, data: { deskId } });
    });
    await this.publish(me.workspaceId);
  }

  private async publish(workspaceId: string) {
    this.events.emit({ type: 'desks', workspaceId, desks: await this.list(workspaceId) });
  }
}
