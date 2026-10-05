import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { OriginMiddleware } from './common/origin.middleware';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    // Default limit per client IP; sensitive routes set lower ones with @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ConfigModule,
    PrismaModule,
    MailModule,
    AuthModule,
    WorkspaceModule,
    HealthModule,
    // Feature modules get added here, one per folder:
    // UsersModule, InvitationsModule              (Mira)
    // WorkspacesModule, OfficeModule              (Roy)
    // TasksModule, VoiceModule, MeetingsModule    (Zakaria)
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginMiddleware).forRoutes('*');
  }
}
