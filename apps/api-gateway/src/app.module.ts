import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebsocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceGatewayModule } from './workspace-gateway/workspace-gateway.module';
import { InvitationGatewayModule } from './invitation-gateway/invitation-gateway.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Authentication
    AuthModule,

    // WebSocket gateway
    WebsocketModule,

    // Workspace Gateway (Microservice client)
    WorkspaceGatewayModule,

    // Invitation Gateway
    InvitationGatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
