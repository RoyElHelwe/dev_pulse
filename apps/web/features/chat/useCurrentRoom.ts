// Hook tracking the office room (meeting room or lounge) currently occupied by the player.
// Fits into the chat feature to provide room-scoped chat channels.

import { useEffect, useState } from 'react';
import type { OfficeController } from '@/game/createGame';
import type { OfficeLayout, Room } from '@/game/layout/types';

const ROOM_POLL_INTERVAL_MS = 500;

/** Tracks the meeting room or lounge the local player stands in, debounced across ticks. */
export function useCurrentRoom(controller: OfficeController | null, layout: OfficeLayout) {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!controller) return;
    const rooms = new Map(layout.rooms.map((r) => [r.id, r]));
    let last: Room | null | undefined;
    const tick = () => {
      const found = rooms.get(controller.snapshot()?.me.room ?? '');
      const next = found && found.kind !== 'open' ? found : null;
      // Require room presence across two consecutive ticks so crossing doorways does not cause channel flicker.
      if (next === last) setRoom((prev) => (prev?.id === next?.id && prev?.name === next?.name ? prev : next));
      last = next;
    };
    tick();
    const timer = setInterval(tick, ROOM_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [controller, layout]);

  return room;
}
