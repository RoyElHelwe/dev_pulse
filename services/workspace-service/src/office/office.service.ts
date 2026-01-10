/**
 * Office Layout Service
 * 
 * Handles office layout CRUD, desk assignments, and room bookings
 */

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@ft-trans/database';
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

  // ==================== HELPER METHODS ====================

  /**
   * Transform layout data to match frontend OfficeLayoutData structure
   * Converts flat structure (x, y, width, height) to nested structure (position, dimensions)
   */
  private transformLayoutData(layoutData: any): any {
    if (!layoutData) return layoutData;

    return {
      metadata: layoutData.metadata || {},
      dimensions: layoutData.dimensions || { width: 1600, height: 900 },
      zones: (layoutData.zones || []).map((zone: any) => ({
        id: zone.id,
        type: zone.type,
        name: zone.name,
        bounds: zone.bounds || {
          x: zone.x || 0,
          y: zone.y || 0,
          width: zone.width || 0,
          height: zone.height || 0,
        },
        color: zone.color,
        departmentType: zone.departmentType,
        rules: zone.rules || {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: [],
          notificationsEnabled: true,
        },
      })),
      desks: (layoutData.desks || []).map((desk: any) => ({
        id: desk.id,
        position: desk.position || { x: desk.x || 0, y: desk.y || 0 },
        dimensions: desk.dimensions || { width: desk.width || 96, height: desk.height || 64 },
        type: desk.type,
        direction: desk.direction || desk.rotation === 90 || desk.rotation === 270 ? 'east' : 'north',
        zoneId: desk.zoneId,
        assignedUserId: desk.assignedUserId,
        status: desk.status || 'available',
        label: desk.label,
      })),
      rooms: (layoutData.rooms || []).map((room: any) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        bounds: room.bounds || {
          x: room.position?.x || room.x || 0,
          y: room.position?.y || room.y || 0,
          width: room.dimensions?.width || room.width || 128,
          height: room.dimensions?.height || room.height || 128,
        },
        capacity: room.capacity,
        status: room.status || 'available',
        description: room.description,
        equipment: room.equipment || [],
        bookable: room.bookable !== undefined ? room.bookable : true,
      })),
      decorations: (layoutData.decorations || []).map((decoration: any) => ({
        id: decoration.id,
        type: decoration.type,
        position: decoration.position || { x: decoration.x || 0, y: decoration.y || 0 },
        rotation: decoration.rotation || 0,
        scale: decoration.scale || 1,
      })),
      walls: (layoutData.walls || []).map((wall: any) => ({
        id: wall.id,
        start: wall.start || { x: wall.x1 || 0, y: wall.y1 || 0 },
        end: wall.end || { x: wall.x2 || 0, y: wall.y2 || 0 },
        thickness: wall.thickness || 16,
        type: wall.type || 'solid',
      })),
      spawnPoints: (layoutData.spawnPoints || []).map((spawn: any) => ({
        id: spawn.id,
        position: spawn.position || { x: spawn.x || 400, y: spawn.y || 300 },
        type: spawn.type || 'default',
        departmentType: spawn.departmentType,
      })),
      pathways: (layoutData.pathways || []).map((pathway: any) => ({
        id: pathway.id,
        points: pathway.points || [],
        width: pathway.width || 64,
        isMainCorridor: pathway.isMainCorridor || false,
      })),
    };
  }

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

    // Transform the layout data to match frontend structure
    return {
      ...layout,
      layout: this.transformLayoutData(layout.layout),
    };
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

    // Transform the layout data to match frontend structure
    return {
      ...layout,
      layout: this.transformLayoutData(layout.layout),
    };
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

    // Transform the layout data to match frontend structure
    return {
      ...layout,
      layout: this.transformLayoutData(layout.layout),
    };
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

    const updatedLayout = await this.prisma.officeLayout.update({
      where: { id: layoutId },
      data: updateData,
    });

    // Transform the layout data to match frontend structure
    return {
      ...updatedLayout,
      layout: this.transformLayoutData(updatedLayout.layout),
    };
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
