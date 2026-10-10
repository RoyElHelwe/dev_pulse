const KEY = "devpulse.pendingInvite";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour (same as the verification link)

function isInvitePath(path: unknown): path is string {
  return typeof path === "string" && /^\/invite\/[A-Za-z0-9_-]+$/.test(path);
}

export function savePendingInvite(path: string) {
  if (!isInvitePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, savedAt: Date.now() }));
  } catch {
    //private mode / storage blocked: the user can click the link again
  }
}

//reads and deletes it, so it's used only once.
export function takePendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, savedAt } = JSON.parse(raw);
    if (!isInvitePath(path)) return null;
    if (typeof savedAt !== "number" || Date.now() - savedAt > MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}