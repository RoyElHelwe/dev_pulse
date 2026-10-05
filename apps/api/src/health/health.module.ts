import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthGateway } from './health.gateway';

@Module({
  controllers: [HealthController],
  providers: [HealthGateway],
})
export class HealthModule {}
