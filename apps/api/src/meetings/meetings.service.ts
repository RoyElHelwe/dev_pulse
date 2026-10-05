import { Injectable } from '@nestjs/common';
import { FormError } from '../common/form-error';
import type { OfficeLayout } from '../office/layout/types';
import { OfficeGateway } from '../office/office.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CAN_MANAGE, MembershipService } from '../workspace/membership.service';
import { clock, MAX_ATTENDEES, slotProblem } from './booking-rules';
import type { CreateBookingDto } from './dto';

/** A booking running right now in a meeting room (what voice and chat need of it). */
export interface ActiveBooking {
  id: string;
  attendeeIds: string[];
}

const DAY = 24 * 60 * 60_000;
/** Running bookings are looked up at most every few seconds per room (ICE candidates come in bursts). */
const ACTIVE_CACHE_MS = 3_000;
/** Longest range one list request may cover. */
const MAX_LIST_DAYS = 62;

/** Meeting room bookings: list, book (no overlaps), cancel. */
@Injectable()
export class MeetingsService {
  /** `workspaceId:roomId` → the running booking, cleared when a booking is made or cancelled. */
  private readonly active = new Map<string, { at: number; booking: ActiveBooking | null }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly office: OfficeGateway,
  ) {}

  /**
   * The booking running in `roomId` now, or null when the room is free. Voice and
   * chat use it: while a room is booked, only its attendees hear its audio and
   * read its chat.
   */
  async activeBooking(workspaceId: string, roomId: string): Promise<ActiveBooking | null> {
    const key = `${workspaceId}:${roomId}`;
    const cached = this.active.get(key);
    if (cached && Date.now() - cached.at < ACTIVE_CACHE_MS) return cached.booking;
    const now = new Date();
    const booking = await this.prisma.roomBooking.findFirst({
      where: { workspaceId, roomId, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { id: true, attendeeIds: true },
    });
    if (this.active.size > 1000) this.active.clear();
    this.active.set(key, { at: Date.now(), booking });
    return booking;
  }

  /** Bookings of every meeting room in the caller's office, from `from` (default today) to `to` (default +7 days). */
  async list(userId: string, from?: string, to?: string) {
    const me = await this.membership.require(userId);
    const start = from ? new Date(from) : new Date(new Date().setUTCHours(0, 0, 0, 0));
    let end = to ? new Date(to) : new Date(start.getTime() + 7 * DAY);
    if (end <= start) throw new FormError('BAD_RANGE', 'The end of the range must be after its start.');
    if (end.getTime() - start.getTime() > MAX_LIST_DAYS * DAY) end = new Date(start.getTime() + MAX_LIST_DAYS * DAY);
    const bookings = await this.prisma.roomBooking.findMany({
      where: { workspaceId: me.workspaceId, startsAt: { lt: end }, endsAt: { gt: start } },
      include: { createdBy: { select: { displayName: true } } },
      orderBy: { startsAt: 'asc' },
    });
    return bookings.map(publicBooking);
  }

  async create(userId: string, dto: CreateBookingDto) {
    const me = await this.membership.require(userId);
    const workspaceId = me.workspaceId;
    const room = meetingRooms(me.workspace.layout).find((r) => r.id === dto.roomId);
    if (!room) throw new FormError('NOT_A_MEETING_ROOM', 'This meeting room no longer exists.', 'roomId');

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const problem = slotProblem(startsAt, endsAt);
    if (problem) throw new FormError('BAD_TIME', problem, 'startsAt');

    const attendeeIds = [...new Set([userId, ...dto.attendeeIds])];
    if (attendeeIds.length > MAX_ATTENDEES) throw new FormError('TOO_MANY', `A meeting has ${MAX_ATTENDEES} people at most.`, 'attendeeIds');
    const members = await this.prisma.workspaceMember.count({ where: { workspaceId, userId: { in: attendeeIds } } });
    if (members !== attendeeIds.length) {
      throw new FormError('NOT_A_MEMBER', 'Some of these people are no longer in the office.', 'attendeeIds');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      // One booking at a time per room: a second request waits here, then sees the first one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${workspaceId}:${room.id}`}))`;
      const clash = await tx.roomBooking.findFirst({
        where: { workspaceId, roomId: room.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        include: { createdBy: { select: { displayName: true } } },
        orderBy: { startsAt: 'asc' },
      });
      if (clash) {
        const when = `${clock(clash.startsAt, dto.timeZone)}–${clock(clash.endsAt, dto.timeZone)}`;
        const by = clash.createdById === userId ? 'you' : firstName(clash.createdBy.displayName);
        throw new FormError('ROOM_TAKEN', `${room.name} is booked ${when} by ${by}.`, 'startsAt');
      }
      return tx.roomBooking.create({
        data: { workspaceId, roomId: room.id, title: dto.title, startsAt, endsAt, createdById: userId, attendeeIds },
        include: { createdBy: { select: { displayName: true } } },
      });
    });
    this.changed(workspaceId, room.id);
    return publicBooking(booking);
  }

  /** The creator, or an owner/admin, cancels a booking that isn't over. */
  async cancel(userId: string, bookingId: string) {
    const me = await this.membership.require(userId);
    const booking = await this.prisma.roomBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.workspaceId !== me.workspaceId) throw new FormError('NOT_FOUND', 'This booking no longer exists.');
    if (booking.createdById !== userId && !CAN_MANAGE.includes(me.role)) {
      throw new FormError('NOT_ALLOWED', 'Only the person who booked it (or an organiser) can cancel it.');
    }
    if (booking.endsAt <= new Date()) throw new FormError('OVER', 'This meeting is already over.');
    await this.prisma.roomBooking.delete({ where: { id: bookingId } });
    this.changed(me.workspaceId, booking.roomId);
  }

  /** Voice and chat see the change at once; everyone in the office reloads the bookings. */
  private changed(workspaceId: string, roomId: string) {
    this.active.delete(`${workspaceId}:${roomId}`);
    this.office.broadcast(workspaceId, 'office:bookings', { changed: true });
  }
}

function meetingRooms(layout: unknown) {
  return ((layout as OfficeLayout | null)?.rooms ?? []).filter((r) => r.kind === 'meeting');
}

function firstName(name: string) {
  return name.split(' ')[0] || name;
}

function publicBooking(b: {
  id: string;
  roomId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  createdById: string;
  attendeeIds: string[];
  createdBy: { displayName: string };
}) {
  return {
    id: b.id,
    roomId: b.roomId,
    title: b.title,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    createdById: b.createdById,
    createdByName: b.createdBy.displayName,
    attendeeIds: b.attendeeIds,
  };
}
