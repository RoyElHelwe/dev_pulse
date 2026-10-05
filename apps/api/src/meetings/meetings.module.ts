import { Module } from '@nestjs/common';
import { OfficeModule } from '../office/office.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

/** Meeting room bookings (timetable, no overlaps); voice and chat ask it who may be in a room. */
@Module({
  imports: [OfficeModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
