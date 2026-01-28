import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
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

interface CreateWorkspaceDto {
  name: string;
  teamSize: number;
  roles: string[];
  officeStyle: string;
}

interface UpdateWorkspaceDto {
  name?: string;
  officeLayout?: Record<string, unknown>;
}

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceGatewayController {
  constructor(
    @Inject('WORKSPACE_SERVICE') private workspaceClient: ClientProxy,
    private prisma: PrismaService,
  ) {}

  /**
   * Get current user's workspace status
   */
  @Get('status')
  async getWorkspaceStatus(@Request() req: AuthenticatedRequest) {
    try {
      const result = await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_user_workspace_status' },
          { userId: req.user.id },
        ),
      );

      // Enrich with counts if user has a workspace
      if (result.hasWorkspace && result.workspace) {
        const counts = await firstValueFrom(
          this.workspaceClient.send(
            { cmd: 'get_workspace_counts' },
            { workspaceId: result.workspace.id },
          ),
        );
        result.workspace.memberCount = counts.memberCount || 1;
        result.workspace.pendingInvitations = counts.pendingInvitations || 0;
      }

      return result;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Create a new workspace (onboarding)
   */
  @Post()
  async createWorkspace(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateWorkspaceDto,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'create_workspace' },
          {
            userId: req.user.id,
            ...body,
          },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get workspace details
   */
  @Get(':id')
  async getWorkspace(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_workspace' },
          { workspaceId: id, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Update workspace
   */
  @Patch(':id')
  async updateWorkspace(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'update_workspace' },
          {
            workspaceId: id,
            userId: req.user.id,
            ...body,
          },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get workspace members
   */
  @Get(':id/members')
  async getMembers(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      const members = await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_workspace_members' },
          { workspaceId: id, userId: req.user.id },
        ),
      );

      // Enrich members with user data from auth database
      const userIds = members.map((m: any) => m.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, image: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      return members.map((member: any) => ({
        ...member,
        user: userMap.get(member.userId) || { name: 'Unknown', email: '' },
      }));
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  // ==================== OFFICE LAYOUT ROUTES ====================

  /**
   * Create or update office layout
   */
  @Post(':id/office/layout')
  async createOfficeLayout(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
    @Body() body: any,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'create_office_layout' },
          { workspaceId, userId: req.user.id, ...body },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get office layout
   */
  @Get(':id/office/layout')
  async getOfficeLayout(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_office_layout' },
          { workspaceId, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Update office layout
   */
  @Put(':id/office/layout')
  async updateOfficeLayout(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
    @Body() body: any,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'update_office_layout' },
          { workspaceId, userId: req.user.id, ...body },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Delete office layout
   */
  @Delete(':id/office/layout')
  async deleteOfficeLayout(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'delete_office_layout' },
          { workspaceId, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Save work time (batched - called periodically from frontend)
   * Uses upsert to efficiently aggregate daily work time without excessive DB writes
   */
  @Post(':id/work-time')
  async saveWorkTime(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
    @Body() body: { userId: string; duration: number; date: string },
  ) {
    try {
      // Verify user is saving their own work time
      if (body.userId !== req.user.id) {
        throw new HttpException(
          { statusCode: 403, message: 'Cannot save work time for another user' },
          HttpStatus.FORBIDDEN,
        );
      }

      // Use upsert to efficiently update daily aggregate
      const date = new Date(body.date);
      date.setHours(0, 0, 0, 0); // Normalize to midnight

      const result = await this.prisma.workTime.upsert({
        where: {
          workspaceId_userId_date: {
            workspaceId,
            userId: body.userId,
            date,
          },
        },
        update: {
          duration: {
            increment: body.duration, // Add to existing duration
          },
        },
        create: {
          workspaceId,
          userId: body.userId,
          date,
          duration: body.duration,
        },
      });

      return { success: true, totalDuration: result.duration };
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get work time for a user (daily, weekly, or custom range)
   */
  @Get(':id/work-time')
  async getWorkTime(
    @Request() req: AuthenticatedRequest,
    @Param('id') workspaceId: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const targetUserId = userId || req.user.id;
      
      const where: any = {
        workspaceId,
        userId: targetUserId,
      };

      if (startDate && endDate) {
        where.date = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      const workTimes = await this.prisma.workTime.findMany({
        where,
        orderBy: { date: 'desc' },
      });

      // Calculate total
      const totalDuration = workTimes.reduce((sum, wt) => sum + wt.duration, 0);

      return {
        workTimes,
        totalDuration,
        totalFormatted: this.formatDuration(totalDuration),
      };
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Format duration in seconds to human readable string
   */
  private formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  }

  /**
   * Handle RPC errors and convert them to HTTP exceptions
   */
  private handleRpcError(error: any): never {
    // Check if it's an RPC error with statusCode
    if (error?.statusCode || error?.error?.statusCode) {
      const statusCode = error.statusCode || error.error.statusCode;
      const message =
        error.message || error.error?.message || 'An error occurred';

      throw new HttpException(
        { statusCode, message, error: HttpStatus[statusCode] || 'Error' },
        statusCode,
      );
    }

    // Default to internal server error
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error?.message || 'Internal server error',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
