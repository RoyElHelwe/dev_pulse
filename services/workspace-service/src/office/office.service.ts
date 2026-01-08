/**
 * Office Layout Service
 * 
 * Handles office layout CRUD, desk assignments, and room bookings
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOfficeLayoutDto,
  UpdateOfficeLayoutDto,
  CreateDeskAssignmentDto,
  CreateMeetingBookingDto,
  GetBookingsQueryDto,
} from './dto';

@Injectable()
export class OfficeService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== OFFICE LAYOUT ====================

  /**
   * Create a new office layout for a workspace
   */
  async createLayout(workspaceId: string, dto: CreateOfficeLayoutDto) {
    // Check if workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if layout already exists for workspace (one-to-one relation)
    const existingLayout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
    });

    if (existingLayout) {
      // Update existing layout instead
      return this.updateLayout(workspaceId, existingLayout.id, {
        ...dto,
        layoutData: dto.layoutData,
      });
    }

    // Create new layout
    const layout = await this.prisma.officeLayout.create({
      data: {
        workspaceId,
        generationMode: dto.generationMode as any,
        templateId: dto.templateId,
        aiPrompt: dto.generationParams?.prompt,
        layout: dto.layoutData as any,
        teamSize: dto.layoutData.metadata?.teamSize || dto.layoutData.desks.length,
        departments: dto.generationParams?.departments || [],
        totalArea: dto.layoutData.dimensions.width * dto.layoutData.dimensions.height,
        deskCount: dto.layoutData.desks.length,
        roomCount: dto.layoutData.rooms.length,
        aiReasoning: dto.layoutData.metadata?.aiReasoning || dto.generationParams?.aiReasoning,
        optimizationScore: dto.layoutData.metadata?.optimizationScore,
      },
    });

    return layout;
  }

  /**
   * Get layout for a workspace
   */
  async getLayout(workspaceId: string) {
    const layout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
      include: {
        deskAssignments: true,
        roomBookings: {
          where: {
            endTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!layout) {
      throw new NotFoundException('No office layout found for this workspace');
    }

    return layout;
  }

  /**
   * Get a specific layout by ID
   */
  async getLayoutById(workspaceId: string, layoutId: string) {
    const layout = await this.prisma.officeLayout.findFirst({
      where: { id: layoutId, workspaceId },
      include: {
        deskAssignments: true,
        roomBookings: {
          where: {
            endTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!layout) {
      throw new NotFoundException('Layout not found');
    }

    return layout;
  }

  /**
   * Update an office layout
   */
  async updateLayout(workspaceId: string, layoutId: string, dto: UpdateOfficeLayoutDto) {
    const layout = await this.prisma.officeLayout.findFirst({
      where: { id: layoutId, workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Layout not found');
    }

    const updateData: any = {
      version: { increment: 1 },
      previousVersionId: layout.id,
    };

    if (dto.layoutData) {
      updateData.layout = dto.layoutData;
      updateData.totalArea = dto.layoutData.dimensions.width * dto.layoutData.dimensions.height;
      updateData.deskCount = dto.layoutData.desks.length;
      updateData.roomCount = dto.layoutData.rooms.length;
      updateData.teamSize = dto.layoutData.metadata?.teamSize || dto.layoutData.desks.length;
      updateData.optimizationScore = dto.layoutData.metadata?.optimizationScore;
    }

    if (dto.generationMode) {
      updateData.generationMode = dto.generationMode;
    }

    return this.prisma.officeLayout.update({
      where: { id: layoutId },
      data: updateData,
    });
  }

  /**
   * Delete an office layout
   */
  async deleteLayout(workspaceId: string, layoutId: string) {
    const layout = await this.prisma.officeLayout.findFirst({
      where: { id: layoutId, workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Layout not found');
    }

    return this.prisma.officeLayout.delete({
      where: { id: layoutId },
    });
  }

  // ==================== DESK ASSIGNMENTS ====================

  /**
   * Assign a desk to a user
   */
  async assignDesk(workspaceId: string, dto: CreateDeskAssignmentDto) {
    // Get layout for workspace
    const layout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Office layout not found');
    }

    // Check if desk exists in layout
    const layoutData = layout.layout as any;
    const deskExists = layoutData.desks?.some((d: any) => d.id === dto.deskId);
    if (!deskExists) {
      throw new BadRequestException('Desk not found in layout');
    }

    // Check for existing assignment on this desk
    const existingDeskAssignment = await this.prisma.deskAssignment.findUnique({
      where: {
        officeLayoutId_deskId: {
          officeLayoutId: layout.id,
          deskId: dto.deskId,
        },
      },
    });

    if (existingDeskAssignment) {
      throw new ConflictException('Desk is already assigned');
    }

    return this.prisma.deskAssignment.create({
      data: {
        officeLayoutId: layout.id,
        deskId: dto.deskId,
        userId: dto.userId,
        isHotDesk: !dto.isPermanent,
        reservedFrom: dto.startDate ? new Date(dto.startDate) : null,
        reservedTo: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  /**
   * Get desk assignments for a workspace
   */
  async getDeskAssignments(workspaceId: string) {
    const layout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Office layout not found');
    }

    return this.prisma.deskAssignment.findMany({
      where: { officeLayoutId: layout.id },
    });
  }

  /**
   * Release a desk assignment
   */
  async releaseDeskAssignment(workspaceId: string, assignmentId: string) {
    const assignment = await this.prisma.deskAssignment.findUnique({
      where: { id: assignmentId },
      include: { officeLayout: true },
    });

    if (!assignment || assignment.officeLayout.workspaceId !== workspaceId) {
      throw new NotFoundException('Assignment not found');
    }

    return this.prisma.deskAssignment.delete({
      where: { id: assignmentId },
    });
  }

  // ==================== MEETING ROOM BOOKINGS ====================

  /**
   * Book a meeting room
   */
  async bookMeetingRoom(workspaceId: string, dto: CreateMeetingBookingDto, userId: string) {
    const layout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Office layout not found');
    }

    // Check if room exists in layout
    const layoutData = layout.layout as any;
    const roomExists = layoutData.rooms?.some((r: any) => r.id === dto.roomId);
    if (!roomExists) {
      throw new BadRequestException('Room not found in layout');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check for overlapping bookings
    const overlapping = await this.prisma.meetingRoomBooking.findFirst({
      where: {
        officeLayoutId: layout.id,
        roomId: dto.roomId,
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Room is already booked for this time slot');
    }

    return this.prisma.meetingRoomBooking.create({
      data: {
        officeLayoutId: layout.id,
        roomId: dto.roomId,
        userId,
        title: dto.title,
        description: dto.description,
        startTime,
        endTime,
        attendees: dto.attendeeIds || [],
        isRecurring: dto.isRecurring || false,
      },
    });
  }

  /**
   * Get room bookings
   */
  async getRoomBookings(workspaceId: string, query: GetBookingsQueryDto) {
    const layout = await this.prisma.officeLayout.findUnique({
      where: { workspaceId },
    });

    if (!layout) {
      throw new NotFoundException('Office layout not found');
    }

    const where: any = { officeLayoutId: layout.id };

    if (query.roomId) {
      where.roomId = query.roomId;
    }

    if (query.startDate) {
      where.startTime = { gte: new Date(query.startDate) };
    }

    if (query.endDate) {
      where.endTime = { lte: new Date(query.endDate) };
    }

    return this.prisma.meetingRoomBooking.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(workspaceId: string, bookingId: string, userId: string) {
    const booking = await this.prisma.meetingRoomBooking.findUnique({
      where: { id: bookingId },
      include: { officeLayout: true },
    });

    if (!booking || booking.officeLayout.workspaceId !== workspaceId) {
      throw new NotFoundException('Booking not found');
    }

    // Only the person who booked can cancel
    if (booking.userId !== userId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    return this.prisma.meetingRoomBooking.delete({
      where: { id: bookingId },
    });
  }

  // ==================== TEMPLATES ====================

  /**
   * Get available office templates
   */
  async getTemplates(category?: string) {
    const where: any = {};
    if (category) {
      where.category = category;
    }

    return this.prisma.officeTemplate.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a template by ID
   */
  async getTemplateById(templateId: string) {
    const template = await this.prisma.officeTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }
}
