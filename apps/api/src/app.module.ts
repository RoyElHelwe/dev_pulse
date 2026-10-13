/**
 * Root NestJS application module.
 * Wires together configuration, database, authentication, real-time gateways, feature modules, and global middleware.
 */
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { OriginMiddleware } from './common/origin.middleware';
import { ConfigModule } from './config/config.module';
import { devImports } from './dev/dev.module';
import { ChatModule } from './chat/chat.module';
import { GamesModule } from './games/games.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { OfficeModule } from './office/office.module';
import { MailModule } from './mail/mail.module';
import { MeetingRoomModule } from './meeting-room/meeting-room.module';
import { MeetingsModule } from './meetings/meetings.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { VoiceModule } from './voice/voice.module';
import { WorkspaceModule } from './workspace/workspace.module';

const DEFAULT_THROTTLE_TTL_MS = 60_000;
const DEFAULT_THROTTLE_LIMIT = 300;

/** Root NestJS module wiring core infrastructure, feature domains, and global middleware. */
@Module({
  imports: [
    // Baseline rate limit per client IP; sensitive auth endpoints override this with strict @Throttle limits.
    ThrottlerModule.forRoot([{ ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT }]),
    ConfigModule,
    PrismaModule,
    MailModule,
    AuthModule,
    WorkspaceModule,
    InvitationsModule,
    OfficeModule,
    MeetingsModule,
    VoiceModule,
    MeetingRoomModule,
    KitchenModule,
    ChatModule,
    GamesModule,
    TasksModule,
    SettingsModule,
    HealthModule,
    // Dev/test only (dev sign-in, dev:teleport): empty unless DEV_LOGIN=true outside production.
    ...devImports(process.env),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CSRF protection: verify Origin header on state-changing requests across all API routes.
    // `*path` is Nest 11's named wildcard (a bare `*` is legacy syntax and logs a warning).
    consumer.apply(OriginMiddleware).forRoutes('*path');
  }
}

