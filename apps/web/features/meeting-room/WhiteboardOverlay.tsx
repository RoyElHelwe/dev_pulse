'use client';

// Full-screen frame around a meeting room's whiteboard: title, close button, keyboard isolation.
// Fits into MeetingRoomTools; the Excalidraw canvas itself is loaded only when opened.

import { PenLine, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import type { Socket } from 'socket.io-client';
import { IconButton } from '@/components/ui/IconButton';

const WhiteboardCanvas = dynamic(() => import('./WhiteboardCanvas'), {
  ssr: false,
  loading: () => (
    <p className="flex h-full items-center justify-center text-sm text-zinc-400">
      Loading whiteboard…
    </p>
  ),
});

interface WhiteboardOverlayProps {
  socket: Socket;
  roomId: string;
  roomName: string;
  nameOf(userId: string): string;
  onClose(): void;
  onLost(): void;
}

/** Covers the office with the room's shared whiteboard until closed. */
export function WhiteboardOverlay({
  socket,
  roomId,
  roomName,
  nameOf,
  onClose,
  onLost,
}: WhiteboardOverlayProps) {
  return createPortal(
    <div
      role="dialog"
      aria-label={`Whiteboard of ${roomName}`}
      // Drawing shortcuts (R, O, arrows...) must not walk the avatar or trigger office hotkeys.
      data-captures-keys=""
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[60] flex h-dvh flex-col bg-white"
    >
      <header
        className="flex items-center gap-2 border-b border-zinc-200 py-2 pr-2 pl-4"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <PenLine className="size-4 shrink-0 text-emerald-600" />
        <h2 className="truncate font-semibold">Whiteboard · {roomName}</h2>
        <p className="mr-auto hidden truncate text-xs text-zinc-500 sm:block">
          Everyone in the room sees and edits it live. It stays here for the next meeting.
        </p>
        <IconButton aria-label="Close whiteboard" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </header>
      <main className="relative min-h-0 flex-1">
        <WhiteboardCanvas socket={socket} roomId={roomId} nameOf={nameOf} onLost={onLost} />
      </main>
    </div>,
    document.body,
  );
}
