/**
 * Health check module.
 * Wires the HTTP health endpoint and minimal WebSocket gateway for liveness and connectivity probes.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthGateway } from './health.gateway';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthGateway],
})
/** Module providing HTTP and WebSocket health inspection endpoints. */
export class HealthModule {}

