// Pure chat rules (no Nest, no database), so they are easy to test.

import { ZONE_ID } from '../office/rules';

export const MAX_LENGTH = 500;
export const RATE_LIMIT = { count: 5, windowMs: 5000 };
export const HISTORY_PAGE = 50;
/** The channel everyone in the office reads; any other channel is a layout room id. */
export const OFFICE_CHANNEL = 'office';

export type ChatErrorCode = 'BAD_MESSAGE' | 'BAD_CHANNEL' | 'TOO_FAST' | 'NOT_IN_ROOM' | 'NOT_ATTENDEE' | 'SERVER_ERROR';

export const CHAT_ERRORS: Record<ChatErrorCode, string> = {
  BAD_MESSAGE: `Messages are 1 to ${MAX_LENGTH} characters.`,
  BAD_CHANNEL: 'Unknown chat channel.',
  TOO_FAST: 'You are sending messages too fast. Wait a few seconds.',
  NOT_IN_ROOM: 'Room chat is only for the people in that room.',
  NOT_ATTENDEE: 'This room is booked: only the attendees can use its chat.',
  SERVER_ERROR: 'The message could not be sent. Try again.',
};

/** The trimmed text, or null when it is empty, too long or not text. */
export function cleanText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text.length >= 1 && text.length <= MAX_LENGTH ? text : null;
}

export function isChannel(raw: unknown): raw is string {
  return typeof raw === 'string' && ZONE_ID.test(raw);
}

/**
 * May this person read or write `channel`? The office channel is open to every
 * member; a room channel only to the people standing in that room (meeting
 * room or lounge) and, while the room is booked, only to its attendees.
 */
export function channelAccess(
  channel: string,
  userId: string,
  room: { id: string; kind: string } | null,
  booking: { attendeeIds: string[] } | null,
): ChatErrorCode | null {
  if (channel === OFFICE_CHANNEL) return null;
  if (!room || room.id !== channel || room.kind === 'open') return 'NOT_IN_ROOM';
  if (booking && !booking.attendeeIds.includes(userId)) return 'NOT_ATTENDEE';
  return null;
}

/** At most `count` messages per person in any `windowMs` (sliding window, in memory). */
export class RateLimiter {
  private readonly sent = new Map<string, number[]>();
  private prunedAt = 0;

  constructor(
    private readonly count = RATE_LIMIT.count,
    private readonly windowMs = RATE_LIMIT.windowMs,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.sent.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.count) {
      this.sent.set(key, recent);
      return false;
    }
    recent.push(now);
    this.sent.set(key, recent);
    // Forget people who went quiet (at most once per window), so the map doesn't grow forever.
    if (this.sent.size > 1000 && now - this.prunedAt >= this.windowMs) {
      this.prunedAt = now;
      for (const [k, times] of this.sent) if (times.every((t) => now - t >= this.windowMs)) this.sent.delete(k);
    }
    return true;
  }
}
