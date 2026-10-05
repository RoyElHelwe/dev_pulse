import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FormError } from '../common/form-error';
import { validateLayout } from '../office/layout/validate';
import type { OfficeLayout } from '../office/layout/types';
import { numberedDesks } from '../office/layout/geometry';
import { findTemplate } from '../office/templates';
import { PrismaService } from '../prisma/prisma.service';
import { DesksService } from './desks.service';
import type { CreateWorkspaceDto, SwitchTemplateDto, UpdateLayoutDto, UpdateMeDto } from './dto';
import { CAN_MANAGE, MembershipService } from './membership.service';
import { WorkspaceEvents } from './workspace-events';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: WorkspaceEvents,
    private readonly desks: DesksService,
  ) {}

  /** The organiser creates the office from a template and becomes its owner. */
  async create(userId: string, dto: CreateWorkspaceDto) {
    if (await this.membership.find(userId)) {
      throw new FormError('ALREADY_IN_WORKSPACE', 'You already belong to an office.');
    }
    const template = findTemplate(dto.templateId)!;
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        templateId: template.id,
        layout: template.build(dto.teamSize, dto.name) as unknown as Prisma.InputJsonValue,
        members: { create: { userId, role: 'OWNER', character: dto.character } },
      },
    });
    await this.desks.sync(workspace.id);
    return this.mine(userId);
  }

  /** Everything the office page needs. */
  async mine(userId: string) {
    let member = await this.membership.require(userId);
    // No desk yet (offices created before desks existed, or a desk freed up since): try again.
    if (!member.deskId) {
      await this.desks.sync(member.workspaceId);
      member = await this.membership.require(userId);
    }
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
      status: member.status,
      deskId: member.deskId,
      desks: await this.desks.list(workspace.id),
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

  /**
   * Owner: move the whole office to another template (or back to the original
   * furniture of the same one). The generated office is made for `teamSize`, or
   * for the people already in it. Everyone gets the new office live; desks are
   * handed out again in joining order.
   */
  async switchTemplate(userId: string, dto: SwitchTemplateDto) {
    const member = await this.membership.require(userId, ['OWNER']);
    const current = member.workspace;
    if (dto.version !== current.layoutVersion) {
      throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
    }
    const template = findTemplate(dto.templateId)!;
    const people = await this.prisma.workspaceMember.count({ where: { workspaceId: current.id } });
    const teamSize = dto.teamSize ?? people;
    const layout = template.build(teamSize, current.name);
    const desks = numberedDesks(layout).length;
    if (people > desks) {
      const office = template.id === 'generated' ? `An office for ${teamSize}` : template.name;
      throw new FormError('TOO_SMALL', `${office} has ${desks} desks and your team has ${people} people.`, 'templateId');
    }
    const { count } = await this.prisma.workspace.updateMany({
      where: { id: current.id, layoutVersion: current.layoutVersion },
      data: { templateId: template.id, layout: layout as unknown as Prisma.InputJsonValue, layoutVersion: { increment: 1 } },
    });
    if (count !== 1) throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
    const version = current.layoutVersion + 1;
    this.events.emit({ type: 'layout', workspaceId: current.id, layout, version, by: userId });
    await this.desks.sync(current.id);
    return this.mine(userId);
  }

  /** Your character and status in the office (both shown to everyone, live). */
  async updateMe(userId: string, dto: UpdateMeDto) {
    const member = await this.membership.require(userId);
    const status = dto.status === undefined ? undefined : dto.status || null;
    const updated = await this.prisma.workspaceMember.update({
      where: { userId },
      data: { character: dto.character, status },
    });
    this.events.emit({ type: 'member-updated', workspaceId: member.workspaceId, userId, character: dto.character, status });
    return { character: updated.character, status: updated.status };
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
    await this.desks.sync(current.id);
    return { layout, version };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
