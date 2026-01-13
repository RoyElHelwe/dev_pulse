import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PrismaService } from '@ft-trans/database';
import { firstValueFrom } from 'rxjs';
import { Request as ExpressRequest } from 'express';
import { WebsocketGateway } from '../websocket/websocket.gateway';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

// DTOs
interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  sprintId?: string;
  tags?: string[];
  deadline?: string;
  estimatedHours?: number;
}

interface UpdateTaskDto {
  title?: string;
  description?: string;
  priority?: string;
  sprintId?: string;
  tags?: string[];
  deadline?: string;
  estimatedHours?: number;
  actualHours?: number;
}

interface UpdateTaskStatusDto {
  status: string;
  position?: number;
}

interface GetTasksQueryDto {
  status?: string;
  priority?: string;
  assigneeId?: string;
  sprintId?: string;
  search?: string;
  showAll?: string;
}

interface CreateSprintDto {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

interface UpdateSprintDto {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

interface CreateCommentDto {
  content: string;
}

@Controller('tasks')
@UseGuards(AuthGuard)
export class TaskGatewayController {
  constructor(
    @Inject('TASK_SERVICE') private taskClient: ClientProxy,
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
  ) {}

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getUserWorkspace(userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId },
      include: { workspace: true },
    });

    if (!membership) {
      throw new HttpException('User has no workspace', HttpStatus.FORBIDDEN);
    }

    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };
  }

  private handleRpcError(error: any) {
    if (error?.statusCode) {
      throw new HttpException(error.message, error.statusCode);
    }
    console.error('RPC Error:', error);
    throw new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  // ============================================
  // TASK ENDPOINTS
  // ============================================

  /**
   * Create a new task
   */
  @Post()
  async createTask(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateTaskDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      const result = await firstValueFrom(
        this.taskClient.send('task.create', {
          userId: req.user.id,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );

      // Emit WebSocket event
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:created', {
        task: result,
        createdBy: req.user.id,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get all tasks (filtered by role)
   */
  @Get()
  async getTasks(
    @Request() req: AuthenticatedRequest,
    @Query() query: GetTasksQueryDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.findAll', {
          userId: req.user.id,
          workspaceId,
          userRole: role,
          query: {
            ...query,
            showAll: query.showAll === 'true',
          },
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get my assigned tasks
   */
  @Get('my')
  async getMyTasks(@Request() req: AuthenticatedRequest) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.getMyTasks', {
          userId: req.user.id,
          workspaceId,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get kanban board data
   */
  @Get('board')
  async getKanbanBoard(
    @Request() req: AuthenticatedRequest,
    @Query('sprintId') sprintId?: string,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.getBoard', {
          userId: req.user.id,
          workspaceId,
          userRole: role,
          sprintId,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get a single task by ID
   */
  @Get(':id')
  async getTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
  ) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.findOne', {
          taskId,
          workspaceId,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Update a task
   */
  @Patch(':id')
  async updateTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() body: UpdateTaskDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      const result = await firstValueFrom(
        this.taskClient.send('task.update', {
          taskId,
          userId: req.user.id,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );

      // Emit WebSocket event
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:updated', {
        task: result,
        updatedBy: req.user.id,
        changes: body,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Delete a task
   */
  @Delete(':id')
  async deleteTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      const result = await firstValueFrom(
        this.taskClient.send('task.delete', {
          taskId,
          workspaceId,
          userRole: role,
        }),
      );

      // Emit WebSocket event
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:deleted', {
        taskId,
        deletedBy: req.user.id,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Update task status (drag and drop)
   */
  @Patch(':id/status')
  async updateTaskStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() body: UpdateTaskStatusDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      // Get old task to compare status
      const oldTask = await firstValueFrom(
        this.taskClient.send('task.findOne', {
          taskId,
          workspaceId,
        }),
      );

      const result = await firstValueFrom(
        this.taskClient.send('task.updateStatus', {
          taskId,
          userId: req.user.id,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );

      // Emit WebSocket event
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:status:changed', {
        taskId,
        oldStatus: oldTask.status,
        newStatus: body.status,
        movedBy: req.user.id,
        movedByName: req.user.name,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Assign a task to a user
   */
  @Post(':id/assign')
  async assignTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() body: { assigneeId: string },
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      // Get task info for notification
      const task = await firstValueFrom(
        this.taskClient.send('task.findOne', {
          taskId,
          workspaceId,
        }),
      );

      const result = await firstValueFrom(
        this.taskClient.send('task.assign', {
          taskId,
          userId: req.user.id,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );

      // Get assignee info
      const assignee = await this.prisma.user.findUnique({
        where: { id: body.assigneeId },
        select: { name: true },
      });

      // Emit WebSocket event
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:assigned', {
        taskId,
        taskTitle: task.title,
        assigneeId: body.assigneeId,
        assigneeName: assignee?.name,
        assignedBy: req.user.id,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Unassign a task
   */
  @Delete(':id/assign')
  async unassignTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.unassign', {
          taskId,
          workspaceId,
          userRole: role,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Reorder task (for drag-drop between columns)
   */
  @Post(':id/reorder')
  async reorderTask(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() body: { status: string; position: number },
  ) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('task.reorder', {
          workspaceId,
          taskId,
          newStatus: body.status,
          newPosition: body.position,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get task activities
   */
  @Get(':id/activities')
  async getTaskActivities(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
  ) {
    try {
      await this.getUserWorkspace(req.user.id); // Verify access

      return await firstValueFrom(
        this.taskClient.send('task.getActivities', { taskId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  // ============================================
  // COMMENT ENDPOINTS
  // ============================================

  /**
   * Add a comment to a task
   */
  @Post(':id/comments')
  async addComment(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() body: CreateCommentDto,
  ) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('comment.create', {
          taskId,
          userId: req.user.id,
          workspaceId,
          dto: body,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get comments for a task
   */
  @Get(':id/comments')
  async getComments(
    @Request() req: AuthenticatedRequest,
    @Param('id') taskId: string,
  ) {
    try {
      await this.getUserWorkspace(req.user.id); // Verify access

      return await firstValueFrom(
        this.taskClient.send('comment.findAll', { taskId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Update a comment
   */
  @Patch(':taskId/comments/:commentId')
  async updateComment(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
    @Body() body: CreateCommentDto,
  ) {
    try {
      await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('comment.update', {
          commentId,
          userId: req.user.id,
          dto: body,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Delete a comment
   */
  @Delete(':taskId/comments/:commentId')
  async deleteComment(
    @Request() req: AuthenticatedRequest,
    @Param('commentId') commentId: string,
  ) {
    try {
      const { role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('comment.delete', {
          commentId,
          userId: req.user.id,
          userRole: role,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }
}

// ============================================
// SPRINT CONTROLLER
// ============================================

@Controller('sprints')
@UseGuards(AuthGuard)
export class SprintGatewayController {
  constructor(
    @Inject('TASK_SERVICE') private taskClient: ClientProxy,
    private prisma: PrismaService,
  ) {}

  private async getUserWorkspace(userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId },
      include: { workspace: true },
    });

    if (!membership) {
      throw new HttpException('User has no workspace', HttpStatus.FORBIDDEN);
    }

    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };
  }

  private handleRpcError(error: any) {
    if (error?.statusCode) {
      throw new HttpException(error.message, error.statusCode);
    }
    throw new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Post()
  async createSprint(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateSprintDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.create', {
          userId: req.user.id,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get()
  async getSprints(@Request() req: AuthenticatedRequest) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.findAll', { workspaceId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get('active')
  async getActiveSprint(@Request() req: AuthenticatedRequest) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.getActive', { workspaceId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get(':id')
  async getSprint(
    @Request() req: AuthenticatedRequest,
    @Param('id') sprintId: string,
  ) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.findOne', { sprintId, workspaceId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Patch(':id')
  async updateSprint(
    @Request() req: AuthenticatedRequest,
    @Param('id') sprintId: string,
    @Body() body: UpdateSprintDto,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.update', {
          sprintId,
          workspaceId,
          userRole: role,
          dto: body,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Post(':id/start')
  async startSprint(
    @Request() req: AuthenticatedRequest,
    @Param('id') sprintId: string,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.start', {
          sprintId,
          workspaceId,
          userRole: role,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Post(':id/complete')
  async completeSprint(
    @Request() req: AuthenticatedRequest,
    @Param('id') sprintId: string,
  ) {
    try {
      const { workspaceId, role } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('sprint.complete', {
          sprintId,
          workspaceId,
          userRole: role,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }
}

// ============================================
// BLOCKCHAIN CONTROLLER
// ============================================

@Controller('blockchain')
@UseGuards(AuthGuard)
export class BlockchainGatewayController {
  constructor(
    @Inject('TASK_SERVICE') private taskClient: ClientProxy,
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
  ) {}

  private async getUserWorkspace(userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { userId },
    });

    if (!membership) {
      throw new HttpException('User has no workspace', HttpStatus.FORBIDDEN);
    }

    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };
  }

  private handleRpcError(error: any) {
    if (error?.statusCode) {
      throw new HttpException(error.message, error.statusCode);
    }
    throw new HttpException(
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Post('record/:taskId')
  async recordTaskCompletion(
    @Request() req: AuthenticatedRequest,
    @Param('taskId') taskId: string,
  ) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      // Get task info
      const task = await firstValueFrom(
        this.taskClient.send('task.findOne', {
          taskId,
          workspaceId,
        }),
      );

      const result = await firstValueFrom(
        this.taskClient.send('blockchain.recordTask', {
          taskId,
          userId: req.user.id,
          workspaceId,
        }),
      );

      // Emit WebSocket event to notify all users
      this.websocketGateway.server.to(`tasks:${workspaceId}`).emit('task:blockchain:verified', {
        taskId,
        taskTitle: task.title,
        txHash: result.txHash,
        completedBy: req.user.id,
        completedByName: req.user.name,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get('record/:taskId')
  async getBlockchainRecord(
    @Request() req: AuthenticatedRequest,
    @Param('taskId') taskId: string,
  ) {
    try {
      await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('blockchain.getRecord', { taskId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get('user/:userId')
  async getUserBlockchainRecords(
    @Request() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    try {
      await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('blockchain.getUserRecords', { userId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get('stats')
  async getBlockchainStats(@Request() req: AuthenticatedRequest) {
    try {
      const { workspaceId } = await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('blockchain.getStats', { workspaceId }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Post('verify/:taskId')
  async verifyOnBlockchain(
    @Request() req: AuthenticatedRequest,
    @Param('taskId') taskId: string,
    @Body() body: { txHash: string },
  ) {
    try {
      await this.getUserWorkspace(req.user.id);

      return await firstValueFrom(
        this.taskClient.send('blockchain.verify', {
          taskId,
          txHash: body.txHash,
        }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }
}
