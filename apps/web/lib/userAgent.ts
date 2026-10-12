// User-agent string parsing and human-readable relative time formatting utilities.

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** "Chrome on macOS" from a user-agent string (good enough for lists and messages). */
export function describeUserAgent(userAgent: string | null | undefined) {
  const ua = userAgent ?? '';
  const browser =
    [
      ['Edg/', 'Edge'],
      ['OPR/', 'Opera'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
      ['curl/', 'curl'],
    ].find(([token]) => ua.includes(token))?.[1] ?? 'Unknown browser';
  const os = [
    ['iPhone', 'iOS'],
    ['iPad', 'iPadOS'],
    ['Android', 'Android'],
    ['Mac OS X', 'macOS'],
    ['Windows', 'Windows'],
    ['Linux', 'Linux'],
  ].find(([token]) => ua.includes(token))?.[1];
  return { browser, label: os ? `${browser} on ${os}` : browser, mobile: /iPhone|Android|iPad/.test(ua) };
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "2 days ago". */
export function timeAgo(date: string | Date) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / MS_PER_MINUTE);
  if (minutes > -1) return 'just now';
  if (minutes > -MINUTES_PER_HOUR) return relative.format(minutes, 'minute');
  if (minutes > -MINUTES_PER_DAY) return relative.format(Math.round(minutes / MINUTES_PER_HOUR), 'hour');
  return relative.format(Math.round(minutes / MINUTES_PER_DAY), 'day');
}
