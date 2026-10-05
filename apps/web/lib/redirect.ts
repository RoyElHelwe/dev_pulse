/** Same rule as the API: only paths on our own site ("/office"), never another website. */
export function safeRedirect(target: string | null | undefined, fallback = '/office') {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
