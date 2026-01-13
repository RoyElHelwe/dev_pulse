import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TaskService } from './task.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  AssignTaskDto,
  GetTasksQueryDto,
} from './dto';

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  // ============================================
  // TASK CRUD OPERATIONS
  // ============================================

  @MessagePattern('task.create')
  async createTask(
    @Payload() data: { userId: string; workspaceId: string; dto: CreateTaskDto },
  ) {
    return this.taskService.createTask(data.userId, data.workspaceId, data.dto);
  }

  @MessagePattern('task.findAll')
  async findAllTasks(
    @Payload()
    data: {
      userId: string;
      workspaceId: string;
      userRole: string;
      query: GetTasksQueryDto;
    },
  ) {
    return this.taskService.findAllTasks(
      data.userId,
      data.workspaceId,
      data.userRole,
      data.query,
    );
  }

  @MessagePattern('task.findOne')
  async findOneTask(@Payload() data: { taskId: string; workspaceId: string }) {
    return this.taskService.findOneTask(data.taskId, data.workspaceId);
  }

  @MessagePattern('task.update')
  async updateTask(
    @Payload()
    data: {
      taskId: string;
      userId: string;
      workspaceId: string;
      userRole: string;
      dto: UpdateTaskDto;
    },
  ) {
    return this.taskService.updateTask(
      data.taskId,
      data.userId,
      data.workspaceId,
      data.userRole,
      data.dto,
    );
  }

  @MessagePattern('task.delete')
  async deleteTask(
    @Payload()
    data: { taskId: string; workspaceId: string; userRole: string },
  ) {
    return this.taskService.deleteTask(
      data.taskId,
      data.workspaceId,
      data.userRole,
    );
  }

  // ============================================
  // TASK STATUS & ASSIGNMENT
  // ============================================

  @MessagePattern('task.updateStatus')
  async updateTaskStatus(
    @Payload()
    data: {
      taskId: string;
      userId: string;
      workspaceId: string;
      userRole: string;
      dto: UpdateTaskStatusDto;
    },
  ) {
    return this.taskService.updateTaskStatus(
      data.taskId,
      data.userId,
      data.workspaceId,
      data.userRole,
      data.dto,
    );
  }

  @MessagePattern('task.assign')
  async assignTask(
    @Payload()
    data: {
      taskId: string;
      userId: string;
      workspaceId: string;
      userRole: string;
      dto: AssignTaskDto;
    },
  ) {
    return this.taskService.assignTask(
      data.taskId,
      data.userId,
      data.workspaceId,
      data.userRole,
      data.dto,
    );
  }

  @MessagePattern('task.unassign')
  async unassignTask(
    @Payload()
    data: {
      taskId: string;
      workspaceId: string;
      userRole: string;
    },
  ) {
    return this.taskService.unassignTask(
      data.taskId,
      data.workspaceId,
      data.userRole,
    );
  }

  // ============================================
  // KANBAN BOARD
  // ============================================

  @MessagePattern('task.getBoard')
  async getKanbanBoard(
    @Payload()
    data: {
      userId: string;
      workspaceId: string;
      userRole: string;
      sprintId?: string;
    },
  ) {
    return this.taskService.getKanbanBoard(
      data.userId,
      data.workspaceId,
      data.userRole,
      data.sprintId,
    );
  }

  @MessagePattern('task.reorder')
  async reorderTasks(
    @Payload()
    data: {
      workspaceId: string;
      taskId: string;
      newStatus: string;
      newPosition: number;
    },
  ) {
    return this.taskService.reorderTask(
      data.workspaceId,
      data.taskId,
      data.newStatus,
      data.newPosition,
    );
  }

  // ============================================
  // MY TASKS
  // ============================================

  @MessagePattern('task.getMyTasks')
  async getMyTasks(
    @Payload() data: { userId: string; workspaceId: string },
  ) {
    return this.taskService.getMyTasks(data.userId, data.workspaceId);
  }

  // ============================================
  // TASK ACTIVITIES
  // ============================================

  @MessagePattern('task.getActivities')
  async getTaskActivities(@Payload() data: { taskId: string }) {
    return this.taskService.getTaskActivities(data.taskId);
  }
}
