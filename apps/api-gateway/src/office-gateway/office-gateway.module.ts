import { Module } from '@nestjs/common';
import { OfficeGatewayController } from './office-gateway.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OfficeGatewayController],
})
export class OfficeGatewayModule {}
