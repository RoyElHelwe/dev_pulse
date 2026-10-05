import { Global, Module } from '@nestjs/common';
import { OfficeController } from '../office/office.controller';
import { MembersService } from './members.service';
import { MembershipService } from './membership.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceEvents } from './workspace-events';
import { WorkspaceService } from './workspace.service';

@Global()
@Module({
  controllers: [WorkspaceController, OfficeController],
  providers: [WorkspaceService, MembersService, MembershipService, WorkspaceEvents],
  exports: [MembershipService, WorkspaceEvents],
})
export class WorkspaceModule {}
