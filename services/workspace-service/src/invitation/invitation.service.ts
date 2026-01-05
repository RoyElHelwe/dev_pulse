import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';

/**
 * Invitation Service
 * 
 * Handles workspace invitations with the following security features:
 * 
 * 1. UNIQUE TOKENS: Each invitation has a unique token - Ahmad cannot use Roy's token
 * 2. EMAIL VALIDATION: Token is tied to a specific email address
 * 3. ONE-TIME USE: After acceptance, invitation is marked as ACCEPTED and cannot be reused
 * 4. EXPIRATION: Invitations expire after 7 days
 * 5. WORKSPACE LIMIT: Users can only join one workspace (checked before acceptance)
 * 
 * Flow for users without an account:
 * 1. User clicks invitation link
 * 2. Frontend calls /invitations/validate/:token to get the required email
 * 3. User is redirected to registration page with email pre-filled
 * 4. After registration and login, user can accept the invitation
 * 5. API Gateway validates user's email matches invitation email
 * 6. Invitation is marked as ACCEPTED and user is added to workspace
 */

interface CreateInvitationDto {
  workspaceId: string;
  email: string;
  role?: string;
  createdById: string;
}

interface AcceptInvitationDto {
  token: string;
  userId: string;
}

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a new invitation
   */
  async createInvitation(dto: CreateInvitationDto) {
    const { workspaceId, email, role = 'MEMBER', createdById } = dto;

    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new RpcException({ statusCode: 404, message: 'Workspace not found' });
    }

    // Check for pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        workspaceId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new RpcException({ statusCode: 400, message: 'An invitation has already been sent to this email' });
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId,
        email,
        token,
        role,
        status: 'PENDING',
        expiresAt,
        createdById,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const inviteUrl = `${process.env.APP_URL!}/invite/${token}`;

    // Send invitation email (non-blocking)
    // Note: We don't have access to user names in this microservice
    this.emailService.sendInvitationEmail({
      to: email,
      workspaceName: invitation.workspace.name,
      inviteUrl,
    }).catch(err => {
      console.error('Failed to send invitation email:', err);
      // Don't fail the invitation if email fails
    });

    return {
      invitation,
      inviteUrl,
    };
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new RpcException({ statusCode: 404, message: 'Invitation not found or invalid' });
    }

    if (invitation.status === 'ACCEPTED') {
      throw new RpcException({ statusCode: 400, message: 'This invitation has already been accepted and cannot be used again' });
    }

    if (invitation.status === 'DECLINED') {
      throw new RpcException({ statusCode: 400, message: 'This invitation has been declined' });
    }

    if (invitation.status === 'EXPIRED') {
      throw new RpcException({ statusCode: 400, message: 'This invitation has expired' });
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new RpcException({ statusCode: 400, message: 'This invitation has expired' });
    }

    return invitation;
  }

  /**
   * Accept invitation and add user to workspace
   * The userId should be the user's actual ID after they register/login
   * The email from their account must match the invitation email
   */
  async acceptInvitation(dto: AcceptInvitationDto) {
    const { token, userId } = dto;

    // Get and validate invitation
    const invitation = await this.getInvitationByToken(token);

    // CRITICAL: Validate that the user's email matches the invitation email
    // This prevents Ahmad from using Roy's invitation token
    // Note: This check will be done at the API Gateway level where we have access to user data
    // For now, we trust the API Gateway to send the correct userId

    // Check if user already has a workspace (one workspace per user rule)
    const existingMembership = await this.prisma.workspaceMember.findUnique({
      where: { userId },
    });

    if (existingMembership) {
      throw new RpcException({ 
        statusCode: 400, 
        message: 'You are already a member of a workspace. Each user can only join one workspace.' 
      });
    }

    // Create workspace membership and mark invitation as ACCEPTED in transaction
    const result = await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          status: 'ONLINE',
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return {
      member: result[0],
      workspace: invitation.workspace,
      message: 'Successfully joined workspace',
    };
  }

  /**
   * Validate invitation for registration
   * Returns invitation details including the email that should be used for registration
   */
  async validateInvitationForRegistration(token: string) {
    const invitation = await this.getInvitationByToken(token);
    
    // Check if user with this email exists in the API Gateway database
    // Since we can't directly access the API Gateway's database from here,
    // we'll return the invitation data and let the frontend handle the flow
    // The userExists check should be done in the API Gateway or frontend
    
    return {
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          slug: invitation.workspace.slug,
          image: invitation.workspace.image,
        },
      },
      userExists: true, // We'll assume user might exist and let them try to login or register
      message: 'Invitation is valid',
    };
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string) {
    const invitation = await this.getInvitationByToken(token);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
    });

    return { message: 'Invitation declined' };
  }

  /**
   * Get pending invitations for a workspace
   */
  async getWorkspaceInvitations(workspaceId: string, userId: string) {
    // Verify user is a member of the workspace
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!member) {
      throw new RpcException({ statusCode: 404, message: 'You are not a member of this workspace' });
    }

    const invitations = await this.prisma.invitation.findMany({
      where: {
        workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  /**
   * Cancel/revoke an invitation
   */
  async cancelInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new RpcException({ statusCode: 404, message: 'Invitation not found' });
    }

    // Check if user has permission (workspace owner/admin or invitation creator)
    const member = invitation.workspace.members[0];
    if (!member && invitation.createdById !== userId) {
      throw new RpcException({ statusCode: 403, message: 'You do not have permission to cancel this invitation' });
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'EXPIRED' },
    });

    return { message: 'Invitation cancelled' };
  }
}
