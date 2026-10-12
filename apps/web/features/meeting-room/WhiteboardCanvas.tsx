'use client';

// Live Excalidraw canvas of a meeting room, synced over the /office socket.
// Loaded on demand by WhiteboardOverlay (Excalidraw is large, and needs the browser).

import '@excalidraw/excalidraw/index.css';
import {
  CaptureUpdateAction,
  Excalidraw,
  reconcileElements,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

// Fonts come from the app itself (copied by scripts/excalidraw-assets.mjs), not a CDN: works on an offline LAN.
if (typeof window !== 'undefined') window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';

const ACK_TIMEOUT_MS = 8_000;
/** Edits are batched: at most ~10 messages a second while drawing. */
const SEND_INTERVAL_MS = 100;
/** Cursor positions: at most ~20 a second. */
const POINTER_INTERVAL_MS = 50;
/** A cursor that has not moved for this long is hidden (its owner closed the board). */
const CURSOR_TTL_MS = 10_000;
const CURSOR_SWEEP_MS = 2_000;
/** Below the server's 900 KB per message. */
const MAX_BATCH_BYTES = 600_000;

interface WhiteboardCanvasProps {
  socket: Socket;
  roomId: string;
  nameOf(userId: string): string;
  /** The server dropped us from the board (walked out, or a booking without us started). */
  onLost(): void;
}

type Remote = readonly ExcalidrawElement[];

/** Excalidraw scene of one meeting room: loads it, merges others' edits in, sends ours out. */
export default function WhiteboardCanvas({
  socket,
  roomId,
  nameOf,
  onLost,
}: WhiteboardCanvasProps) {
  const [initial, setInitial] = useState<OrderedExcalidrawElement[] | null>(null);
  const [error, setError] = useState('');
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  /** Element id → the version everyone already has (sent by us or received). */
  const known = useRef(new Map<string, number>());
  /** Edits that arrived before Excalidraw was ready. */
  const pending = useRef<Remote[]>([]);
  const cursors = useRef(new Map<string, { collaborator: Collaborator; at: number }>());
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef({ at: 0, button: 'up' });
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  /** Merges remote elements into the scene (Excalidraw's own reconciliation, so all copies agree). */
  const apply = useCallback((remote: Remote) => {
    const api = apiRef.current;
    if (!api) return void pending.current.push(remote);
    for (const el of remote)
      known.current.set(el.id, Math.max(known.current.get(el.id) ?? 0, el.version));
    const elements = reconcileElements(
      api.getSceneElementsIncludingDeleted(),
      remote as RemoteExcalidrawElement[],
      api.getAppState(),
    );
    // NEVER: others' strokes do not go into our undo history.
    api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER });
  }, []);

  /** Sends every element whose version is ahead of what the others have. */
  const flush = useCallback(() => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = null;
    const api = apiRef.current;
    if (!api || !socket.connected) return;
    const changed = api
      .getSceneElementsIncludingDeleted()
      .filter((el) => (known.current.get(el.id) ?? 0) < el.version);
    let batch: ExcalidrawElement[] = [];
    let bytes = 0;
    const send = () => batch.length > 0 && socket.emit('wb:update', { roomId, elements: batch });
    for (const el of changed) {
      const size = JSON.stringify(el).length;
      if (bytes + size > MAX_BATCH_BYTES) {
        send();
        batch = [];
        bytes = 0;
      }
      batch.push(el);
      bytes += size;
      known.current.set(el.id, el.version);
    }
    send();
  }, [socket, roomId]);

  const showCursors = useCallback(() => {
    const collaborators = new Map(
      [...cursors.current].map(([id, c]) => [id as SocketId, c.collaborator]),
    );
    apiRef.current?.updateScene({ collaborators });
  }, []);

  // Open the board, follow the others' edits and cursors, and close it again.
  useEffect(() => {
    let alive = true;
    const onUpdate = ({ roomId: r, elements }: { roomId: string; elements: Remote }) =>
      r === roomId && Array.isArray(elements) && apply(elements);
    const onPointer = (p: {
      roomId: string;
      from: string;
      x: number;
      y: number;
      tool: 'pointer' | 'laser';
      button: 'up' | 'down';
    }) => {
      if (p.roomId !== roomId || typeof p.from !== 'string') return;
      cursors.current.set(p.from, {
        at: performance.now(),
        collaborator: {
          id: p.from,
          username: nameRef.current(p.from),
          pointer: { x: p.x, y: p.y, tool: p.tool },
          button: p.button,
        },
      });
      showCursors();
    };
    const onClosed = ({ roomId: r }: { roomId: string }) => r === roomId && onLostRef.current();
    socket.on('wb:update', onUpdate);
    socket.on('wb:pointer', onPointer);
    socket.on('wb:closed', onClosed);

    socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('wb:join', { roomId })
      .then(
        (res: { elements?: unknown; error?: string }) => {
          if (!alive) return;
          if (!Array.isArray(res?.elements))
            return setError(
              res?.error === 'FORBIDDEN'
                ? 'Only people in this meeting room can open its whiteboard.'
                : 'The whiteboard could not be loaded. Please try again.',
            );
          const elements = restoreElements(res.elements as ExcalidrawElement[], null);
          for (const el of elements) known.current.set(el.id, el.version);
          setInitial(elements);
        },
        () => alive && setError('The whiteboard is not reachable right now. Please try again.'),
      );

    const sweep = setInterval(() => {
      const now = performance.now();
      let changed = false;
      for (const [id, c] of cursors.current)
        if (now - c.at > CURSOR_TTL_MS && cursors.current.delete(id)) changed = true;
      if (changed) showCursors();
    }, CURSOR_SWEEP_MS);

    return () => {
      alive = false;
      clearInterval(sweep);
      flush();
      socket.emit('wb:leave', { roomId });
      socket.off('wb:update', onUpdate);
      socket.off('wb:pointer', onPointer);
      socket.off('wb:closed', onClosed);
    };
  }, [socket, roomId, apply, flush, showCursors]);

  const initialData = useMemo(
    () => (initial ? { elements: initial, scrollToContent: true } : null),
    [initial],
  );

  if (error)
    return (
      <p className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
        {error}
      </p>
    );
  if (!initialData)
    return (
      <p className="flex h-full items-center justify-center text-sm text-zinc-400">
        Loading whiteboard…
      </p>
    );

  return (
    <Excalidraw
      initialData={initialData}
      excalidrawAPI={(api) => {
        apiRef.current = api;
        // Apply edits that arrived while the canvas was loading.
        queueMicrotask(() => pending.current.splice(0).forEach(apply));
      }}
      onChange={() => {
        sendTimer.current ??= setTimeout(flush, SEND_INTERVAL_MS);
      }}
      onPointerUpdate={({ pointer, button }) => {
        const now = performance.now();
        // Always send a press or release; throttle plain moves.
        if (
          button === lastPointer.current.button &&
          now - lastPointer.current.at < POINTER_INTERVAL_MS
        )
          return;
        lastPointer.current = { at: now, button };
        if (socket.connected)
          socket.emit('wb:pointer', {
            roomId,
            x: pointer.x,
            y: pointer.y,
            tool: pointer.tool,
            button,
          });
      }}
      isCollaborating
      // Images would make the shared scene heavy; scenes from files could carry them in.
      UIOptions={{
        tools: { image: false },
        canvasActions: { loadScene: false, saveToActiveFile: false },
      }}
    />
  );
}
