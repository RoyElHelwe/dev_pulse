// WebSocket client wrapper for Socket.IO providing direct WebSocket transport connections.

import { io } from 'socket.io-client';

/**
 * Direct WebSocket connection bypassing HTTP polling, connecting on the next tick to prevent dev mount noise.
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
