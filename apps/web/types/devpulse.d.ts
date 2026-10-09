/** Dev-only test hooks for e2e automation. */
export interface DevPulseHook {
  /** Teleports the local player to pixel coordinates (dev/test only). */
  teleport(x: number, y: number): void;
  /** Returns current local player position in pixels, or null if not in office. */
  position(): { x: number; y: number } | null;
}

declare global {
  interface Window {
    /** Dev-only test hook (only present when DEV_LOGIN is enabled). */
    __devpulse?: DevPulseHook;
  }
}
