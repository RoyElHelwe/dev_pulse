import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService, TaskStatus, TaskPriority, TaskAction } from '@ft-trans/database';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  AssignTaskDto,
  GetTasksQueryDto,
} from './dto';
import { createHash } from 'crypto';

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // PERMISSION HELPERS
  // ============================================

  private hasPermission(userRole: string, requiredRole: string): boolean {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  private canCreateTask(userRole: string): boolean {
    return this.hasPermission(userRole, 'MANAGER');
  }

  private canAssignTask(userRole: string): boolean {
    return this.hasPermission(userRole, 'MANAGER');
  }

  private canDeleteTask(userRole: string): boolean {
    return this.hasPermission(userRole, 'ADMIN');
  }

  private canMoveToStatus(
    userRole: string,
    currentStatus: TaskStatus,
    newStatus: TaskStatus,
    isAssignee: boolean,
  ): boolean {
    // Managers and above can move to any status
    if (this.hasPermission(userRole, 'MANAGER')) {
      return true;
    }

    // Members can only update their assigned tasks
    if (!isAssignee) {
      return false;
    }

    // Members can move: TODO -> IN_PROGRESS -> REVIEW
    const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.TODO],
      [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS], // Can move back for rework
      [TaskStatus.DONE]: [], // Cannot move from DONE
      [TaskStatus.ARCHIVED]: [],
    };

    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // ============================================
  // TASK CRUD OPERATIONS
  // ============================================

  async createTask(userId: string, workspaceId: string, dto: CreateTaskDto) {
    // Verify workspace membership
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new RpcException({ statusCode: 403, message: 'Not a workspace member' });
    }

    if (!this.canCreateTask(membership.role)) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to create tasks',
      });
    }

    // Get max position in TODO column
    const maxPosition = await this.prisma.task.aggregate({
      where: { workspaceId, status: TaskStatus.TODO },
      _max: { position: true },
    });

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority || TaskPriority.MEDIUM,
        status: TaskStatus.TODO,
        workspaceId,
        creatorId: userId,
        assigneeId: dto.assigneeId,
        sprintId: dto.sprintId,
        tags: dto.tags || [],
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        estimatedHours: dto.estimatedHours,
        position: (maxPosition._max.position || 0) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
      },
    });

    // Record activity
    await this.recordActivity(task.id, userId, TaskAction.CREATED);

    if (dto.assigneeId) {
      await this.recordActivity(task.id, userId, TaskAction.ASSIGNED, undefined, dto.assigneeId);
    }

    return task;
  }

  async findAllTasks(
    userId: string,
    workspaceId: string,
    userRole: string,
    query: GetTasksQueryDto,
  ) {
    const where: any = { workspaceId };

    // Members by default see only their tasks, unless filtering
    if (!this.hasPermission(userRole, 'MANAGER') && !query.showAll) {
      where.assigneeId = userId;
    }

    // Apply filters
    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }
    if (query.sprintId) {
      where.sprintId = query.sprintId;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });

    return tasks;
  }

  async findOneTask(taskId: string, workspaceId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    return task;
  }

  async updateTask(
    taskId: string,
    userId: string,
    workspaceId: string,
    userRole: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    const isAssignee = task.assigneeId === userId;

    // Members can only update their own tasks (limited fields)
    if (!this.hasPermission(userRole, 'MANAGER') && !isAssignee) {
      throw new RpcException({
        statusCode: 403,
        message: 'You can only update tasks assigned to you',
      });
    }

    // Build update data
    const updateData: any = {};
    const activities: { action: TaskAction; oldValue?: string; newValue?: string }[] = [];

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.priority !== undefined && this.hasPermission(userRole, 'MANAGER')) {
      activities.push({
        action: TaskAction.PRIORITY_CHANGED,
        oldValue: task.priority,
        newValue: dto.priority,
      });
      updateData.priority = dto.priority;
    }
    if (dto.deadline !== undefined && this.hasPermission(userRole, 'MANAGER')) {
      activities.push({
        action: task.deadline ? TaskAction.DEADLINE_CHANGED : TaskAction.DEADLINE_SET,
        oldValue: task.deadline?.toISOString(),
        newValue: dto.deadline,
      });
      updateData.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (dto.tags !== undefined) {
      updateData.tags = dto.tags;
    }
    if (dto.estimatedHours !== undefined) {
      updateData.estimatedHours = dto.estimatedHours;
    }
    if (dto.actualHours !== undefined) {
      updateData.actualHours = dto.actualHours;
    }
    if (dto.sprintId !== undefined && this.hasPermission(userRole, 'MANAGER')) {
      activities.push({
        action: dto.sprintId ? TaskAction.SPRINT_ADDED : TaskAction.SPRINT_REMOVED,
        oldValue: task.sprintId || undefined,
        newValue: dto.sprintId,
      });
      updateData.sprintId = dto.sprintId;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        sprint: {
          select: { id: true, name: true },
        },
      },
    });

    // Record activities
    for (const activity of activities) {
      await this.recordActivity(
        taskId,
        userId,
        activity.action,
        activity.oldValue,
        activity.newValue,
      );
    }

    return updatedTask;
  }

  async deleteTask(taskId: string, workspaceId: string, userRole: string) {
    if (!this.canDeleteTask(userRole)) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to delete tasks',
      });
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    await this.prisma.task.delete({ where: { id: taskId } });

    return { success: true, deletedId: taskId };
  }

  // ============================================
  // TASK STATUS & ASSIGNMENT
  // ============================================

  async updateTaskStatus(
    taskId: string,
    userId: string,
    workspaceId: string,
    userRole: string,
    dto: UpdateTaskStatusDto,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    const isAssignee = task.assigneeId === userId;
    const newStatus = dto.status as TaskStatus;

    if (!this.canMoveToStatus(userRole, task.status, newStatus, isAssignee)) {
      throw new RpcException({
        statusCode: 403,
        message: `You cannot move this task to ${newStatus}`,
      });
    }

    const updateData: any = {
      status: newStatus,
      position: dto.position ?? task.position,
    };

    // Track timestamps
    if (newStatus === TaskStatus.IN_PROGRESS && !task.startedAt) {
      updateData.startedAt = new Date();
    }
    if (newStatus === TaskStatus.DONE && !task.completedAt) {
      updateData.completedAt = new Date();
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Record activity
    await this.recordActivity(
      taskId,
      userId,
      TaskAction.STATUS_CHANGED,
      task.status,
      newStatus,
    );

    // If task is DONE, prepare for blockchain recording
    if (newStatus === TaskStatus.DONE) {
      // Generate proof hash for blockchain
      const proofHash = this.generateProofHash(updatedTask);
      await this.prisma.task.update({
        where: { id: taskId },
        data: { proofHash },
      });

      return { ...updatedTask, proofHash, readyForBlockchain: true };
    }

    return updatedTask;
  }

  async assignTask(
    taskId: string,
    userId: string,
    workspaceId: string,
    userRole: string,
    dto: AssignTaskDto,
  ) {
    if (!this.canAssignTask(userRole)) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to assign tasks',
      });
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    // Verify assignee is a workspace member
    const assigneeMembership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: dto.assigneeId },
    });

    if (!assigneeMembership) {
      throw new RpcException({
        statusCode: 400,
        message: 'Assignee is not a workspace member',
      });
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: dto.assigneeId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    await this.recordActivity(
      taskId,
      userId,
      TaskAction.ASSIGNED,
      task.assigneeId || undefined,
      dto.assigneeId,
    );

    return updatedTask;
  }

  async unassignTask(taskId: string, workspaceId: string, userRole: string) {
    if (!this.canAssignTask(userRole)) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to unassign tasks',
      });
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: null },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (task.assigneeId) {
      await this.recordActivity(taskId, task.creatorId, TaskAction.UNASSIGNED, task.assigneeId);
    }

    return updatedTask;
  }

  // ============================================
  // KANBAN BOARD
  // ============================================

  async getKanbanBoard(
    userId: string,
    workspaceId: string,
    userRole: string,
    sprintId?: string,
  ) {
    const where: any = { workspaceId };

    // Members see only their tasks on the board
    if (!this.hasPermission(userRole, 'MANAGER')) {
      where.assigneeId = userId;
    }

    if (sprintId) {
      where.sprintId = sprintId;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Group by status
    const board = {
      TODO: tasks.filter((t) => t.status === TaskStatus.TODO),
      IN_PROGRESS: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS),
      REVIEW: tasks.filter((t) => t.status === TaskStatus.REVIEW),
      DONE: tasks.filter((t) => t.status === TaskStatus.DONE),
    };

    return board;
  }

  async reorderTask(
    workspaceId: string,
    taskId: string,
    newStatus: string,
    newPosition: number,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new RpcException({ statusCode: 404, message: 'Task not found' });
    }

    // Get tasks in the target column
    const tasksInColumn = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: newStatus as TaskStatus,
        id: { not: taskId },
      },
      orderBy: { position: 'asc' },
    });

    // Reorder positions
    const updates = tasksInColumn.map((t, index) => {
      const position = index >= newPosition ? index + 1 : index;
      return this.prisma.task.update({
        where: { id: t.id },
        data: { position },
      });
    });

    // Update the moved task
    updates.push(
      this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: newStatus as TaskStatus,
          position: newPosition,
        },
      }),
    );

    await this.prisma.$transaction(updates);

    return { success: true };
  }

  // ============================================
  // MY TASKS
  // ============================================

  async getMyTasks(userId: string, workspaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        assigneeId: userId,
        status: { not: TaskStatus.ARCHIVED },
      },
      include: {
        sprint: {
          select: { id: true, name: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { deadline: 'asc' },
      ],
    });

    return tasks;
  }

  // ============================================
  // ACTIVITIES
  // ============================================

  async getTaskActivities(taskId: string) {
    const activities = await this.prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return activities;
  }

  private async recordActivity(
    taskId: string,
    userId: string,
    action: TaskAction,
    oldValue?: string,
    newValue?: string,
    metadata?: any,
  ) {
    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action,
        oldValue,
        newValue,
        metadata,
      },
    });
  }

  // ============================================
  // BLOCKCHAIN HELPERS
  // ============================================

  private generateProofHash(task: any): string {
    const data = {
      taskId: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      assigneeId: task.assigneeId,
      completedAt: task.completedAt?.toISOString(),
      creatorId: task.creatorId,
    };

    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}
