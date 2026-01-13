import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SprintService } from './sprint.service';
import { CreateSprintDto, UpdateSprintDto } from './dto';

@Controller()
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @MessagePattern('sprint.create')
  async createSprint(
    @Payload() data: { userId: string; workspaceId: string; userRole: string; dto: CreateSprintDto },
  ) {
    return this.sprintService.createSprint(data.workspaceId, data.userRole, data.dto);
  }

  @MessagePattern('sprint.findAll')
  async findAllSprints(@Payload() data: { workspaceId: string }) {
    return this.sprintService.findAllSprints(data.workspaceId);
  }

  @MessagePattern('sprint.findOne')
  async findOneSprint(@Payload() data: { sprintId: string; workspaceId: string }) {
    return this.sprintService.findOneSprint(data.sprintId, data.workspaceId);
  }

  @MessagePattern('sprint.update')
  async updateSprint(
    @Payload() data: { sprintId: string; workspaceId: string; userRole: string; dto: UpdateSprintDto },
  ) {
    return this.sprintService.updateSprint(data.sprintId, data.workspaceId, data.userRole, data.dto);
  }

  @MessagePattern('sprint.start')
  async startSprint(
    @Payload() data: { sprintId: string; workspaceId: string; userRole: string },
  ) {
    return this.sprintService.startSprint(data.sprintId, data.workspaceId, data.userRole);
  }

  @MessagePattern('sprint.complete')
  async completeSprint(
    @Payload() data: { sprintId: string; workspaceId: string; userRole: string },
  ) {
    return this.sprintService.completeSprint(data.sprintId, data.workspaceId, data.userRole);
  }

  @MessagePattern('sprint.getActive')
  async getActiveSprint(@Payload() data: { workspaceId: string }) {
    return this.sprintService.getActiveSprint(data.workspaceId);
  }
}
