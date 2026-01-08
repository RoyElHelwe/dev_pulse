/**
 * Office Layout Controller
 * 
 * REST API endpoints for office layouts, desk assignments, and room bookings
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OfficeService } from './office.service';
import {
  CreateOfficeLayoutDto,
  UpdateOfficeLayoutDto,
  CreateDeskAssignmentDto,
  CreateMeetingBookingDto,
  GetBookingsQueryDto,
} from './dto';

// Note: Add proper authentication guard when integrating with auth-service
// @UseGuards(AuthGuard)
@Controller('workspaces/:workspaceId/office')
export class OfficeController {
  constructor(private readonly officeService: OfficeService) {}

  // ==================== LAYOUT ====================

  /**
   * Create or update office layout for workspace
   */
  @Post('layout')
  async createLayout(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateOfficeLayoutDto,
  ) {
    return this.officeService.createLayout(workspaceId, dto);
  }

  /**
   * Get the office layout for workspace
   */
  @Get('layout')
  async getLayout(@Param('workspaceId') workspaceId: string) {
    return this.officeService.getLayout(workspaceId);
  }

  /**
   * Update the office layout
   */
  @Put('layout')
  async updateLayout(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateOfficeLayoutDto,
  ) {
    // Get the layout ID first
    const layout = await this.officeService.getLayout(workspaceId);
    return this.officeService.updateLayout(workspaceId, layout.id, dto);
  }

  /**
   * Delete the office layout
   */
  @Delete('layout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLayout(@Param('workspaceId') workspaceId: string) {
    const layout = await this.officeService.getLayout(workspaceId);
    await this.officeService.deleteLayout(workspaceId, layout.id);
  }

  // ==================== DESK ASSIGNMENTS ====================

  /**
   * Get desk assignments
   */
  @Get('desks')
  async getDeskAssignments(@Param('workspaceId') workspaceId: string) {
    return this.officeService.getDeskAssignments(workspaceId);
  }

  /**
   * Assign a desk to a user
   */
  @Post('desks')
  async assignDesk(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDeskAssignmentDto,
  ) {
    return this.officeService.assignDesk(workspaceId, dto);
  }

  /**
   * Release a desk assignment
   */
  @Delete('desks/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async releaseDeskAssignment(
    @Param('workspaceId') workspaceId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    await this.officeService.releaseDeskAssignment(workspaceId, assignmentId);
  }

  // ==================== MEETING ROOM BOOKINGS ====================

  /**
   * Get room bookings
   */
  @Get('bookings')
  async getRoomBookings(
    @Param('workspaceId') workspaceId: string,
    @Query() query: GetBookingsQueryDto,
  ) {
    return this.officeService.getRoomBookings(workspaceId, query);
  }

  /**
   * Book a meeting room
   */
  @Post('bookings')
  async bookMeetingRoom(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateMeetingBookingDto,
    @Request() req: any,
  ) {
    // TODO: Get userId from authenticated request
    const userId = req.user?.id || 'system';
    return this.officeService.bookMeetingRoom(workspaceId, dto, userId);
  }

  /**
   * Cancel a booking
   */
  @Delete('bookings/:bookingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBooking(
    @Param('workspaceId') workspaceId: string,
    @Param('bookingId') bookingId: string,
    @Request() req: any,
  ) {
    // TODO: Get userId from authenticated request
    const userId = req.user?.id || 'system';
    await this.officeService.cancelBooking(workspaceId, bookingId, userId);
  }

  // ==================== TEMPLATES ====================

  /**
   * Get available office templates
   */
  @Get('templates')
  async getTemplates(@Query('category') category?: string) {
    return this.officeService.getTemplates(category);
  }

  /**
   * Get a template by ID
   */
  @Get('templates/:templateId')
  async getTemplateById(@Param('templateId') templateId: string) {
    return this.officeService.getTemplateById(templateId);
  }
}
