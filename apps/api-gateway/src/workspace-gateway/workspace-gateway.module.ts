import { Module } from '@nestjs/common';
import { WorkspaceGatewayController } from './workspace-gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'WORKSPACE_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
    AuthModule,
    PrismaModule,
  ],
  controllers: [WorkspaceGatewayController],
})
export class WorkspaceGatewayModule {}
