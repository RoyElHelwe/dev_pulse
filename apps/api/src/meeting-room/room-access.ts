/**
 * Who may use a meeting room's shared tools (screen share, whiteboard) right now.
 * Same rule as room voice and room chat: stand in the room, and be invited when it is booked.
 */

import { Injectable } from '@nestjs/common';
import { MeetingsService } from '../meetings/meetings.service';
import { OfficeGateway } from '../office/office.gateway';
import { bookingAllows } from '../voice/voice.rules';

/** Checks room presence (server's copy of positions) and the running booking's attendee list. */
@Injectable()
export class RoomAccess {
  constructor(
    private readonly office: OfficeGateway,
    private readonly meetings: MeetingsService,
  ) {}

  /** The person stands in this meeting room and the running booking (if any) invites them. */
  async allows(workspaceId: string, userId: string, roomId: string): Promise<boolean> {
    const room = this.office.locate(workspaceId, userId)?.room;
    if (room?.id !== roomId || room.kind !== 'meeting') return false;
    return bookingAllows(await this.booking(workspaceId, roomId), userId, userId);
  }

  /** Everyone in the room who may see what happens there. */
  async audience(workspaceId: string, roomId: string): Promise<string[]> {
    const booking = await this.booking(workspaceId, roomId);
    return this.office.peopleIn(workspaceId, roomId).filter((id) => bookingAllows(booking, id, id));
  }

  /** Fails closed: a database error treats the room as booked by nobody. */
  private booking(workspaceId: string, roomId: string) {
    return this.meetings
      .activeBooking(workspaceId, roomId)
      .catch(() => ({ attendeeIds: [] as string[] }));
  }
}
