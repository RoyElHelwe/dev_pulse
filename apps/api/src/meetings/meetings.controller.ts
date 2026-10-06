import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CreateBookingDto, ListBookingsDto } from './dto';
import { MeetingsService } from './meetings.service';

/** Meeting room bookings of the caller's office. */
@Controller('workspace/bookings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBookingsDto) {
    return this.meetings.list(user.id, query.from, query.to);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.meetings.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.cancel(user.id, id);
  }
}
