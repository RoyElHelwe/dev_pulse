/**
 * Core business rules, validation, and in-memory rate limiting for office text chat.
 * Pure logic shared across chat services, controllers, and gateways without DB coupling.
 */

import { ZONE_ID } from '../office/office.rules';

/** Maximum character length permitted for a single chat message body. */
export const MAX_LENGTH = 500;
/** Default message count allowed within the sliding rate limit window. */
const RATE_LIMIT_COUNT = 5;
/** Sliding window duration in milliseconds for chat throttling. */
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT = { count: RATE_LIMIT_COUNT, windowMs: RATE_LIMIT_WINDOW_MS };
/** Number of messages fetched per history page request. */
export const HISTORY_PAGE = 50;
/** The channel everyone in the office reads; any other channel is a layout room id. */
export const OFFICE_CHANNEL = 'office';
/** Threshold of tracked users before triggering cache pruning to bound memory. */
const PRUNE_THRESHOLD_KEYS = 1000;

/** Error identifiers returned on chat validation or authorization failures. */
export type ChatErrorCode = 'BAD_MESSAGE' | 'BAD_CHANNEL' | 'TOO_FAST' | 'NOT_IN_ROOM' | 'NOT_ATTENDEE' | 'SERVER_ERROR';

/** User-facing error messages mapped to each chat error code. */
export const CHAT_ERRORS: Record<ChatErrorCode, string> = {
  BAD_MESSAGE: `Messages are 1 to ${MAX_LENGTH} characters.`,
  BAD_CHANNEL: 'Unknown chat channel.',
  TOO_FAST: 'You are sending messages too fast. Wait a few seconds.',
  NOT_IN_ROOM: 'Room chat is only for the people in that room.',
  NOT_ATTENDEE: 'This room is booked: only the attendees can use its chat.',
  SERVER_ERROR: 'The message could not be sent. Try again.',
};

/** Validates and normalizes raw text input, returning null if invalid or over length limit. */
export function cleanText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text.length >= 1 && text.length <= MAX_LENGTH ? text : null;
}

/** Validates whether an identifier conforms to the expected channel/zone slug syntax. */
export function isChannel(raw: unknown): raw is string {
  return typeof raw === 'string' && ZONE_ID.test(raw);
}

/** Evaluates whether a user is permitted to read or write to a specific chat channel. */
export function channelAccess(
  channel: string,
  userId: string,
  room: { id: string; kind: string } | null,
  booking: { attendeeIds: string[] } | null,
): ChatErrorCode | null {
  // Office channel is a public space broadcast available to all workspace members.
  if (channel === OFFICE_CHANNEL) return null;
  // Room channels require presence inside an enclosed room; open spaces do not have isolated channels.
  if (!room || room.id !== channel || room.kind === 'open') return 'NOT_IN_ROOM';
  // Booked meeting rooms preserve private conversation exclusively for scheduled attendees.
  if (booking && !booking.attendeeIds.includes(userId)) return 'NOT_ATTENDEE';
  return null;
}

/** In-memory sliding-window rate limiter tracking message frequency per user key. */
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
    if (this.sent.size > PRUNE_THRESHOLD_KEYS && now - this.prunedAt >= this.windowMs) {
      this.prunedAt = now;
      for (const [k, times] of this.sent) if (times.every((t) => now - t >= this.windowMs)) this.sent.delete(k);
    }
    return true;
  }
}

