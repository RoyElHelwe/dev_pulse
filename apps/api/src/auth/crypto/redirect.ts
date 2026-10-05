/**
 * Only allows redirects to a path on our own site ("/office"), never to
 * another site ("https://evil.com", "//evil.com"), so links can't be abused.
 */
export function safeRedirect(target: unknown, fallback = '/office'): string {
  if (typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
