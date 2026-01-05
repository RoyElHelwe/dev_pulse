import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WorkspaceService } from './workspace.service';

@Controller()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @MessagePattern({ cmd: 'get_user_workspace_status' })
  async getUserWorkspaceStatus(@Payload() data: { userId: string }) {
    return this.workspaceService.getUserWorkspaceStatus(data.userId);
  }

  @MessagePattern({ cmd: 'get_user_workspaces' })
  async getUserWorkspaces(@Payload() data: { userId: string }) {
    return this.workspaceService.getUserWorkspaces(data.userId);
  }

  @MessagePattern({ cmd: 'get_user_membership' })
  async getUserMembership(@Payload() data: { workspaceId: string; userId: string }) {
    return this.workspaceService.getUserMembership(data.workspaceId, data.userId);
  }

  @MessagePattern({ cmd: 'create_workspace' })
  async createWorkspace(@Payload() data: any) {
    return this.workspaceService.createWorkspace(data);
  }

  @MessagePattern({ cmd: 'get_workspace' })
  async getWorkspace(@Payload() data: { workspaceId: string; userId: string }) {
    return this.workspaceService.getWorkspace(data.workspaceId, data.userId);
  }

  @MessagePattern({ cmd: 'update_workspace' })
  async updateWorkspace(@Payload() data: any) {
    const { workspaceId, userId, ...updateData } = data;
    return this.workspaceService.updateWorkspace(workspaceId, userId, updateData);
  }

  @MessagePattern({ cmd: 'get_workspace_members' })
  async getMembers(@Payload() data: { workspaceId: string; userId: string }) {
    return this.workspaceService.getMembers(data.workspaceId, data.userId);
  }

  @MessagePattern({ cmd: 'get_workspace_counts' })
  async getWorkspaceCounts(@Payload() data: { workspaceId: string }) {
    return this.workspaceService.getWorkspaceCounts(data.workspaceId);
  }
}
