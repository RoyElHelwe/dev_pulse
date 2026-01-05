import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InvitationService } from './invitation.service';

@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @MessagePattern({ cmd: 'create_invitation' })
  async createInvitation(@Payload() data: {
    workspaceId: string;
    email: string;
    role?: string;
    createdById: string;
  }) {
    return this.invitationService.createInvitation(data);
  }

  @MessagePattern({ cmd: 'get_invitation_by_token' })
  async getInvitationByToken(@Payload() data: { token: string }) {
    return this.invitationService.getInvitationByToken(data.token);
  }

  @MessagePattern({ cmd: 'validate_invitation_for_registration' })
  async validateInvitationForRegistration(@Payload() data: { token: string }) {
    return this.invitationService.validateInvitationForRegistration(data.token);
  }

  @MessagePattern({ cmd: 'accept_invitation' })
  async acceptInvitation(@Payload() data: { token: string; userId: string }) {
    return this.invitationService.acceptInvitation(data);
  }

  @MessagePattern({ cmd: 'decline_invitation' })
  async declineInvitation(@Payload() data: { token: string }) {
    return this.invitationService.declineInvitation(data.token);
  }

  @MessagePattern({ cmd: 'get_workspace_invitations' })
  async getWorkspaceInvitations(@Payload() data: { workspaceId: string; userId: string }) {
    return this.invitationService.getWorkspaceInvitations(data.workspaceId, data.userId);
  }

  @MessagePattern({ cmd: 'cancel_invitation' })
  async cancelInvitation(@Payload() data: { invitationId: string; userId: string }) {
    return this.invitationService.cancelInvitation(data.invitationId, data.userId);
  }
}
