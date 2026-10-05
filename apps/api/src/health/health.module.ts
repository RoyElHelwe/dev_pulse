import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './health.controller';
import { HealthGateway } from './health.gateway';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [HealthGateway],
})
export class HealthModule {}
