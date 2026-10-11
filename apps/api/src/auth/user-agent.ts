/**
 * User agent string parser.
 * Converts raw browser User-Agent headers into human-readable descriptions for security emails and session lists.
 */

/** Formats a User-Agent string into a friendly label like "Chrome on macOS". */
export function describeUserAgent(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  const browser =
    [
      ['Edg/', 'Edge'],
      ['OPR/', 'Opera'],
      ['Firefox/', 'Firefox'],
      ['Chrome/', 'Chrome'],
      ['Safari/', 'Safari'],
      ['curl/', 'curl'],
    ].find(([token]) => ua.includes(token))?.[1] ?? 'an unknown browser';
  const os = [
    ['iPhone', 'iOS'],
    ['iPad', 'iPadOS'],
    ['Android', 'Android'],
    ['Mac OS X', 'macOS'],
    ['Windows', 'Windows'],
    ['Linux', 'Linux'],
  ].find(([token]) => ua.includes(token))?.[1];
  return os ? `${browser} on ${os}` : browser;
}

