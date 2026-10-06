'use client';

import { MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tabLock, useTabLock } from './tabLockStore';

/**
 * Covers the office when it is live in another tab (or browser, or device):
 * only one tab at a time has the avatar, voice and chat. "Use here" moves it to this tab.
 */
export function TabLock() {
  const lock = useTabLock();
  if (!lock) return null;
  const replaced = lock === 'replaced';
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-labelledby="tab-lock-title" className="w-full max-w-sm rounded-2xl bg-amber-50 p-5 text-sm text-amber-950 shadow-xl ring-1 ring-amber-200/80">
        <div className="flex gap-3">
          <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex-1">
            <p id="tab-lock-title" className="font-semibold">
              {replaced ? 'Opened in another tab' : 'Dev Pulse is open in another tab'}
            </p>
            <p className="mt-1 text-amber-900/80">
              {replaced
                ? 'Your office moved to the other tab, so you are not shown here any more.'
                : 'You can only be in the office from one tab at a time.'}
            </p>
            <Button variant="secondary" size="sm" autoFocus onClick={tabLock.takeOver} className="mt-3 ring-amber-300">
              Use here
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
