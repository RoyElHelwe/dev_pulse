/**
 * Task persistence and orchestration: membership checks, per-workspace numbering, column ranking,
 * and live `task:*` broadcasts to the office. HTTP lives in tasks.controller.ts; pure rules in tasks.rules.ts.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type Prisma, type Task, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import type { Subscription } from 'rxjs';
import { FormError } from '../common/form-error';
import { OfficeGateway } from '../office/office.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../workspace/membership.service';
import { WorkspaceEvents } from '../workspace/workspace-events';
import type { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { canDeleteTask, needsRebalance, taskKey, workspacePrefix } from './tasks.rules';

/** Serialized task payload broadcast to office clients and returned by issue tracker APIs. */
export interface TaskView {
  id: string;
  key: string;
  number: number;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

function toTaskView(task: Task, prefix: string): TaskView {
  return {
    id: task.id,
    key: taskKey(prefix, task.number),
    number: task.number,
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? null,
    reporterId: task.reporterId,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    rank: task.rank,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Manages task persistence, ordering, workspace membership verification, and real-time office broadcasts. */
@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private subscription?: Subscription;

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly office: OfficeGateway,
    private readonly events: WorkspaceEvents,
  ) {}

  onModuleInit() {
    this.subscription = this.events.events$.subscribe((event) => {
      if (event.type === 'member-removed') {
        this.handleMemberRemoved(event.workspaceId, event.userId).catch((err) => {
          this.logger.error(`Failed to handle member-removed event: ${(err as Error).message}`, (err as Error).stack);
        });
      }
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  /** Lists all tasks in the caller's workspace, sorted by status, rank, and creation date. */
  async list(userId: string): Promise<{ prefix: string; tasks: TaskView[] }> {
    const me = await this.membership.require(userId);
    const prefix = workspacePrefix(me.workspace.name);
    const tasks = await this.prisma.task.findMany({
      where: { workspaceId: me.workspaceId },
      orderBy: [{ status: 'asc' }, { rank: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      prefix,
      tasks: tasks.map((t) => toTaskView(t, prefix)),
    };
  }

  /** Creates a task with next sequential number and bottom rank in the chosen column. */
  async create(userId: string, dto: CreateTaskDto): Promise<TaskView> {
    const me = await this.membership.require(userId);
    const workspaceId = me.workspaceId;
    const prefix = workspacePrefix(me.workspace.name);

    if (dto.assigneeId) {
      const isMember = await this.prisma.workspaceMember.count({
        where: { workspaceId, userId: dto.assigneeId },
      });
      if (!isMember) {
        throw new FormError('BAD_ASSIGNEE', 'That person is not in this office.', 'assigneeId');
      }
    }

    const status = dto.status ?? TaskStatus.TODO;

    const task = await this.prisma.$transaction(async (tx) => {
      // Serialise creates per workspace so two concurrent requests can't both take the same MAX(number)+1.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;

      const numAgg = await tx.task.aggregate({
        where: { workspaceId },
        _max: { number: true },
      });
      const number = (numAgg._max.number ?? 0) + 1;

      const rankAgg = await tx.task.aggregate({
        where: { workspaceId, status },
        _max: { rank: true },
      });
      const rank = rankAgg._max.rank != null ? rankAgg._max.rank + 1 : 1;

      return tx.task.create({
        data: {
          workspaceId,
          number,
          type: dto.type ?? TaskType.TASK,
          title: dto.title,
          description: dto.description ?? '',
          status,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          assigneeId: dto.assigneeId ?? null,
          reporterId: userId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          rank,
        },
      });
    });

    const view = toTaskView(task, prefix);
    this.office.broadcast(workspaceId, 'task:created', view);
    return view;
  }

  /** Updates task details or moves it across columns / ranks. Rebalances column if gaps get too small. */
  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<TaskView> {
    const me = await this.membership.require(userId);
    const workspaceId = me.workspaceId;
    const prefix = workspacePrefix(me.workspace.name);

    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.workspaceId !== workspaceId) {
      throw new FormError('NOT_FOUND', 'Task not found.');
    }

    if (dto.assigneeId) {
      const isMember = await this.prisma.workspaceMember.count({
        where: { workspaceId, userId: dto.assigneeId },
      });
      if (!isMember) {
        throw new FormError('BAD_ASSIGNEE', 'That person is not in this office.', 'assigneeId');
      }
    }

    const isMove = dto.status !== undefined || dto.rank !== undefined;
    const targetStatus = dto.status ?? task.status;
    const data = this.buildUpdateData(dto);
    if (isMove) {
      data.status = targetStatus;
      data.rank = dto.rank ?? (await this.endOfColumnRank(workspaceId, targetStatus, task.id));
    }

    const updated = await this.prisma.task.update({ where: { id }, data });

    if (isMove) {
      const rebalanced = await this.rebalanceColumnIfCrowded(workspaceId, targetStatus, prefix);
      const mine = rebalanced?.find((view) => view.id === id);
      if (mine) return mine;
    }

    const view = toTaskView(updated, prefix);
    this.office.broadcast(workspaceId, 'task:updated', view);
    return view;
  }

  /** Copies only the detail fields the client sent (undefined = leave unchanged; null clears assignee/dueDate). */
  private buildUpdateData(dto: UpdateTaskDto): Prisma.TaskUncheckedUpdateInput {
    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return data;
  }

  /** Rank that puts a task at the bottom of a column (used when a move gives a status but no rank). */
  private async endOfColumnRank(workspaceId: string, status: TaskStatus, excludeTaskId: string): Promise<number> {
    const rankAgg = await this.prisma.task.aggregate({
      where: { workspaceId, status, id: { not: excludeTaskId } },
      _max: { rank: true },
    });
    return rankAgg._max.rank != null ? rankAgg._max.rank + 1 : 1;
  }

  /**
   * Ranks are midpoints, so repeated drops between two cards shrink the gap until floats collide.
   * When any neighbouring pair is too close, renumber the whole column 1..n and broadcast every card;
   * returns the renumbered views, or null when the column was fine. See docs/code/tasks.md.
   */
  private async rebalanceColumnIfCrowded(
    workspaceId: string,
    status: TaskStatus,
    prefix: string,
  ): Promise<TaskView[] | null> {
    const columnTasks = await this.prisma.task.findMany({
      where: { workspaceId, status },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
    });
    const crowded = columnTasks.some((t, i) => i > 0 && needsRebalance(columnTasks[i - 1].rank, t.rank));
    if (!crowded) return null;

    const views: TaskView[] = [];
    for (const [i, t] of columnTasks.entries()) {
      const renumbered = await this.prisma.task.update({ where: { id: t.id }, data: { rank: i + 1 } });
      const view = toTaskView(renumbered, prefix);
      views.push(view);
      this.office.broadcast(workspaceId, 'task:updated', view);
    }
    return views;
  }

  /** Deletes a task. Only reporter, OWNER, or ADMIN may delete. */
  async remove(userId: string, id: string): Promise<void> {
    const me = await this.membership.require(userId);
    const workspaceId = me.workspaceId;

    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.workspaceId !== workspaceId) {
      throw new FormError('NOT_FOUND', 'Task not found.');
    }

    if (!canDeleteTask(me.role, userId, task.reporterId)) {
      throw new FormError('NOT_ALLOWED', 'Only the reporter or an organiser can delete this task.');
    }

    await this.prisma.task.delete({ where: { id } });
    this.office.broadcast(workspaceId, 'task:deleted', { id });
  }

  private async handleMemberRemoved(workspaceId: string, userId: string) {
    const affected = await this.prisma.task.findMany({
      where: { workspaceId, assigneeId: userId },
      select: { id: true },
    });
    if (affected.length === 0) return;

    const ids = affected.map((t) => t.id);
    await this.prisma.task.updateMany({
      where: { workspaceId, assigneeId: userId },
      data: { assigneeId: null },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const prefix = workspace ? workspacePrefix(workspace.name) : 'WS';

    const updatedTasks = await this.prisma.task.findMany({
      where: { id: { in: ids } },
    });
    for (const task of updatedTasks) {
      this.office.broadcast(workspaceId, 'task:updated', toTaskView(task, prefix));
    }
  }
}
