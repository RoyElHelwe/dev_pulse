'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { officeEvents } from '@/features/office/events';
import { useEscape } from '@/lib/escape';
import { GameChromeContext, type GameChromeInfo } from './GameChrome';
import { Leaderboard } from './Leaderboard';
import { GAME_PANELS } from './registry';
import type { GameKind } from './types';

export interface GameHostProps {
  socket: Socket | null;
  me: { id: string; name: string; character: string };
  /** Callback notified when a full-screen game panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

interface ActiveGame {
  kind: GameKind;
  objectId: string;
  name: string;
}

export function GameHost({ socket, me, onOpenChange }: GameHostProps) {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [mounted, setMounted] = useState(false);
  const [chromeInfo, setChromeInfo] = useState<GameChromeInfo>({ players: null, spectators: null });
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const activeGameRef = useRef<ActiveGame | null>(null);
  activeGameRef.current = activeGame;

  // Notify parent when a game opens or closes so background rendering can be paused
  useEffect(() => {
    const isOpen = Boolean(activeGame);
    onOpenChange?.(isOpen);
    return () => {
      if (isOpen) {
        onOpenChange?.(false);
      }
    };
  }, [activeGame, onOpenChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (activeGameRef.current && socket) {
      socket.emit('game:leave', { id: activeGameRef.current.objectId });
    }
    setActiveGame(null);
    setLeaderboardOpen(false);
    setChromeInfo({ players: null, spectators: null });
  }, [socket]);

  useEscape(!!activeGame, handleClose);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    return officeEvents.on('object:interact', (e) => {
      // Ignore if a game is already open
      if (activeGameRef.current) return;

      if (e.type === 'foosball' || e.type === 'uno' || e.type === 'lego') {
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
        const defaultName =
          e.type === 'foosball' ? 'Baby foot table' : e.type === 'uno' ? 'Uno table' : 'Lego wall';
        const name =
          e.type === 'foosball' && (!e.name || e.name === 'Foosball table')
            ? defaultName
            : e.name || defaultName;
        setActiveGame({
          kind: e.type,
          objectId: e.id,
          name,
        });
      }
    });
  }, []);

  if (!mounted || !activeGame || !socket || typeof document === 'undefined') {
    return null;
  }

  const PanelComponent = GAME_PANELS[activeGame.kind];

  return createPortal(
    <GameChromeContext.Provider value={setChromeInfo}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeGame.name}
        data-captures-keys=""
        tabIndex={-1}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className="fixed inset-0 z-[70] flex h-dvh flex-col bg-zinc-50"
      >
        <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 truncate">{activeGame.name}</h2>
            {chromeInfo.players != null && (
              <span
                data-testid="game-chrome-players"
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 shrink-0"
              >
                {chromeInfo.players} playing
              </span>
            )}
            {chromeInfo.spectators != null && (
              <span
                data-testid="game-chrome-spectators"
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 shrink-0"
              >
                {chromeInfo.spectators} watching
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              data-testid="game-leaderboard-toggle"
              aria-pressed={leaderboardOpen}
              variant="secondary"
              size="sm"
              onClick={() => setLeaderboardOpen((prev) => !prev)}
            >
              Leaderboard
            </Button>
            <Button
              data-testid="game-leave"
              variant="secondary"
              size="sm"
              onClick={handleClose}
            >
              Leave
            </Button>
            <IconButton aria-label="Close game" onClick={handleClose}>
              <X className="size-4" />
            </IconButton>
          </div>

          {leaderboardOpen && (
            <Leaderboard
              game={activeGame.kind}
              socket={socket}
              className="absolute top-12 right-4 z-50 w-80 shadow-xl max-h-[70vh] overflow-auto bg-white"
            />
          )}
        </header>

        <main className="relative flex-1 min-h-0 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
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
        </main>
      </div>
    </GameChromeContext.Provider>,
    document.body,
  );
}
