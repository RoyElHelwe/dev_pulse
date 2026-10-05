import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FormError } from '../common/form-error';
import { validateLayout } from '../office/layout/validate';
import type { OfficeLayout } from '../office/layout/types';
import { findTemplate } from '../office/templates';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkspaceDto, UpdateLayoutDto } from './dto';
import { CAN_MANAGE, MembershipService } from './membership.service';
import { WorkspaceEvents } from './workspace-events';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: WorkspaceEvents,
  ) {}

  /** The organiser creates the office from a template and becomes its owner. */
  async create(userId: string, dto: CreateWorkspaceDto) {
    if (await this.membership.find(userId)) {
      throw new FormError('ALREADY_IN_WORKSPACE', 'You already belong to an office.');
    }
    const template = findTemplate(dto.templateId)!;
    await this.prisma.workspace.create({
      data: {
        name: dto.name,
        templateId: template.id,
        layout: template.build() as unknown as Prisma.InputJsonValue,
        members: { create: { userId, role: 'OWNER', character: dto.character } },
      },
    });
    return this.mine(userId);
  }

  /** Everything the office page needs. */
  async mine(userId: string) {
    const member = await this.membership.require(userId);
    const { workspace } = member;
    const memberCount = await this.prisma.workspaceMember.count({ where: { workspaceId: workspace.id } });
    return {
      id: workspace.id,
      name: workspace.name,
      templateId: workspace.templateId,
      layout: workspace.layout as unknown as OfficeLayout,
      layoutVersion: workspace.layoutVersion,
      role: member.role,
      character: member.character,
      memberCount,
    };
  }

  async rename(userId: string, name: string) {
    const member = await this.membership.require(userId, CAN_MANAGE);
    await this.prisma.workspace.update({ where: { id: member.workspaceId }, data: { name } });
    return this.mine(userId);
  }

  /** Deletes the office, its members and invitations (owner only; they must type the name). */
  async remove(userId: string, confirmName: string) {
    const member = await this.membership.require(userId, ['OWNER']);
    if (confirmName.trim() !== member.workspace.name) {
      throw new FormError('NAME_MISMATCH', 'Type the exact name of the office to confirm.', 'confirmName');
    }
    await this.prisma.workspace.delete({ where: { id: member.workspaceId } });
    this.events.emit({ type: 'deleted', workspaceId: member.workspaceId });
  }

  async setCharacter(userId: string, character: string) {
    const member = await this.membership.require(userId);
    await this.prisma.workspaceMember.update({ where: { userId }, data: { character } });
    this.events.emit({ type: 'member-updated', workspaceId: member.workspaceId, userId, character });
    return { character };
  }

  /**
   * Saves the office editor's changes: furniture and room names only, so the
   * walls and rooms of the template can't be broken. Refused if the office
   * no longer works (see validateLayout) or someone else saved in between.
   */
  async updateLayout(userId: string, dto: UpdateLayoutDto) {
    const member = await this.membership.require(userId, CAN_MANAGE);
    const current = member.workspace;
    if (dto.version !== current.layoutVersion) {
      throw new FormError('LAYOUT_CHANGED', 'Someone else saved the office meanwhile. Reload to see their changes.');
    }
    const ids = new Set(dto.furniture.map((f) => f.id));
    if (ids.size !== dto.furniture.length) throw new FormError('DUPLICATE_ID', 'Two pieces of furniture have the same id.');

    const stored = current.layout as unknown as OfficeLayout;
    const names = new Map(dto.rooms.map((r) => [r.id, r.name]));
    const layout: OfficeLayout = {
      ...stored,
      rooms: stored.rooms.map((room) => ({ ...room, name: names.get(room.id) ?? room.name })),
      furniture: dto.furniture.map(({ id, kind, x, y, w, h, rotation, color }) => ({
        id,
        kind,
        x: round(x),
        y: round(y),
        w: round(w),
        h: round(h),
        ...(rotation && { rotation }),
        ...(color !== undefined && { color }),
      })),
    };

    const problems = validateLayout(layout);
    if (problems.length > 0) {
      throw new FormError('LAYOUT_INVALID', problems[0].message, undefined, problems);
    }

    // Only one save can win: the version must still be the one the editor started from.
    const { count } = await this.prisma.workspace.updateMany({
      where: { id: current.id, layoutVersion: current.layoutVersion },
      data: { layout: layout as unknown as Prisma.InputJsonValue, layoutVersion: { increment: 1 } },
    });
    if (count !== 1) {
      throw new FormError('LAYOUT_CHANGED', 'Someone else saved the office meanwhile. Reload to see their changes.');
    }
    const version = current.layoutVersion + 1;
    this.events.emit({ type: 'layout', workspaceId: current.id, layout, version, by: userId });
    return { layout, version };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
