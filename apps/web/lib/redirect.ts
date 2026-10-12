// Redirection utilities ensuring links remain within the current application origin.

/** Same rule as the API: only paths on our own site ("/office"), never another website. */
export function safeRedirect(target: string | null | undefined, fallback = '/office') {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}

/**
 * Navigation right after signing in or out: a full page load, not router.replace. Pages the
 * router prefetched before the change are cached with the old answer (e.g. /office → "sign
 * in first"), so a client-side navigation would bounce back to /login until a manual refresh.
 */
export function navigateAfterAuthChange(path: string) {
  window.location.replace(path);
}
