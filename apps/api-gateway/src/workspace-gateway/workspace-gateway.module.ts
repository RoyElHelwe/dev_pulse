import { Module } from '@nestjs/common';
import { WorkspaceGatewayController } from './workspace-gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '@ft-trans/database';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'WORKSPACE_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL!],
        },
      },
    ]),
    AuthModule,
    PrismaModule,
  ],
  controllers: [WorkspaceGatewayController],
})
export class WorkspaceGatewayModule {}
