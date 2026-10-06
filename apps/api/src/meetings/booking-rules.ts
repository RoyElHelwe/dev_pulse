// Pure booking rules (no database), shared by the service and its tests.

export const SLOT_MINUTES = 15;
export const MAX_HOURS = 4;
export const MAX_DAYS_AHEAD = 30;
export const MAX_ATTENDEES = 30;

const MINUTE = 60_000;
const SLOT = SLOT_MINUTES * MINUTE;

/** Start of the 15-minute slot `at` falls in. */
export function slotStart(at: Date) {
  return new Date(Math.floor(at.getTime() / SLOT) * SLOT);
}

/** Why this time range can't be booked, or null when it can. */
export function slotProblem(startsAt: Date, endsAt: Date, now = new Date()): string | null {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Pick a start and an end time.';
  if (start % SLOT !== 0 || end % SLOT !== 0) return `Times go in ${SLOT_MINUTES}-minute steps (:00, :15, :30, :45).`;
  if (end <= start) return 'The meeting must end after it starts.';
  if (end - start > MAX_HOURS * 60 * MINUTE) return `A booking lasts ${MAX_HOURS} hours at most.`;
  // The slot running right now is still bookable (a meeting starting "now").
  if (start < slotStart(now).getTime()) return 'This time is already past.';
  if (start > now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * MINUTE) return `Rooms can be booked up to ${MAX_DAYS_AHEAD} days ahead.`;
  return null;
}

/** "14:00" in the given IANA time zone (UTC when unknown). */
export function clock(at: Date, timeZone?: string) {
  const format = (tz: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(at);
  try {
    return format(timeZone || 'UTC');
  } catch {
    return format('UTC');
  }
}
