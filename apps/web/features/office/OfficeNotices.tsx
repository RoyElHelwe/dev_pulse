/**
 * Top and bottom viewport notices for connection alerts and toasts.
 * Positioned outside the sliding task board layer to remain continuously visible.
 */

'use client';

import { WifiOff } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';

/** Renders toast notifications and offline reconnecting banners. */
export function OfficeNotices({ toast, online, editing }: { toast: string; online: boolean; editing: boolean }) {
  return (
    <>
      {!editing && !online && (
        <Panel role="status" className="absolute top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-800">
          <WifiOff className="size-4" aria-hidden="true" />
          Connection lost. Reconnecting…
          <span className="size-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
        </Panel>
      )}
      {toast && (
        <Panel role="status" className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5 text-sm font-medium text-zinc-700">
          {toast}
        </Panel>
      )}
    </>
  );
}
