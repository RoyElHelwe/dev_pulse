import { Module } from '@nestjs/common';
import { WorkspaceModule } from './workspace/workspace.module';
import { InvitationModule } from './invitation/invitation.module';
import { PrismaModule } from './prisma/prisma.module';
import { OfficeModule } from './office/office.module';

@Module({
  imports: [PrismaModule, WorkspaceModule, InvitationModule, OfficeModule],
})
export class AppModule {}
