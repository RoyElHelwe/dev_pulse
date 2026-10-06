'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { IconButton } from '@/components/ui/IconButton';
import { officeEvents } from '@/features/office/events';
import { useEscape } from '@/lib/escape';
import { Leaderboard } from './Leaderboard';
import { GAME_PANELS } from './registry';
import type { GameKind } from './types';

export interface GameHostProps {
  socket: Socket | null;
  me: { id: string; name: string; character: string };
}

interface ActiveGame {
  kind: GameKind;
  objectId: string;
  name: string;
}

export function GameHost({ socket, me }: GameHostProps) {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [mounted, setMounted] = useState(false);

  const activeGameRef = useRef<ActiveGame | null>(null);
  activeGameRef.current = activeGame;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (activeGameRef.current && socket) {
      socket.emit('game:leave', { id: activeGameRef.current.objectId });
    }
    setActiveGame(null);
  }, [socket]);

  useEscape(!!activeGame, handleClose);

  useEffect(() => {
    return officeEvents.on('object:interact', (e) => {
      // Ignore if a game is already open
      if (activeGameRef.current) return;

      if (e.type === 'foosball' || e.type === 'uno' || e.type === 'lego') {
        const defaultName =
          e.type === 'foosball' ? 'Foosball table' : e.type === 'uno' ? 'Uno table' : 'Lego wall';
        setActiveGame({
          kind: e.type,
          objectId: e.id,
          name: e.name || defaultName,
        });
      }
    });
  }, []);

  if (!mounted || !activeGame || !socket || typeof document === 'undefined') {
    return null;
  }

  const PanelComponent = GAME_PANELS[activeGame.kind];

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeGame.name}
        data-captures-keys=""
        tabIndex={-1}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">{activeGame.name}</h2>
          <IconButton aria-label="Close game" onClick={handleClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <Suspense
            fallback={
              <div className="flex h-36 items-center justify-center text-sm text-zinc-400">
                Loading {activeGame.name}...
              </div>
            }
          >
            <PanelComponent
              objectId={activeGame.objectId}
              name={activeGame.name}
              socket={socket}
              me={me}
              onClose={handleClose}
            />
          </Suspense>
          <Leaderboard game={activeGame.kind} socket={socket} className="mt-4" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
