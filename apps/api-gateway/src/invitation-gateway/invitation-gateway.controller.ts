import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
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

interface CreateInvitationDto {
  email: string;
  role?: string;
}

@Controller('invitations')
export class InvitationGatewayController {
  constructor(
    @Inject('WORKSPACE_SERVICE') private workspaceClient: ClientProxy,
    private prisma: PrismaService,
  ) {}

  /**
   * Create a new invitation (requires auth - OWNER only)
   *
   * H-CASES HANDLED:
   * 1. Only OWNER can invite members
   * 2. Cannot invite user who already has a workspace (one workspace per user)
   * 3. Cannot invite user who is already a member of this workspace
   * 4. Cannot invite if there's already a pending invitation for this email
   */
  @Post(':workspaceId')
  @UseGuards(AuthGuard)
  async createInvitation(
    @Request() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateInvitationDto,
  ) {
    try {
      // H-CASE 1: Verify the user is the OWNER of this workspace
      const membership = await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_user_membership' },
          { workspaceId, userId: req.user.id },
        ),
      );

      if (!membership || membership.role !== 'OWNER') {
        throw new HttpException(
          {
            statusCode: 403,
            message: 'Only the workspace owner can invite new members.',
            error: 'Forbidden',
          },
          403,
        );
      }

      // Prevent inviting someone as OWNER (there can only be one owner)
      if (body.role === 'OWNER') {
        throw new HttpException(
          {
            statusCode: 400,
            message:
              'Cannot invite someone as OWNER. There can only be one workspace owner.',
            error: 'Bad Request',
          },
          400,
        );
      }

      // Check if user with this email exists in the API Gateway database
      const existingUser = await this.prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });

      if (existingUser) {
        // H-CASE 2 & 3: Check if user already has any workspace
        try {
          const userWorkspaces = await firstValueFrom(
            this.workspaceClient.send(
              { cmd: 'get_user_workspaces' },
              { userId: existingUser.id },
            ),
          );

          if (userWorkspaces && userWorkspaces.length > 0) {
            // Check if it's the same workspace (already a member)
            const isAlreadyMember = userWorkspaces.some(
              (ws: any) => ws.workspaceId === workspaceId,
            );

            if (isAlreadyMember) {
              throw new HttpException(
                {
                  statusCode: 400,
                  message: `${body.email} is already a member of this workspace.`,
                  error: 'Bad Request',
                },
                400,
              );
            }

            throw new HttpException(
              {
                statusCode: 400,
                message: `${body.email} already belongs to another corporation. Users can only join one corporation at a time.`,
                error: 'Bad Request',
              },
              400,
            );
          }
        } catch (error) {
          // If it's already an HttpException, rethrow it
          if (error instanceof HttpException) {
            throw error;
          }
          // Otherwise, continue (user might not have workspaces yet)
        }
      }

      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'create_invitation' },
          {
            workspaceId,
            email: body.email.toLowerCase(),
            role: body.role,
            createdById: req.user.id,
          },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get invitation details by token (public endpoint)
   */
  @Get('token/:token')
  async getInvitationByToken(@Param('token') token: string) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_invitation_by_token' },
          { token },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Validate invitation for registration/login (public endpoint)
   * Returns detailed info about what the user should do
   *
   * H-CASES HANDLED:
   * 1. Invalid/expired/used token
   * 2. User exists -> should login
   * 3. User doesn't exist -> should register
   * 4. User exists and already has a workspace -> cannot join
   */
  @Get('validate/:token')
  async validateInvitationForRegistration(@Param('token') token: string) {
    try {
      // Get invitation details from workspace service
      const invitationResult = await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'validate_invitation_for_registration' },
          { token },
        ),
      );

      if (!invitationResult.valid) {
        return invitationResult;
      }

      const invitation = invitationResult.invitation;

      // Check if user with this email exists in API Gateway database
      const existingUser = await this.prisma.user.findUnique({
        where: { email: invitation.email.toLowerCase() },
      });

      // H-CASE: User exists - check if they already have a workspace
      if (existingUser) {
        try {
          const userWorkspaces = await firstValueFrom(
            this.workspaceClient.send(
              { cmd: 'get_user_workspaces' },
              { userId: existingUser.id },
            ),
          );

          if (userWorkspaces && userWorkspaces.length > 0) {
            // User already has a workspace - they cannot accept this invitation
            return {
              valid: false,
              message:
                'This user is already a member of another corporation. Users can only belong to one corporation.',
              errorCode: 'USER_HAS_WORKSPACE',
              invitation: {
                email: invitation.email,
                workspace: invitation.workspace,
              },
            };
          }
        } catch (error) {
          // Continue if workspace check fails
        }

        return {
          valid: true,
          userExists: true,
          needsLogin: true,
          needsRegistration: false,
          invitation: invitationResult.invitation,
          message: 'Please sign in to accept this invitation.',
        };
      }

      // User doesn't exist - needs to register
      return {
        valid: true,
        userExists: false,
        needsLogin: false,
        needsRegistration: true,
        invitation: invitationResult.invitation,
        message: 'Create an account to join this workspace.',
      };
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Accept invitation (requires auth)
   * Validates that the authenticated user's email matches the invitation email
   */
  @Post('accept/:token')
  @UseGuards(AuthGuard)
  async acceptInvitation(
    @Request() req: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    try {
      // First, get the invitation to validate email
      const invitation = await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_invitation_by_token' },
          { token },
        ),
      );

      // CRITICAL: Validate that the user's email matches the invitation email
      // This prevents Ahmad from using Roy's token
      if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
        throw new HttpException(
          {
            statusCode: 403,
            message: `This invitation was sent to ${invitation.email}. You cannot accept an invitation sent to a different email address.`,
            error: 'Forbidden',
          },
          403,
        );
      }

      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'accept_invitation' },
          { token, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Decline invitation (public endpoint)
   */
  @Post('decline/:token')
  async declineInvitation(@Param('token') token: string) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send({ cmd: 'decline_invitation' }, { token }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Get workspace invitations (requires auth)
   */
  @Get('workspace/:workspaceId')
  @UseGuards(AuthGuard)
  async getWorkspaceInvitations(
    @Request() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'get_workspace_invitations' },
          { workspaceId, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  /**
   * Cancel invitation (requires auth)
   */
  @Delete(':invitationId')
  @UseGuards(AuthGuard)
  async cancelInvitation(
    @Request() req: AuthenticatedRequest,
    @Param('invitationId') invitationId: string,
  ) {
    try {
      return await firstValueFrom(
        this.workspaceClient.send(
          { cmd: 'cancel_invitation' },
          { invitationId, userId: req.user.id },
        ),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
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
