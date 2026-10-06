// Booking types and local-time helpers (the browser's time zone everywhere).

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
export const FIRST_HOUR = 8;
export const LAST_HOUR = 20;
export const ROW_MINUTES = 30;
export const ROWS = ((LAST_HOUR - FIRST_HOUR) * 60) / ROW_MINUTES;
/** Bookings move in 15-minute steps and last 4 hours at most (same rules as the API). */
export const STEP_MINUTES = 15;
export const MAX_MINUTES = 4 * 60;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** `minutes` after midnight of `day` (local time, DST-safe). */
export const atMinutes = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
export const rowTime = (day: Date, row: number) => atMinutes(day, FIRST_HOUR * 60 + row * ROW_MINUTES);
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** "14:05". */
export function hm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "14:00" for minutes after midnight (1440 → "24:00"). */
export function clockOf(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "Today · Mon 5 Oct", "Tomorrow · Tue 6 Oct", "Wed 7 Oct". */
export function dayLabel(day: Date, today: Date) {
  const date = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return `Today · ${date}`;
  if (diff === 1) return `Tomorrow · ${date}`;
  if (diff === -1) return `Yesterday · ${date}`;
  return date;
}

export const firstName = (name: string) => name.split(' ')[0] || name;
