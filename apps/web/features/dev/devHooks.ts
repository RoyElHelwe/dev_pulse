'use client';

// Dev/test only: browser hooks the e2e suite (e2e/tests/helpers.ts) uses to drive the office.
// Never active in production: `useDevHooks` installs `window.__devpulse` only when the api
// reports DEV_LOGIN as enabled, and the api never enables it in production. The two render
// caps below are inert unless a test sets them, so they are harmless in a real browser.

import { useEffect } from 'react';
import { useDevLogin } from './useDevLogin';

/** What `window.__devpulse` offers to tests. */
export interface DevPulseHook {
  /** Moves the local player to pixel coordinates, skipping walking and collisions. */
  teleport(x: number, y: number): void;
  /** The local player's position in pixels, or null while the office is not loaded. */
  position(): { x: number; y: number } | null;
}

declare global {
  interface Window {
    /** Present only while DEV_LOGIN is enabled. */
    __devpulse?: DevPulseHook;
    /** Set by e2e before load: caps the Phaser frame rate (software-rendered browsers). */
    __devpulseFps?: number;
    /** Set by e2e before load: renders the foosball canvas at half resolution. */
    __devpulseLowRes?: boolean;
  }
}

/** Sets `window.__devpulse`; returns the function that removes it. */
function installDevHooks(hooks: DevPulseHook): () => void {
  window.__devpulse = hooks;
  return () => {
    delete window.__devpulse;
  };
}

/** Office view entry point: installs the hooks for as long as dev sign-in is on. */
export function useDevHooks(hooks: DevPulseHook): void {
  const enabled = useDevLogin()?.enabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    return installDevHooks(hooks);
    // `hooks` only forwards to refs, so the first object stays valid for the whole mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** Test-only frame-rate cap for the Phaser game (0 = uncapped). Out-of-range values are ignored. */
export function devFpsCap(): number {
  const cap = typeof window === 'undefined' ? undefined : window.__devpulseFps;
  return typeof cap === 'number' && cap >= 5 && cap <= 60 ? cap : 0;
}

/** Test-only: true when the page asked for half-resolution canvases. */
export function devLowRes(): boolean {
  return typeof window !== 'undefined' && window.__devpulseLowRes === true;
}
