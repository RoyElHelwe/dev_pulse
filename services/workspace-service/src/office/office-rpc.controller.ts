/**
 * Office Layout RPC Controller
 * 
 * Handles NATS microservice messages for office layouts from API Gateway
 */

import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { OfficeService } from './office.service';

@Controller()
export class OfficeRpcController {
  constructor(private readonly officeService: OfficeService) {}

  @MessagePattern({ cmd: 'create_office_layout' })
  async createLayout(data: any) {
    const { workspaceId, userId, ...dto } = data;
    // TODO: Add authorization check that userId has access to workspaceId
    return this.officeService.createLayout(workspaceId, dto);
  }

  @MessagePattern({ cmd: 'get_office_layout' })
  async getLayout(data: any) {
    const { workspaceId } = data;
    // TODO: Add authorization check that data.userId has access to workspaceId
    return this.officeService.getLayout(workspaceId);
  }

  @MessagePattern({ cmd: 'update_office_layout' })
  async updateLayout(data: any) {
    const { workspaceId, layoutId, ...dto } = data;
    // TODO: Add authorization check that data.userId has access to workspaceId
    // For now, get the layout ID from the workspace
    const layout = await this.officeService.getLayout(workspaceId);
    return this.officeService.updateLayout(workspaceId, layout.id, dto);
  }

  @MessagePattern({ cmd: 'delete_office_layout' })
  async deleteLayout(data: any) {
    const { workspaceId } = data;
    // TODO: Add authorization check that data.userId has access to workspaceId
    const layout = await this.officeService.getLayout(workspaceId);
    return this.officeService.deleteLayout(workspaceId, layout.id);
  }
}
