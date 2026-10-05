import { io } from 'socket.io-client';
import type { OfficeController, PlayerState } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';
import { refreshTokens } from '@/lib/api';

/** Someone in the office right now (for the presence list). */
export interface Presence {
  id: string;
  name: string;
  character: string;
}

interface Handlers {
  myId: string;
  onPresence(people: Presence[]): void;
  onLayout(layout: OfficeLayout, version: number, by: string): void;
  onOwnCharacter(character: string): void;
  /** Removed from the office, or the office was deleted. */
  onRemoved(reason: 'removed' | 'deleted' | 'no_workspace'): void;
}

/**
 * Connects the game to the live office (Socket.IO namespace /office):
 * sends our position, applies everyone else's. Returns a disconnect function
 * and the function the game calls when we move.
 */
export function connectOffice(controller: () => OfficeController | null, handlers: Handlers) {
  const socket = io('/office');
  const people = new Map<string, Presence>();
  const publish = () => handlers.onPresence([...people.values()]);
  let retries = 0;

  const announce = () => {
    const position = controller()?.localPosition();
    if (position) socket.emit('move', [position.x, position.y, 0, 0]);
  };

  socket.on('connect', () => {
    retries = 0;
    announce();
  });
  socket.on('office:state', ({ players }: { players: PlayerState[] }) => {
    people.clear();
    players.forEach((p) => people.set(p.id, { id: p.id, name: p.name, character: p.character }));
    publish();
    controller()?.setPlayers(players);
  });
  socket.on('office:joined', (p: PlayerState) => {
    people.set(p.id, { id: p.id, name: p.name, character: p.character });
    publish();
    controller()?.upsertPlayer(p);
  });
  socket.on('office:moved', ([id, x, y, dir, moving]: [string, number, number, number, number]) => {
    controller()?.movePlayer(id, x, y, dir, moving === 1);
  });
  socket.on('office:left', ({ id }: { id: string }) => {
    people.delete(id);
    publish();
    controller()?.removePlayer(id);
  });
  socket.on('office:updated', ({ id, character }: { id: string; character?: string }) => {
    if (!character) return;
    if (id === handlers.myId) return handlers.onOwnCharacter(character);
    const person = people.get(id);
    if (person) person.character = character;
    publish();
    controller()?.setPlayerCharacter(id, character);
  });
  socket.on('office:layout', ({ layout, version, by }: { layout: OfficeLayout; version: number; by: string }) =>
    handlers.onLayout(layout, version, by),
  );
  socket.on('office:removed', ({ reason }: { reason: 'removed' | 'deleted' }) => handlers.onRemoved(reason));
  socket.on('connect_error', async (error) => {
    if (error.message === 'NO_WORKSPACE') return handlers.onRemoved('no_workspace');
    // Access token expired (e.g. the laptop slept): renew it and try again.
    if (error.message === 'NOT_AUTHENTICATED' && retries++ < 2 && (await refreshTokens())) socket.connect();
  });

  return {
    /** Called by the game ~20 times a second while walking. */
    sendMove(x: number, y: number, dir: number, moving: boolean) {
      if (socket.connected) socket.volatile.emit('move', [x, y, dir, moving ? 1 : 0]);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
