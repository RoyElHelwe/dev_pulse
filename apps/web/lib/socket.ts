import { io } from 'socket.io-client';

/**
 * A Socket.IO connection straight over WebSocket, without the HTTP
 * long-polling step first: nothing to upgrade, so nothing cut half-way when a
 * page closes or a busy laptop misses a heartbeat (no console noise), and
 * everything travels on one connection.
 *
 * It connects on the next tick: a component mounted and unmounted at once
 * (React dev mode) never opens a socket.
 */
export function openSocket(namespace: string, auth?: (send: (data: Record<string, unknown>) => void) => void) {
  const socket = io(namespace, { transports: ['websocket'], autoConnect: false, ...(auth && { auth }) });
  let closed = false;
  const timer = setTimeout(() => socket.connect(), 0);
  return {
    socket,
    /** Reconnects later, unless closed meanwhile. */
    retry(ms: number) {
      setTimeout(() => !closed && socket.connect(), ms);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      socket.disconnect();
    },
  };
}
