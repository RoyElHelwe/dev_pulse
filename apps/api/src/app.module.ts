import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    // Feature modules get added here, one per folder:
    // AuthModule, UsersModule, InvitationsModule  (Mira)
    // WorkspacesModule, OfficeModule              (Roy)
    // TasksModule, VoiceModule, MeetingsModule    (Zakaria)
  ],
})
export class AppModule {}
