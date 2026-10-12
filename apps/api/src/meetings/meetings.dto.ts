/**
 * Data transfer objects and validation rules for meeting room reservation endpoints.
 * Validates payload schema, string bounds, and attendee list constraints before service processing.
 */

import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { MAX_ATTENDEES } from './meetings.rules';

const MAX_ROOM_ID_LENGTH = 40;
const MAX_TITLE_LENGTH = 80;
const MAX_TIMEZONE_LENGTH = 64;

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

/** Request payload for reserving a meeting room timeslot and inviting members. */
export class CreateBookingDto {
  @IsString()
  @Length(1, MAX_ROOM_ID_LENGTH)
  roomId: string;

  @trim()
  @IsString()
  @Length(1, MAX_TITLE_LENGTH, { message: `Give the meeting a title (${MAX_TITLE_LENGTH} characters at most).` })
  title: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;

  /** Who may join; the creator is always added. */
  @IsArray()
  @ArrayMaxSize(MAX_ATTENDEES, { message: `A meeting has ${MAX_ATTENDEES} people at most.` })
  @IsString({ each: true })
  @Length(1, MAX_ROOM_ID_LENGTH, { each: true })
  attendeeIds: string[];

  /** The browser's time zone, so messages say "14:00" the way the person reads it. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TIMEZONE_LENGTH)
  timeZone?: string;
}

/** Query parameters for listing bookings across a designated date window. */
export class ListBookingsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

