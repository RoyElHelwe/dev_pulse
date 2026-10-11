/**
 * HTTP controller exposing meeting room timetable queries, booking reservations, and cancellations.
 * Requires user authentication and enforces rate limits on booking creation.
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CreateBookingDto, ListBookingsDto } from './meetings.dto';
import { MeetingsService } from './meetings.service';

const CREATE_BOOKING_RATE_LIMIT = 30;
const CREATE_BOOKING_RATE_TTL_MS = 60_000;

/** REST controller handling meeting room reservations and timetable retrieval. */
@Controller('workspace/bookings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBookingsDto) {
    return this.meetings.list(user.id, query.from, query.to);
  }

  @Post()
  @Throttle({ default: { limit: CREATE_BOOKING_RATE_LIMIT, ttl: CREATE_BOOKING_RATE_TTL_MS } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.meetings.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.cancel(user.id, id);
  }
}

