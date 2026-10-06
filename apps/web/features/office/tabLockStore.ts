import { useSyncExternalStore } from 'react';

/**
 * Why this tab's office is not live: `busy` (open in another tab when this one
 * started) or `replaced` (another tab took it over). Null: this tab has the office.
 * The server decides (see OfficeGateway); this only remembers what it said.
 */
export type TabLockState = 'busy' | 'replaced' | null;

let state: TabLockState = null;
let useHere: (() => void) | null = null;
const listeners = new Set<() => void>();

export const tabLock = {
  set(next: TabLockState) {
    if (state === next) return;
    state = next;
    listeners.forEach((l) => l());
  },
  /** The live connection registers how to take the office over (null when it is gone). */
  register(fn: (() => void) | null) {
    useHere = fn;
  },
  takeOver() {
    useHere?.();
  },
};

export const useTabLock = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => state,
    () => null,
  );
