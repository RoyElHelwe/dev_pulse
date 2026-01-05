import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthGuard } from './guards/auth.guard'
import { PrismaService } from '../prisma/prisma.service'

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
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PrismaService],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
