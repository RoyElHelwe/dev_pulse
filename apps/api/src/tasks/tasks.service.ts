import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type Prisma, type Task, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import type { Subscription } from 'rxjs';
import { FormError } from '../common/form-error';
import { OfficeGateway } from '../office/office.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../workspace/membership.service';
import { WorkspaceEvents } from '../workspace/workspace-events';
import type { CreateTaskDto, UpdateTaskDto } from './dto';
import { canDeleteTask, needsRebalance, taskKey, workspacePrefix } from './rules';

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

export function toTaskView(task: Task, prefix: string): TaskView {
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

    let targetRank: number | undefined;
    if (isMove) {
      if (dto.rank !== undefined) {
        targetRank = dto.rank;
      } else {
        // Status given without rank: put at end of target column
        const rankAgg = await this.prisma.task.aggregate({
          where: { workspaceId, status: targetStatus, id: { not: task.id } },
          _max: { rank: true },
        });
        targetRank = rankAgg._max.rank != null ? rankAgg._max.rank + 1 : 1;
      }
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (isMove) {
      data.status = targetStatus;
      data.rank = targetRank;
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
    });

    if (isMove) {
      const columnTasks = await this.prisma.task.findMany({
        where: { workspaceId, status: targetStatus },
        orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
      });

      let shouldRebalance = false;
      for (let i = 0; i < columnTasks.length - 1; i++) {
        if (needsRebalance(columnTasks[i].rank, columnTasks[i + 1].rank)) {
          shouldRebalance = true;
          break;
        }
      }

      if (shouldRebalance) {
        let currentTaskView: TaskView | null = null;
        for (let i = 0; i < columnTasks.length; i++) {
          const t = columnTasks[i];
          const rebalanced = await this.prisma.task.update({
            where: { id: t.id },
            data: { rank: i + 1 },
          });
          const view = toTaskView(rebalanced, prefix);
          if (t.id === id) {
            currentTaskView = view;
          }
          this.office.broadcast(workspaceId, 'task:updated', view);
        }
        return currentTaskView!;
      }
    }

    const view = toTaskView(updated, prefix);
    this.office.broadcast(workspaceId, 'task:updated', view);
    return view;
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
