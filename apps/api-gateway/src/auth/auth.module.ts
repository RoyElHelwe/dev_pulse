import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth.controller';
import { AuthProxyService } from './auth-proxy.service';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL!],
        },
      },
      {
        name: 'WORKSPACE_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL!],
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthProxyService, AuthGuard],
  exports: [AuthProxyService, AuthGuard],
})
export class AuthModule {}
