/**
 * Pure booking scheduling rules, time quantization, and slot validation for meeting rooms.
 * Shared between MeetingsService and unit tests without external database dependencies.
 */

const SLOT_MINUTES = 15;
const MAX_HOURS = 4;
const MAX_DAYS_AHEAD = 30;
/** Maximum number of attendees permitted in a single meeting booking. */
export const MAX_ATTENDEES = 30;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SLOT_MS = SLOT_MINUTES * MINUTE_MS;
const MAX_BOOKING_DURATION_MS = MAX_HOURS * HOUR_MS;
const MAX_FUTURE_BOOKING_MS = MAX_DAYS_AHEAD * DAY_MS;

/** Returns the floored timestamp corresponding to the start of the 15-minute interval containing `at`. */
export function slotStart(at: Date) {
  // Quantize down to the nearest slot boundary to prevent fragmented schedule gaps.
  return new Date(Math.floor(at.getTime() / SLOT_MS) * SLOT_MS);
}

/** Evaluates whether a requested booking interval violates slot alignment, duration, or advance limits. */
export function slotProblem(startsAt: Date, endsAt: Date, now = new Date()): string | null {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Pick a start and an end time.';
  if (start % SLOT_MS !== 0 || end % SLOT_MS !== 0) return `Times go in ${SLOT_MINUTES}-minute steps (:00, :15, :30, :45).`;
  if (end <= start) return 'The meeting must end after it starts.';
  if (end - start > MAX_BOOKING_DURATION_MS) return `A booking lasts ${MAX_HOURS} hours at most.`;
  // Allow bookings starting in the current active slot for spontaneous meetings, but reject past slots.
  if (start < slotStart(now).getTime()) return 'This time is already past.';
  if (start > now.getTime() + MAX_FUTURE_BOOKING_MS) return `Rooms can be booked up to ${MAX_DAYS_AHEAD} days ahead.`;
  return null;
}

/** Formats a timestamp into a 24-hour clock string ("14:00") using the requested time zone. */
export function clock(at: Date, timeZone?: string) {
  const format = (tz: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(at);
  try {
    return format(timeZone || 'UTC');
  } catch {
    // If client passes an invalid IANA time zone identifier, fallback safely to UTC.
    return format('UTC');
  }
}

