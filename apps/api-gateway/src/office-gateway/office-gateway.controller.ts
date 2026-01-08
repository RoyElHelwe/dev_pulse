/**
 * Office Gateway Controller
 * 
 * Proxies office-related requests to the workspace-service
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
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Request as ExpressRequest } from 'express';
import axios from 'axios';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@Controller('workspaces/:workspaceId/office')
@UseGuards(AuthGuard)
export class OfficeGatewayController {
  private readonly workspaceServiceUrl = process.env.WORKSPACE_SERVICE_URL || 'http://workspace-service:3002';

  /**
   * Proxy a request to the workspace-service
   */
  private async proxyRequest(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    data?: any,
    params?: any,
  ) {
    try {
      const url = `${this.workspaceServiceUrl}${path}`;
      const response = await axios({
        method,
        url,
        data,
        params,
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data,
          error.response.status,
        );
      }
      throw new HttpException(
        'Service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ==================== LAYOUT ====================

  @Post('layout')
  async createLayout(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.proxyRequest('post', `/workspaces/${workspaceId}/office/layout`, body);
  }

  @Get('layout')
  async getLayout(@Param('workspaceId') workspaceId: string) {
    return this.proxyRequest('get', `/workspaces/${workspaceId}/office/layout`);
  }

  @Put('layout')
  async updateLayout(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.proxyRequest('put', `/workspaces/${workspaceId}/office/layout`, body);
  }

  @Delete('layout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLayout(@Param('workspaceId') workspaceId: string) {
    return this.proxyRequest('delete', `/workspaces/${workspaceId}/office/layout`);
  }

  // ==================== DESK ASSIGNMENTS ====================

  @Get('desks')
  async getDeskAssignments(@Param('workspaceId') workspaceId: string) {
    return this.proxyRequest('get', `/workspaces/${workspaceId}/office/desks`);
  }

  @Post('desks')
  async assignDesk(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
  ) {
    return this.proxyRequest('post', `/workspaces/${workspaceId}/office/desks`, body);
  }

  @Delete('desks/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async releaseDeskAssignment(
    @Param('workspaceId') workspaceId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.proxyRequest('delete', `/workspaces/${workspaceId}/office/desks/${assignmentId}`);
  }

  // ==================== MEETING ROOM BOOKINGS ====================

  @Get('bookings')
  async getRoomBookings(
    @Param('workspaceId') workspaceId: string,
    @Query() query: any,
  ) {
    return this.proxyRequest('get', `/workspaces/${workspaceId}/office/bookings`, undefined, query);
  }

  @Post('bookings')
  async bookMeetingRoom(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.proxyRequest('post', `/workspaces/${workspaceId}/office/bookings`, {
      ...body,
      userId: req.user.id,
    });
  }

  @Delete('bookings/:bookingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBooking(
    @Param('workspaceId') workspaceId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.proxyRequest('delete', `/workspaces/${workspaceId}/office/bookings/${bookingId}`);
  }

  // ==================== TEMPLATES ====================

  @Get('templates')
  async getTemplates(@Query('category') category?: string) {
    return this.proxyRequest('get', '/workspaces/:workspaceId/office/templates', undefined, { category });
  }

  @Get('templates/:templateId')
  async getTemplateById(@Param('templateId') templateId: string) {
    return this.proxyRequest('get', `/workspaces/:workspaceId/office/templates/${templateId}`);
  }
}
