/**
 * Viewport overlays container for notifications and tab conflicts.
 * Placed outside the sliding board drawer to remain anchored on screen.
 */

'use client';

import { OfficeNotices } from './OfficeNotices';
import { TabLock } from './TabLock';

interface OfficeOverlaysProps {
  toast: string;
  online: boolean;
  editing: boolean;
}

/** Renders toast notifications, offline reconnection banners, and tab takeover alerts. */
export function OfficeOverlays({ toast, online, editing }: OfficeOverlaysProps) {
  return (
    <>
      <OfficeNotices toast={toast} online={online} editing={editing} />
      <TabLock />
    </>
  );
}
