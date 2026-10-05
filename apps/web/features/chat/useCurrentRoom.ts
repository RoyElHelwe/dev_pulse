import { useEffect, useState } from 'react';
import type { OfficeController } from '@/game/createGame';
import type { OfficeLayout, Room } from '@/game/layout/types';
import { roomFinder } from '@/game/systems/rooms';

/**
 * The meeting room or lounge the local player stands in (null in the open
 * space). Polled from the game twice a second; a room counts once we were in it
 * on two polls in a row, so walking through a doorway doesn't flicker and the
 * server (which checks room chat) has our new position by then.
 */
export function useCurrentRoom(controller: OfficeController | null, layout: OfficeLayout) {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!controller) return;
    const find = roomFinder(layout);
    const rooms = new Map(layout.rooms.map((r) => [r.id, r]));
    let last: Room | null | undefined;
    const tick = () => {
      const me = controller.snapshot()?.me;
      const found = me ? rooms.get(find(me.x, me.y) ?? '') : undefined;
      const next = found && found.kind !== 'open' ? found : null;
      if (next === last) setRoom((prev) => (prev?.id === next?.id && prev?.name === next?.name ? prev : next));
      last = next;
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [controller, layout]);

  return room;
}
