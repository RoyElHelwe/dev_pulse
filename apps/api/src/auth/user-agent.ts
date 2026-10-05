/** "Chrome on macOS" from a user-agent string (for emails and messages). */
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
