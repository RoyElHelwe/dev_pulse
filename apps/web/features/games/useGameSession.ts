'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameKind } from './types';

export type GameSessionStatus = 'joining' | 'joined' | 'left' | 'error';

export interface GameSessionError {
  code: string;
  message: string;
}

export interface UseGameSessionReturn<S> {
  state: S | null;
  status: GameSessionStatus;
  error: GameSessionError | null;
  send: (action: unknown) => void;
  join: (intent?: unknown) => void;
  leave: () => void;
  onEvent: (cb: (event: string, data?: unknown) => void) => () => void;
}

export function useGameSession<S = unknown>(
  socket: Socket | null | undefined,
  game: GameKind,
  objectId: string,
  intent?: unknown,
): UseGameSessionReturn<S> {
  const [state, setState] = useState<S | null>(null);
  const [status, setStatus] = useState<GameSessionStatus>('joining');
  const [error, setError] = useState<GameSessionError | null>(null);

  const intentRef = useRef(intent);
  intentRef.current = intent;

  const eventListenersRef = useRef<Set<(event: string, data?: unknown) => void>>(new Set());

  const onEvent = useCallback((cb: (event: string, data?: unknown) => void) => {
    eventListenersRef.current.add(cb);
    return () => {
      eventListenersRef.current.delete(cb);
    };
  }, []);

  const send = useCallback(
    (action: unknown) => {
      if (!socket) return;
      socket.emit('game:action', { id: objectId, action });
    },
    [socket, objectId],
  );

  const join = useCallback(
    (manualIntent?: unknown) => {
      if (!socket) return;
      setStatus('joining');
      setError(null);
      const effectiveIntent = manualIntent !== undefined ? manualIntent : intentRef.current;
      socket.emit('game:join', { game, id: objectId, intent: effectiveIntent });
    },
    [socket, game, objectId],
  );

  const leave = useCallback(() => {
    if (!socket) return;
    setStatus('left');
    socket.emit('game:leave', { id: objectId });
  }, [socket, objectId]);

  useEffect(() => {
    if (!socket) return;

    const onState = (payload: { id: string; game?: string; state: S }) => {
      if (payload.id === objectId) {
        setState(payload.state);
        setStatus('joined');
        setError(null);
      }
    };

    const onEventMessage = (payload: { id: string; event: string; data?: unknown }) => {
      if (payload.id === objectId) {
        eventListenersRef.current.forEach((cb) => {
          try {
            cb(payload.event, payload.data);
          } catch {
            // Keep listener errors isolated
          }
        });
      }
    };

    const onLeft = (payload: { id: string; reason?: string }) => {
      if (payload.id === objectId) {
        setStatus('left');
      }
    };

    const onEnded = (payload: { id: string; result?: unknown }) => {
      if (payload.id === objectId) {
        eventListenersRef.current.forEach((cb) => {
          try {
            cb('ended', payload.result);
          } catch {
            // Keep listener errors isolated
          }
        });
      }
    };

    const onError = (payload: { id?: string; code: string; message: string }) => {
      if (!payload.id || payload.id === objectId) {
        setError({ code: payload.code, message: payload.message });
        setStatus('error');
      }
    };

    socket.on('game:state', onState);
    socket.on('game:event', onEventMessage);
    socket.on('game:left', onLeft);
    socket.on('game:ended', onEnded);
    socket.on('game:error', onError);

    setStatus('joining');
    setError(null);
    socket.emit('game:join', { game, id: objectId, intent: intentRef.current });

    return () => {
      socket.off('game:state', onState);
      socket.off('game:event', onEventMessage);
      socket.off('game:left', onLeft);
      socket.off('game:ended', onEnded);
      socket.off('game:error', onError);
      socket.emit('game:leave', { id: objectId });
    };
  }, [socket, game, objectId]);

  return {
    state,
    status,
    error,
    send,
    join,
    leave,
    onEvent,
  };
}
