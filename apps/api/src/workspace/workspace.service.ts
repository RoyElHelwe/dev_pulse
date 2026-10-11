/**
 * Core business logic for office workspaces, managing creation, layout
 * updates, wings expansion, and template switches.
 */

import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FormError } from '../common/form-error';
import { validateLayout } from '../office/layout/validate';
import type { OfficeLayout } from '../office/layout/types';
import { numberedDesks } from '../office/layout/geometry';
import { addWing, WingError, type WingResult } from '../office/layout/wings';
import { findTemplate } from '../office/templates';
import { PrismaService } from '../prisma/prisma.service';
import { DesksService } from './desks.service';
import type { CreateWorkspaceDto, SwitchTemplateDto, UpdateLayoutDto, UpdateMeDto, WingDto } from './workspace.dto';
import { CAN_MANAGE, MembershipService } from './membership.service';
import { WorkspaceEvents } from './workspace-events';

const COORD_PRECISION = 100;
const WING_SEED_BYTES = 4;
const round = (n: number) => Math.round(n * COORD_PRECISION) / COORD_PRECISION;
const concurrentSaveError = () =>
  new FormError('LAYOUT_CHANGED', 'Someone else saved the office meanwhile. Reload to see their changes.');

/** Manages workspace lifecycles, layout persistence, and office wing expansions. */
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

  /** Retrieves workspace details, layout state, member permissions, and desk allocations. */
  async mine(userId: string) {
    let member = await this.membership.require(userId);
    // No desk yet (offices created before desks existed, or a desk freed up since): try again.
    if (!member.deskId) {
      await this.desks.sync(member.workspaceId);
      member = await this.membership.require(userId);
    }
    const { workspace } = member;
    const memberCount = await this.prisma.workspaceMember.count({ where: { workspaceId: workspace.id } });
    const wings = await this.prisma.officeWing.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, side: true, x: true, y: true, w: true, h: true, deskCount: true },
    });
    const currentLayout = workspace.layout as unknown as OfficeLayout;
    const canManage = CAN_MANAGE.includes(member.role);
    const hasChill = currentLayout?.rooms?.some((r) => r.kind === 'chill') ?? false;
    return {
      id: workspace.id,
      name: workspace.name,
      templateId: workspace.templateId,
      layout: currentLayout,
      layoutVersion: workspace.layoutVersion,
      role: member.role,
      character: member.character,
      status: member.status,
      deskId: member.deskId,
      desks: await this.desks.list(workspace.id),
      memberCount,
      wings,
      canExpand: canManage && workspace.templateId === 'loft',
      canAddChill: canManage && !hasChill,
    };
  }

  /** Renames the workspace for managers and returns updated office details. */
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

  /** Switches the workspace template, rebuilding layout and reassigning member desks. */
  async switchTemplate(userId: string, dto: SwitchTemplateDto) {
    const member = await this.membership.require(userId, ['OWNER']);
    const current = member.workspace;
    if (dto.version !== current.layoutVersion) {
      throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
    }
    const template = findTemplate(dto.templateId)!;
    const people = await this.prisma.workspaceMember.count({ where: { workspaceId: current.id } });
    const teamSize = dto.teamSize ?? people;
    // Rebuilding a generated office keeps its look (the seed it was made with), even after a rename.
    const seed = (current.layout as unknown as OfficeLayout).generated?.seed ?? current.name;
    const layout = template.build(teamSize, seed);
    const desks = numberedDesks(layout).length;
    if (people > desks) {
      const office = template.id === 'generated' ? `An office for ${teamSize}` : template.name;
      throw new FormError('TOO_SMALL', `${office} has ${desks} desks and your team has ${people} people.`, 'templateId');
    }
    const meetingRooms = layout.rooms.filter((r) => r.kind === 'meeting').map((r) => r.id);
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workspace.updateMany({
        where: { id: current.id, layoutVersion: current.layoutVersion },
        data: { templateId: template.id, layout: layout as unknown as Prisma.InputJsonValue, layoutVersion: { increment: 1 } },
      });
      if (count !== 1) throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
      await tx.officeWing.deleteMany({ where: { workspaceId: current.id } });
      // Running and future bookings of rooms the new office doesn't have would lock rooms that don't exist.
      const gone = await tx.roomBooking.deleteMany({
        where: { workspaceId: current.id, endsAt: { gt: new Date() }, roomId: { notIn: meetingRooms } },
      });
      return gone.count;
    });
    const version = current.layoutVersion + 1;
    this.events.emit({ type: 'layout', workspaceId: current.id, layout, version, by: userId });
    if (cancelled > 0) this.events.emit({ type: 'bookings', workspaceId: current.id });
    await this.desks.sync(current.id);
    return this.mine(userId);
  }

  /** Updates the calling user's avatar character and status message. */
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

  /** Applies furniture position and room name updates while preserving structural walls. */
  async updateLayout(userId: string, dto: UpdateLayoutDto) {
    const member = await this.membership.require(userId, CAN_MANAGE);
    const current = member.workspace;
    if (dto.version !== current.layoutVersion) {
      throw concurrentSaveError();
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
      throw concurrentSaveError();
    }
    const version = current.layoutVersion + 1;
    this.events.emit({ type: 'layout', workspaceId: current.id, layout, version, by: userId });
    await this.desks.sync(current.id);
    return { layout, version };
  }

  /** Expand the Loft office with a new wing. */
  async addWing(userId: string, dto: WingDto) {
    return this.applyWing(userId, dto, false);
  }

  /** Add a chill wing (allowed for any template, once per office). */
  async addChillWing(userId: string, dto: WingDto) {
    return this.applyWing(userId, dto, true);
  }

  /** Checks template suitability, chill room presence, and layout version match. */
  private assertCanAddWing(
    current: { templateId: string; layout: unknown; layoutVersion: number; version?: number },
    isChill: boolean,
    version?: number,
  ) {
    const expectedVersion = version ?? current.version;
    const currentLayout = current.layout as unknown as OfficeLayout;
    if (!isChill && current.templateId !== 'loft') {
      throw new FormError('WINGS_UNSUPPORTED', 'Only the Loft office can be expanded.');
    }
    if (isChill && currentLayout.rooms?.some((r) => r.kind === 'chill')) {
      throw new FormError('CHILL_EXISTS', 'This office already has a chill room.');
    }
    if (expectedVersion !== undefined && expectedVersion !== current.layoutVersion) {
      throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
    }
  }

  /** Generates procedural rooms and furniture for an attached wing or maps domain errors. */
  private generateWing(
    currentLayout: OfficeLayout,
    side: WingDto['side'],
    seed: string,
    index: number,
    isChill: boolean,
  ): WingResult {
    try {
      return addWing(
        currentLayout,
        side,
        seed,
        index,
        isChill ? { special: 'chill' } : undefined,
      );
    } catch (err) {
      if (err instanceof WingError) {
        throw new FormError(err.code, err.message, 'side');
      }
      throw err;
    }
  }

  /** Persists layout changes, shifts existing wings, and records the new wing in a transaction. */
  private async saveWing(
    current: { id: string; layoutVersion: number },
    result: WingResult,
    side: WingDto['side'],
    seed: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // WHY: updateMany with layoutVersion in the where ensures only one concurrent save wins
      const { count } = await tx.workspace.updateMany({
        where: { id: current.id, layoutVersion: current.layoutVersion },
        data: {
          layout: result.layout as unknown as Prisma.InputJsonValue,
          layoutVersion: { increment: 1 },
        },
      });
      if (count !== 1) {
        throw new FormError('LAYOUT_CHANGED', 'The office was changed meanwhile. Reload the page and try again.');
      }
      // WHY: a LEFT wing moves everything east so earlier wings' stored coordinates must move too
      if (result.shift.x !== 0 || result.shift.y !== 0) {
        await tx.officeWing.updateMany({
          where: { workspaceId: current.id },
          data: {
            x: { increment: result.shift.x },
            y: { increment: result.shift.y },
          },
        });
      }
      // WHY: the seed is random per wing and stored so the wing can be reproduced
      await tx.officeWing.create({
        data: {
          workspaceId: current.id,
          side,
          seed,
          ...result.wing,
        },
      });
    });
  }

  private async applyWing(userId: string, dto: WingDto, isChill: boolean) {
    const member = await this.membership.require(userId, CAN_MANAGE);
    const current = member.workspace;
    const currentLayout = current.layout as unknown as OfficeLayout;

    this.assertCanAddWing(current, isChill, dto.version);

    const existing = await this.prisma.officeWing.findMany({ where: { workspaceId: current.id } });
    const seed = randomBytes(WING_SEED_BYTES).toString('hex');
    const index = existing.length + 1;

    const result = this.generateWing(currentLayout, dto.side, seed, index, isChill);

    await this.saveWing(current, result, dto.side, seed);

    const version = current.layoutVersion + 1;
    this.events.emit({
      type: 'layout',
      workspaceId: current.id,
      layout: result.layout,
      version,
      by: userId,
    });
    await this.desks.sync(current.id);
    return this.mine(userId);
  }
}

