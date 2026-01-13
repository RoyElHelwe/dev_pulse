import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService, SprintStatus, TaskStatus } from '@ft-trans/database';
import { CreateSprintDto, UpdateSprintDto } from './dto';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class SprintService {
  constructor(private prisma: PrismaService) {}

  private hasPermission(userRole: string, requiredRole: string): boolean {
    return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
  }

  async createSprint(workspaceId: string, userRole: string, dto: CreateSprintDto) {
    if (!this.hasPermission(userRole, 'MANAGER')) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to create sprints',
      });
    }

    const sprint = await this.prisma.sprint.create({
      data: {
        name: dto.name,
        goal: dto.goal,
        workspaceId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: SprintStatus.PLANNED,
      },
    });

    return sprint;
  }

  async findAllSprints(workspaceId: string) {
    const sprints = await this.prisma.sprint.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Calculate metrics for each sprint
    const sprintsWithMetrics = await Promise.all(
      sprints.map(async (sprint) => {
        const taskStats = await this.prisma.task.groupBy({
          by: ['status'],
          where: { sprintId: sprint.id },
          _count: true,
        });

        const totalTasks = taskStats.reduce((sum, s) => sum + s._count, 0);
        const completedTasks =
          taskStats.find((s) => s.status === TaskStatus.DONE)?._count || 0;

        return {
          ...sprint,
          totalTasks,
          completedTasks,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        };
      }),
    );

    return sprintsWithMetrics;
  }

  async findOneSprint(sprintId: string, workspaceId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, workspaceId },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!sprint) {
      throw new RpcException({ statusCode: 404, message: 'Sprint not found' });
    }

    // Calculate metrics
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (t) => t.status === TaskStatus.DONE,
    ).length;

    return {
      ...sprint,
      totalTasks,
      completedTasks,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }

  async updateSprint(
    sprintId: string,
    workspaceId: string,
    userRole: string,
    dto: UpdateSprintDto,
  ) {
    if (!this.hasPermission(userRole, 'MANAGER')) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to update sprints',
      });
    }

    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, workspaceId },
    });

    if (!sprint) {
      throw new RpcException({ statusCode: 404, message: 'Sprint not found' });
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.goal !== undefined) updateData.goal = dto.goal;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);

    const updatedSprint = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: updateData,
    });

    return updatedSprint;
  }

  async startSprint(sprintId: string, workspaceId: string, userRole: string) {
    if (!this.hasPermission(userRole, 'MANAGER')) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to start sprints',
      });
    }

    // Check if there's already an active sprint
    const activeSprint = await this.prisma.sprint.findFirst({
      where: { workspaceId, status: SprintStatus.ACTIVE },
    });

    if (activeSprint) {
      throw new RpcException({
        statusCode: 400,
        message: 'There is already an active sprint. Complete it first.',
      });
    }

    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, workspaceId },
    });

    if (!sprint) {
      throw new RpcException({ statusCode: 404, message: 'Sprint not found' });
    }

    if (sprint.status !== SprintStatus.PLANNED) {
      throw new RpcException({
        statusCode: 400,
        message: 'Only planned sprints can be started',
      });
    }

    const updatedSprint = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { status: SprintStatus.ACTIVE },
    });

    return updatedSprint;
  }

  async completeSprint(sprintId: string, workspaceId: string, userRole: string) {
    if (!this.hasPermission(userRole, 'MANAGER')) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have permission to complete sprints',
      });
    }

    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, workspaceId },
      include: {
        tasks: true,
      },
    });

    if (!sprint) {
      throw new RpcException({ statusCode: 404, message: 'Sprint not found' });
    }

    if (sprint.status !== SprintStatus.ACTIVE) {
      throw new RpcException({
        statusCode: 400,
        message: 'Only active sprints can be completed',
      });
    }

    // Calculate final metrics
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (t) => t.status === TaskStatus.DONE,
    ).length;

    const updatedSprint = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.COMPLETED,
        totalTasks,
        completedTasks,
      },
    });

    // Move incomplete tasks to backlog (remove from sprint)
    await this.prisma.task.updateMany({
      where: {
        sprintId,
        status: { not: TaskStatus.DONE },
      },
      data: { sprintId: null },
    });

    return updatedSprint;
  }

  async getActiveSprint(workspaceId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { workspaceId, status: SprintStatus.ACTIVE },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    if (!sprint) {
      return null;
    }

    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter(
      (t) => t.status === TaskStatus.DONE,
    ).length;

    return {
      ...sprint,
      totalTasks,
      completedTasks,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }
}
