import { Module } from '@nestjs/common';
import { InvitationGatewayController } from './invitation-gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

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
  ],
  controllers: [InvitationGatewayController],
  providers: [PrismaService],
})
export class InvitationGatewayModule {}
