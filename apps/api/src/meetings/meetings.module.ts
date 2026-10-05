import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

/** Meeting room bookings (placeholder until the meetings feature lands). */
@Module({
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
