// Booking types and local-time manipulation helpers for meeting room reservations.
// Fits into the meetings feature, ensuring all timetable calculations use the browser's local time zone.

/** GET /api/workspace/bookings item. */
export interface Booking {
  id: string;
  roomId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  createdById: string;
  createdByName: string;
  attendeeIds: string[];
}

export interface Member {
  userId: string;
  displayName: string;
}

/** The timetable shows 08:00–20:00 in 30-minute rows. */
const TIMETABLE_FIRST_HOUR = 8;
const TIMETABLE_LAST_HOUR = 20;
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;

export const ROW_MINUTES = 30;
export const ROWS = ((TIMETABLE_LAST_HOUR - TIMETABLE_FIRST_HOUR) * MINUTES_PER_HOUR) / ROW_MINUTES;

/** Bookings move in 15-minute steps and last 4 hours at most (same rules as the API). */
export const STEP_MINUTES = 15;
export const MAX_MINUTES = 4 * MINUTES_PER_HOUR;

/** Truncates a Date to midnight at the start of that local day. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Adds a given number of days to a Date, returning a new Date instance. */
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Returns a Date representing a specific minute offset after midnight of a day (DST-safe). */
export const atMinutes = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);

/** Calculates the Date corresponding to the start of a specific timetable row. */
export const rowTime = (day: Date, row: number) => atMinutes(day, TIMETABLE_FIRST_HOUR * MINUTES_PER_HOUR + row * ROW_MINUTES);

/** Returns the total number of minutes elapsed since midnight for a given Date. */
export const minutesOf = (d: Date) => d.getHours() * MINUTES_PER_HOUR + d.getMinutes();

/** Formats a Date into a 24-hour time string ("14:05"). */
export function hm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Formats minutes elapsed since midnight into a "14:00" 24-hour clock string. */
export function clockOf(minutes: number) {
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

/** Formats a Date into a human-readable relative day label ("Today · Mon 5 Oct", "Tomorrow · ..."). */
export function dayLabel(day: Date, today: Date) {
  const date = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / MS_PER_DAY);
  if (diff === 0) return `Today · ${date}`;
  if (diff === 1) return `Tomorrow · ${date}`;
  if (diff === -1) return `Yesterday · ${date}`;
  return date;
}

/** Extracts the first name from a full display name string. */
export const firstName = (name: string) => name.split(' ')[0] || name;
