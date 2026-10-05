import { Injectable } from '@nestjs/common';
import { MeetingsService } from '../meetings/meetings.service';
import { OfficeGateway } from '../office/office.gateway';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHAT_ERRORS,
  type ChatErrorCode,
  HISTORY_PAGE,
  OFFICE_CHANNEL,
  RateLimiter,
  channelAccess,
  cleanText,
  isChannel,
} from './chat.rules';

/** What clients receive (`chat:message`, history). */
export interface ChatMessageDto {
  id: string;
  channel: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}

export type SendResult = { ok: true; message: ChatMessageDto } | { ok: false; error: { code: ChatErrorCode; message: string } };

const fail = (code: ChatErrorCode) => ({ ok: false as const, error: { code, message: CHAT_ERRORS[code] } });

const toDto = (m: { id: string; channel: string; userId: string; text: string; createdAt: Date; user: { displayName: string } }): ChatMessageDto => ({
  id: m.id,
  channel: m.channel,
  userId: m.userId,
  name: m.user.displayName,
  text: m.text,
  createdAt: m.createdAt.toISOString(),
});

/**
 * Office chat: one channel for the whole office, one per room. Where someone
 * stands comes from the server's own copy of the office, never from the client.
 */
@Injectable()
export class ChatService {
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly office: OfficeGateway,
    private readonly meetings: MeetingsService,
  ) {}

  async send(workspaceId: string, userId: string, body: unknown): Promise<SendResult> {
    const { channel, text: raw } = (body ?? {}) as { channel?: unknown; text?: unknown };
    if (!isChannel(channel)) return fail('BAD_CHANNEL');
    const text = cleanText(raw);
    if (!text) return fail('BAD_MESSAGE');
    const { error, booking } = await this.access(workspaceId, userId, channel);
    if (error) return fail(error);
    if (!this.limiter.allow(userId)) return fail('TOO_FAST');

    const saved = await this.prisma.chatMessage.create({
      data: { workspaceId, channel, userId, text },
      include: { user: { select: { displayName: true } } },
    });
    const message = toDto(saved);
    if (channel === OFFICE_CHANNEL) {
      this.office.broadcast(workspaceId, 'chat:message', message);
    } else {
      // Only the people in the room right now (and, when booked, only its attendees).
      const readers = this.office.peopleIn(workspaceId, channel).filter((id) => !booking || booking.attendeeIds.includes(id));
      for (const id of readers) this.office.sendTo(id, 'chat:message', message);
    }
    return { ok: true, message };
  }

  /** The last 50 messages of a channel (before `before`), oldest first. */
  async history(workspaceId: string, userId: string, channel: string, before?: Date) {
    const { error } = await this.access(workspaceId, userId, channel);
    if (error) return { error: { code: error, message: CHAT_ERRORS[error] } };
    const rows = await this.prisma.chatMessage.findMany({
      where: { workspaceId, channel, ...(before && { createdAt: { lt: before } }) },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE,
      include: { user: { select: { displayName: true } } },
    });
    return { messages: rows.reverse().map(toDto), more: rows.length === HISTORY_PAGE };
  }

  private async access(workspaceId: string, userId: string, channel: string) {
    if (channel === OFFICE_CHANNEL) return { error: null, booking: null };
    const room = this.office.locate(workspaceId, userId)?.room ?? null;
    const booking = room?.id === channel ? await this.meetings.activeBooking(workspaceId, channel) : null;
    return { error: channelAccess(channel, userId, room, booking), booking };
  }
}
