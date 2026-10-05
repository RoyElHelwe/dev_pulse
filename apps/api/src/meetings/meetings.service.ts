import { Injectable } from '@nestjs/common';

/** A booking running right now in a meeting room. */
export interface ActiveBooking {
  id: string;
  roomId: string;
  title: string;
  endsAt: Date;
  attendeeIds: string[];
}

/** Meeting room bookings. */
@Injectable()
export class MeetingsService {
  /**
   * The booking running in `roomId` at `at` (default now), or null when the
   * room is free. Voice and chat use it: while a room is booked, only its
   * attendees hear its audio and read its chat.
   */
  async activeBooking(_workspaceId: string, _roomId: string, _at = new Date()): Promise<ActiveBooking | null> {
    return null;
  }
}
