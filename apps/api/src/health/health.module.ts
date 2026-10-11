/**
 * Health check module.
 * Wires the HTTP health endpoint and minimal WebSocket gateway for liveness and connectivity probes.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthGateway } from './health.gateway';

/** Wires HTTP and WebSocket health inspection endpoints for container orchestration probes. */
@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthGateway],
})
export class HealthModule {}

