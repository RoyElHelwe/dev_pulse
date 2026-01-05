import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if user has a workspace
   */
  async getUserWorkspaceStatus(userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            ownerId: true,
          },
        },
      },
    });

    if (!member) {
      return {
        hasWorkspace: false,
        workspace: null,
        role: null,
      };
    }

    return {
      hasWorkspace: true,
      workspace: member.workspace,
      role: member.role,
      isOwner: member.workspace.ownerId === userId,
    };
  }

  /**
   * Get all workspaces where user is a member
   */
  async getUserWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            ownerId: true,
          },
        },
      },
    });

    return memberships.map((membership) => ({
      workspaceId: membership.workspaceId,
      workspace: membership.workspace,
      role: membership.role,
      isOwner: membership.workspace.ownerId === userId,
    }));
  }

  /**
   * Get user's membership in a specific workspace
   */
  async getUserMembership(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      isOwner: membership.workspace.ownerId === userId,
    };
  }

  /**
   * Create a new workspace with onboarding data
   */
  async createWorkspace(data: {
    userId: string;
    name: string;
    description?: string;
    teamSize: number;
    roles: { role: string; count: number }[];
    preferences?: any;
  }) {
    const { userId, name, description, teamSize, roles, preferences } = data;

    // Check if user already has a workspace
    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: { userId },
    });

    if (existingMember) {
      throw new RpcException({ statusCode: 409, message: 'User already belongs to a workspace' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug exists
    const existingWorkspace = await this.prisma.workspace.findUnique({
      where: { slug },
    });

    if (existingWorkspace) {
      throw new RpcException({ statusCode: 409, message: 'Workspace name already taken' });
    }

    // Generate initial office layout
    const officeLayout = this.generateOfficeLayout(teamSize, roles);

    // Create workspace and add owner
    const workspace = await this.prisma.workspace.create({
      data: {
        name,
        slug,
        description,
        ownerId: userId,
        officeLayout,
        settings: preferences || {},
        members: {
          create: {
            userId,
            role: 'OWNER',
            status: 'ONLINE',
          },
        },
      },
      include: {
        members: true,
      },
    });

    return workspace;
  }

  /**
   * Generate office layout based on team size and roles
   */
  private generateOfficeLayout(
    teamSize: number,
    roles: { role: string; count: number }[],
  ) {
    // Simple grid layout generation
    const gridSize = Math.ceil(Math.sqrt(teamSize));
    const desks = [];
    const meetingRooms = Math.ceil(teamSize / 8); // 1 meeting room per 8 people

    let deskIndex = 0;
    for (const roleGroup of roles) {
      for (let i = 0; i < roleGroup.count; i++) {
        const row = Math.floor(deskIndex / gridSize);
        const col = deskIndex % gridSize;
        desks.push({
          id: `desk-${deskIndex}`,
          type: 'desk',
          role: roleGroup.role,
          position: {
            x: 100 + col * 150,
            y: 100 + row * 150,
          },
        });
        deskIndex++;
      }
    }

    // Add meeting rooms
    const rooms = [];
    for (let i = 0; i < meetingRooms; i++) {
      rooms.push({
        id: `meeting-${i}`,
        type: 'meeting-room',
        position: {
          x: 100 + gridSize * 150 + 200,
          y: 100 + i * 200,
        },
        capacity: 8,
      });
    }

    // Add break room
    rooms.push({
      id: 'break-room',
      type: 'break-room',
      position: {
        x: 100 + gridSize * 150 + 200,
        y: 100 + meetingRooms * 200 + 200,
      },
    });

    return {
      version: '1.0',
      gridSize,
      teamSize,
      desks,
      rooms,
      dimensions: {
        width: 100 + (gridSize + 2) * 150 + 400,
        height: 100 + Math.max(gridSize, meetingRooms + 2) * 200,
      },
    };
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceId: string, userId: string) {
    // Verify user is a member
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!member) {
      throw new RpcException({ statusCode: 404, message: 'Workspace not found or access denied' });
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            status: true,
            position: true,
            joinedAt: true,
          },
        },
      },
    });

    return workspace;
  }

  /**
   * Update workspace
   */
  async updateWorkspace(
    workspaceId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      officeLayout?: any;
      settings?: any;
    },
  ) {
    // Verify user is owner or admin
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) {
      throw new RpcException({ statusCode: 403, message: 'Only owners and admins can update workspace' });
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  /**
   * Get workspace member and invitation counts
   */
  async getWorkspaceCounts(workspaceId: string) {
    const [memberCount, pendingInvitations] = await Promise.all([
      this.prisma.workspaceMember.count({
        where: { workspaceId },
      }),
      this.prisma.invitation.count({
        where: { workspaceId, status: 'PENDING' },
      }),
    ]);

    return { memberCount, pendingInvitations };
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId: string, userId: string) {
    // Verify user is a member
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) {
      throw new RpcException({ statusCode: 404, message: 'Workspace not found or access denied' });
    }

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
