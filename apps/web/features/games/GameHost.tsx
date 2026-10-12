/**
 * Full-screen modal overlay hosting office interactive games (Foosball, Uno, Lego).
 * Listens for furniture interaction events, manages fullscreen presentation, and renders game panels.
 */

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Socket } from 'socket.io-client';
import { officeEvents } from '@/features/office/events';
import { useEscape } from '@/lib/escape';
import { GameChromeContext, type GameChromeInfo } from './GameChrome';
import { GameHostHeader } from './GameHostHeader';
import { GAME_PANELS } from './registry';
import type { GameKind } from './types';

/** Fallback display names for interactive game objects in the office. */
const DEFAULT_GAME_NAMES: Record<GameKind, string> = {
  foosball: 'Baby foot table',
  uno: 'Uno table',
  lego: 'Lego wall',
};

/** Props for the GameHost modal overlay component. */
export interface GameHostProps {
  /** Socket.io client instance for office and game communication. */
  socket: Socket | null;
  /** Authenticated user identity and avatar character reference. */
  me: { id: string; name: string; character: string };
  /** Callback notified when a full-screen game panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

interface ActiveGame {
  kind: GameKind;
  objectId: string;
  name: string;
}

/**
 * Modal host container rendering full-screen interactive game panels.
 */
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
    // WHY: Exit browser fullscreen on leave to restore standard window layout.
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

  // WHY: Allow Escape key to dismiss the full-screen game panel as standard modal accessibility.
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
      // WHY: Ignore interaction events if a game is already active to prevent opening nested panels.
      if (activeGameRef.current) return;

      if (e.type === 'foosball' || e.type === 'uno' || e.type === 'lego') {
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
        const defaultName = DEFAULT_GAME_NAMES[e.type];
        const name =
          e.type === 'foosball' && (!e.name || e.name === 'Foosball table')
            ? defaultName
            : e.name || defaultName;
        setActiveGame({ kind: e.type, objectId: e.id, name });
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
        /* WHY stopPropagation: Isolate keyboard events so office avatar navigation keys (WASD/arrows) do not move character in the background */
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className="fixed inset-0 z-[70] flex h-dvh flex-col bg-zinc-50"
      >
        <GameHostHeader
          name={activeGame.name}
          gameKind={activeGame.kind}
          chromeInfo={chromeInfo}
          leaderboardOpen={leaderboardOpen}
          onToggleLeaderboard={() => setLeaderboardOpen((prev) => !prev)}
          onClose={handleClose}
        />

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
