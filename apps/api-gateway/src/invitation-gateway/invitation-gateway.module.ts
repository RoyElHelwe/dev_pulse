import { Module } from '@nestjs/common';
import { InvitationGatewayController } from './invitation-gateway.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule, PrismaService } from '@ft-trans/database';

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
  ],
  controllers: [InvitationGatewayController],
  providers: [PrismaService],
})
export class InvitationGatewayModule {}
