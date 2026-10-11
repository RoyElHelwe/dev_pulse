/**
 * Safe HTTP redirect validation helper.
 * Prevents open-redirect vulnerabilities by restricting target paths to local relative routes.
 */

/** Validates that a redirect target is a safe local site path, returning fallback if external or malformed. */
export function safeRedirect(target: unknown, fallback = '/office'): string {
  if (typeof target !== 'string') return fallback;
  // Disallow scheme-relative URLs (//) and backslash exploits (/\\) which browsers parse as external domains.
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}

