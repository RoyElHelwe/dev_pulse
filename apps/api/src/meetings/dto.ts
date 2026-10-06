import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { MAX_ATTENDEES } from './booking-rules';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

export class CreateBookingDto {
  @IsString()
  @Length(1, 40)
  roomId: string;

  @trim()
  @IsString()
  @Length(1, 80, { message: 'Give the meeting a title (80 characters at most).' })
  title: string;

  @IsISO8601()
  startsAt: string;

  @IsISO8601()
  endsAt: string;

  /** Who may join; the creator is always added. */
  @IsArray()
  @ArrayMaxSize(MAX_ATTENDEES, { message: `A meeting has ${MAX_ATTENDEES} people at most.` })
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  attendeeIds: string[];

  /** The browser's time zone, so messages say "14:00" the way the person reads it. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}

export class ListBookingsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
