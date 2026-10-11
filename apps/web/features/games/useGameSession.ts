/**
 * React hook managing interactive game session networking, state synchronization, and lifecycle.
 * Coordinates socket transport with the backend GamesGateway and GamesSessionManager.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameKind } from './types';

/** Fallback timer delay in ms to flush queued game states when requestAnimationFrame is idle (e.g. background tab). */
const BACKGROUND_FLUSH_FALLBACK_MS = 100;

type GameSessionStatus = 'joining' | 'joined' | 'left' | 'error';

interface GameSessionError {
  code: string;
  message: string;
}

/**
 * Return interface for `useGameSession`, exposing session state, status, controls, and event handling.
 */
export interface UseGameSessionReturn<S> {
  /** Latest authoritative viewer-specific state received from the backend game session. */
  state: S | null;
  /** Current connection and participation status in the game session. */
  status: GameSessionStatus;
  /** Error detail if joining or performing an action failed. */
  error: GameSessionError | null;
  /** Sends a player action payload to the server instance via `game:action`. */
  send: (action: unknown) => void;
  /** Manually requests to join or re-join the game session via `game:join`. */
  join: (intent?: unknown) => void;
  /** Leaves the game session via `game:leave` and updates status to 'left'. */
  leave: () => void;
  /** Registers a listener for custom game events and match completion broadcasts. */
  onEvent: (cb: (event: string, data?: unknown) => void) => () => void;
}

/**
 * Connects a client to a server-side game session at a specific furniture object.
 *
 * ### Socket Events Emitted (Client -> Server):
 * - `game:join` (`{ game: GameKind, id: string, intent?: unknown }`):
 *   Dispatched on initial mount or when `join()` is called. The backend `GamesGateway` verifies
 *   rate-limit action budget, validates furniture kind match, checks avatar proximity
 *   (`JOIN_PROXIMITY_TILES = 4`), joins the Socket.IO room `game:{workspaceId}:{objectId}`,
 *   and registers the player in `GamesSessionManager`.
 * - `game:leave` (`{ id: string }`):
 *   Dispatched when `leave()` is invoked or on hook unmount. The backend removes the participant
 *   and unbinds them from the socket room. If zero participants remain, the session is disposed.
 * - `game:action` (`{ id: string, action: unknown }`):
 *   Emitted by `send()` to forward game-specific inputs (moves, cards, placements) to the backend
 *   `GameInstance.onAction()`.
 *
 * ### Socket Events Listened (Server -> Client):
 * - `game:state` (`{ id: string, game?: string, state: S }`):
 *   Authoritative game state emitted ~30Hz or on state mutation. Updates `state` via RAF throttle,
 *   sets `status` to `'joined'`, and clears any error.
 * - `game:event` (`{ id: string, event: string, data?: unknown }`):
 *   Custom game events (e.g. goals scored, sound triggers) broadcast to room or user. Dispatched to
 *   registered `onEvent` subscribers.
 * - `game:left` (`{ id: string, reason?: string }`):
 *   Sent when player leaves or is ejected by server proximity sweeps (`reason: 'far'`, when avatar
 *   exceeds `LEAVE_PROXIMITY_TILES = 7`), or when closed (`reason: 'closed'`). Transitions `status` to `'left'`.
 * - `game:ended` (`{ id: string, result?: unknown }`):
 *   Sent when a game match concludes or session closes. Forwards an `'ended'` synthetic event to `onEvent`.
 * - `game:error` (`{ id?: string, code: string, message: string }`):
 *   Sent on rate limits (`RATE_LIMIT`), distance rejections (`NOT_NEAR`), missing furniture (`NOT_FOUND`),
 *   or invalid actions. Populates `error` and transitions `status` to `'error'`.
 *
 * ### Session State Machine:
 * ```
 *   ┌─────────┐   game:state    ┌─────────┐
 *   │ joining │ ──────────────> │ joined  │
 *   └────┬────┘                 └────┬────┘
 *        │ game:error                │ game:left / leave()
 *        ▼                           ▼
 *   ┌─────────┐   join() / mount┌─────────┐
 *   │  error  │ ──────────────> │  left   │
 *   └─────────┘                 └─────────┘
 * ```
 *
 * @param socket Active socket.io client connection.
 * @param game Game kind identifier (e.g. 'foosball', 'uno', 'lego').
 * @param objectId Target furniture object ID in the office layout.
 * @param intent Optional initial join intent (e.g. team side, seat index).
 */
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

    // WHY RAF + timeout throttle: The server transmits game state up to ~30Hz. Rendering every incoming
    // packet directly causes React render cascades and frame drops on lower-powered devices.
    // requestAnimationFrame limits state applications to match the monitor's display refresh rate (1 per frame).
    // The BACKGROUND_FLUSH_FALLBACK_MS timeout ensures queued states still flush when the browser tab is
    // inactive or backgrounded and requestAnimationFrame stops firing.
    let latest: { state: S } | null = null;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = 0;
      timer = undefined;
      if (!latest) return;
      const next = latest.state;
      latest = null;
      setState(next);
    };
    const onState = (payload: { id: string; game?: string; state: S }) => {
      if (payload.id === objectId) {
        latest = { state: payload.state };
        if (!frame) {
          frame = requestAnimationFrame(flush);
          timer = setTimeout(flush, BACKGROUND_FLUSH_FALLBACK_MS);
        }
        setStatus('joined');
        setError(null);
      }
    };

    // WHY try/catch inside forEach: Isolate subscriber execution so an error thrown in one
    // third-party or component listener does not disrupt other listeners or crash the socket handler.
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

    // WHY handle game:left: Triggered when user explicitly leaves, when the server sweeps proximity
    // and ejects the avatar for walking too far away (reason: 'far'), or when the room closes.
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

    // WHY emit game:leave on unmount: Clean up the server session immediately rather than waiting
    // for socket disconnect or backend proximity sweep timeouts.
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
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
