import { Module } from '@nestjs/common';
import { WorkspaceModule } from './workspace/workspace.module';
import { InvitationModule } from './invitation/invitation.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, WorkspaceModule, InvitationModule],
})
export class AppModule {}
