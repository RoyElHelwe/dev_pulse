/**
 * NestJS module providing meeting room booking domain logic, conflict locking, and schedule endpoints.
 * Exports MeetingsService for active room verification by voice and chat features.
 */

import { Module } from '@nestjs/common';
import { OfficeModule } from '../office/office.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

/** NestJS module managing meeting room reservations, scheduling, and live booking checks. */
@Module({
  imports: [OfficeModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}

