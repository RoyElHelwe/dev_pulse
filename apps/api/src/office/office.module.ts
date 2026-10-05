import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OfficeController } from './office.controller';
import { OfficeGateway } from './office.gateway';

@Module({
  imports: [AuthModule],
  controllers: [OfficeController],
  providers: [OfficeGateway],
})
export class OfficeModule {}
