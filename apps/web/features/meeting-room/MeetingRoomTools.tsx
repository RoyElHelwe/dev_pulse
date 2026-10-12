'use client';

// Tools of the meeting room the player stands in: screen sharing and the shared whiteboard.
// Mounted by OfficeFeatures; shows its bar only inside a meeting room.

import { MonitorUp, PenLine, ScreenShareOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useCurrentRoom } from '@/features/chat/useCurrentRoom';
import type { OfficeFeatureProps } from '@/features/office/types';
import { buttonStyles } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { canShareScreen, ScreenShare, type ScreenSnapshot, type StartResult } from './ScreenShare';
import { ScreenStage } from './ScreenStage';
import { WhiteboardOverlay } from './WhiteboardOverlay';

const IDLE: ScreenSnapshot = { roomId: null, presenterId: null, local: null, remote: null, viewers: 0, starting: false };

const START_MESSAGES: Partial<Record<StartResult, string>> = {
  unsupported: 'Screen sharing needs a desktop browser. Phones and tablets can watch, but not present.',
  busy: 'Someone is already presenting in this room.',
  forbidden: 'Only people in this meeting room can present here.',
  failed: 'Your screen could not be shared. Please try again.',
};

/** Meeting room bar (share screen, whiteboard), the shared screen, and the whiteboard overlay. */
export function MeetingRoomTools({ socket, controller, workspace, people, myId, onToast, editing }: OfficeFeatureProps) {
  const current = useCurrentRoom(controller, workspace.layout);
  const room = current?.kind === 'meeting' ? current : null;
  const [screen, setScreen] = useState<ScreenSnapshot>(IDLE);
  const [boardOpen, setBoardOpen] = useState(false);
  const managerRef = useRef<ScreenShare | null>(null);
  const roomIdRef = useRef<string | null>(null);
  roomIdRef.current = room?.id ?? null;

  // One screen share engine per office socket.
  useEffect(() => {
    if (!socket) return;
    const manager = new ScreenShare(socket, myId, () => setScreen(manager.snapshot()));
    manager.setRoom(roomIdRef.current);
    managerRef.current = manager;
    return () => {
      manager.destroy();
      managerRef.current = null;
      setScreen(IDLE);
    };
  }, [socket, myId]);

  // Walking out of the room ends sharing, watching and the whiteboard there.
  useEffect(() => {
    managerRef.current?.setRoom(room?.id ?? null);
    setBoardOpen(false);
  }, [room?.id]);

  const nameOf = useCallback((id: string) => (id === myId ? 'You' : (people.find((p) => p.id === id)?.name ?? 'Someone')), [people, myId]);

  const share = async () => {
    const manager = managerRef.current;
    if (!manager) return;
    if (screen.local) return manager.stopPresenting();
    const message = START_MESSAGES[await manager.startPresenting()];
    if (message) onToast(message);
  };

  if (editing) return null;
  const presenting = !!screen.local;
  const someoneElse = !!screen.presenterId && screen.presenterId !== myId;
  const stream = screen.local ?? screen.remote;

  return (
    <>
      {room && (
        <Panel role="toolbar" aria-label={`${room.name} tools`} className="absolute top-[4.5rem] left-4 z-10 flex items-center gap-1 p-1">
          <span className="hidden max-w-32 truncate pr-1 pl-2 text-sm font-semibold text-zinc-700 sm:block">{room.name}</span>
          <button
            type="button"
            onClick={share}
            aria-label={presenting ? 'Stop sharing' : 'Share screen'}
            disabled={screen.starting || someoneElse}
            // Phones and tablets: kept clickable (dimmed) so the toast explains why it cannot work there.
            title={
              someoneElse
                ? `${nameOf(screen.presenterId!)} is presenting`
                : presenting
                  ? 'Stop sharing your screen'
                  : canShareScreen()
                    ? 'Share your screen with the room'
                    : 'Phones and tablets can watch a shared screen, but not present'
            }
            className={cn(buttonStyles('ghost', 'sm', 'h-9'), presenting && 'bg-rose-50 text-rose-700 hover:bg-rose-100', !canShareScreen() && 'opacity-60')}
          >
            {presenting ? <ScreenShareOff className="size-4" /> : <MonitorUp className="size-4" />}
            <span className="hidden sm:inline">{presenting ? 'Stop sharing' : 'Share screen'}</span>
          </button>
          <button
            type="button"
            onClick={() => setBoardOpen(true)}
            aria-label="Whiteboard"
            title="Open the room's whiteboard"
            className={buttonStyles('ghost', 'sm', 'h-9')}
          >
            <PenLine className="size-4" />
            <span className="hidden sm:inline">Whiteboard</span>
          </button>
        </Panel>
      )}

      {room && stream && (
        <ScreenStage
          stream={stream}
          mine={presenting}
          presenterName={screen.presenterId ? nameOf(screen.presenterId) : 'Someone'}
          viewers={screen.viewers}
          onStop={() => managerRef.current?.stopPresenting()}
        />
      )}

      {room && boardOpen && socket && (
        <WhiteboardOverlay
          socket={socket}
          roomId={room.id}
          roomName={room.name}
          nameOf={nameOf}
          onClose={() => setBoardOpen(false)}
          onLost={() => {
            setBoardOpen(false);
            onToast('The whiteboard closed: you are no longer in this meeting.');
          }}
        />
      )}
    </>
  );
}
