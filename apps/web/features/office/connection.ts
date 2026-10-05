import type { DeskOwner, OfficeController, PlayerState } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';
import { refreshTokens } from '@/lib/api';
import { openSocket } from '@/lib/socket';

/** Someone in the office right now (for the presence list). */
export interface Presence {
  id: string;
  name: string;
  character: string;
  status: string | null;
  /** Zone id (meeting room, lounge, desk) or null in the open space. */
  zone: string | null;
}

const presenceOf = (p: PlayerState): Presence => ({
  id: p.id,
  name: p.name,
  character: p.character,
  status: p.status ?? null,
  zone: p.zone ?? null,
});

interface Handlers {
  myId: string;
  onPresence(people: Presence[]): void;
  onLayout(layout: OfficeLayout, version: number, by: string): void;
  onOwnCharacter(character: string): void;
  onOwnStatus(status: string | null): void;
  onDesks(desks: DeskOwner[]): void;
  /** Lost the connection (it retries by itself) / back online. */
  onConnection(online: boolean): void;
  /** Removed from the office, or the office was deleted. */
  onRemoved(reason: 'removed' | 'deleted' | 'no_workspace'): void;
}

/**
 * Connects the game to the live office (Socket.IO namespace /office):
 * sends our position, applies everyone else's. Returns a disconnect function
 * and the function the game calls when we move.
 */
export function connectOffice(controller: () => OfficeController | null, handlers: Handlers) {
  const connection = openSocket('/office');
  const { socket } = connection;
  const people = new Map<string, Presence>();
  const publish = () => handlers.onPresence([...people.values()]);
  let retries = 0;
  let zone: string | null = null;

  const announce = () => {
    const position = controller()?.localPosition();
    if (position) socket.emit('move', [position.x, position.y, 0, 0]);
  };

  socket.on('connect', () => {
    retries = 0;
    handlers.onConnection(true);
    announce();
    if (zone) socket.emit('zone', zone);
  });
  socket.on('disconnect', (reason) => {
    // Our own disconnect() (leaving the page) is not a network problem.
    if (reason !== 'io client disconnect') handlers.onConnection(false);
  });
  // The browser knows before the socket does.
  const offline = () => handlers.onConnection(false);
  const online = () => socket.connected && handlers.onConnection(true);
  window.addEventListener('offline', offline);
  window.addEventListener('online', online);
  socket.on('office:state', ({ players }: { players: PlayerState[] }) => {
    people.clear();
    players.forEach((p) => people.set(p.id, presenceOf(p)));
    publish();
    controller()?.setPlayers(players);
  });
  socket.on('office:joined', (p: PlayerState) => {
    people.set(p.id, presenceOf(p));
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
  socket.on('office:updated', ({ id, character, status }: { id: string; character?: string; status?: string | null }) => {
    if (id === handlers.myId) {
      if (character) handlers.onOwnCharacter(character);
      if (status !== undefined) handlers.onOwnStatus(status);
      return;
    }
    const person = people.get(id);
    if (character) {
      if (person) person.character = character;
      controller()?.setPlayerCharacter(id, character);
    }
    if (status !== undefined) {
      if (person) person.status = status;
      controller()?.setPlayerStatus(id, status);
    }
    publish();
  });
  socket.on('office:zone', ([id, z]: [string, string | null]) => {
    const person = people.get(id);
    if (person) person.zone = z;
    publish();
    controller()?.setPlayerZone(id, z);
  });
  socket.on('office:desks', ({ desks }: { desks: DeskOwner[] }) => handlers.onDesks(desks));
  socket.on('office:layout', ({ layout, version, by }: { layout: OfficeLayout; version: number; by: string }) =>
    handlers.onLayout(layout, version, by),
  );
  socket.on('office:removed', ({ reason }: { reason: 'removed' | 'deleted' }) => handlers.onRemoved(reason));
  socket.on('connect_error', async (error) => {
    if (error.message === 'NO_WORKSPACE') return handlers.onRemoved('no_workspace');
    // Access token expired (e.g. the laptop slept): renew it and try again.
    if (error.message === 'NOT_AUTHENTICATED') {
      if (retries++ < 2 && (await refreshTokens())) socket.connect();
      return;
    }
    // The server refused for a passing reason (database restarting...): socket.io
    // doesn't retry refusals by itself, so try again in a moment.
    if (!socket.active && error.message !== 'SESSION_ENDED') connection.retry(2000);
  });

  return {
    /** Called by the game ~20 times a second while walking. */
    sendMove(x: number, y: number, dir: number, moving: boolean) {
      if (socket.connected) socket.volatile.emit('move', [x, y, dir, moving ? 1 : 0]);
    },
    /** Called by the game when we enter or leave a zone. */
    sendZone(z: string | null) {
      if (z === zone) return;
      zone = z;
      if (socket.connected) socket.emit('zone', z);
    },
    disconnect() {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      connection.close();
    },
  };
}
