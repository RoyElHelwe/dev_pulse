import { Module } from '@nestjs/common';
import {
  TaskGatewayController,
  SprintGatewayController,
  BlockchainGatewayController,
} from './task-gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '@ft-trans/database';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TASK_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL!],
        },
      },
    ]),
    AuthModule,
    PrismaModule,
    WebsocketModule,
  ],
  controllers: [
    TaskGatewayController,
    SprintGatewayController,
    BlockchainGatewayController,
  ],
})
export class TaskGatewayModule {}
