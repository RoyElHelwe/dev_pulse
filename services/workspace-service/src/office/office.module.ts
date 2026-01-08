/**
 * Office Module
 * 
 * Handles office layout management, desk assignments, and room bookings
 */

import { Module } from '@nestjs/common';
import { OfficeController } from './office.controller';
import { OfficeRpcController } from './office-rpc.controller';
import { OfficeService } from './office.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OfficeController, OfficeRpcController],
  providers: [OfficeService],
  exports: [OfficeService],
})
export class OfficeModule {}
