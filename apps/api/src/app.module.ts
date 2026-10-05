import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    AuthModule,
    HealthModule,
    // Feature modules get added here, one per folder:
    // UsersModule, InvitationsModule              (Mira)
    // WorkspacesModule, OfficeModule              (Roy)
    // TasksModule, VoiceModule, MeetingsModule    (Zakaria)
  ],
})
export class AppModule {}
