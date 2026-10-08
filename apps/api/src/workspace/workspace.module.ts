import { Global, Module } from '@nestjs/common';
import { DesksService } from './desks.service';
import { LayoutMigrationService } from './layout-migration.service';
import { MembersService } from './members.service';
import { MembershipService } from './membership.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceEvents } from './workspace-events';
import { WorkspaceService } from './workspace.service';

@Global()
@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, MembersService, MembershipService, DesksService, WorkspaceEvents, LayoutMigrationService],
  exports: [MembershipService, DesksService, WorkspaceEvents],
})
export class WorkspaceModule {}
