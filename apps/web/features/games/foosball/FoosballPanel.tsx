'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
import { useGameChromeInfo } from '../GameChrome';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';
import {
  DEFAULT_VIEW,
  isFoosballView,
  ROD_NAMES,
  type FoosballAction,
  type FoosballPlayer,
  type FoosballSide,
  type FoosballView,
} from './constants';
import { FoosballCanvas } from './FoosballCanvas';
import { useFoosballMouse } from './useFoosballMouse';

function playBeep(freq: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

interface TeamBoxProps {
  side: FoosballSide;
  players: FoosballPlayer[];
  myId: string;
  isLobby: boolean;
  isMySide: boolean;
  canSit: boolean;
  onSit: (side: FoosballSide) => void;
  onStand: () => void;
}

function TeamBox({
  side,
  players,
  myId,
  isLobby,
  isMySide,
  canSit,
  onSit,
  onStand,
}: TeamBoxProps) {
  const isA = side === 'A';
  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2 sm:p-2.5 text-xs">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold',
            isA ? 'text-blue-700' : 'text-red-700',
          )}
        >
          <span className={cn('size-2 rounded-full', isA ? 'bg-blue-600' : 'bg-red-600')} />
          {isA ? 'Team Left' : 'Team Right'}
        </span>
        <span className="text-[11px] font-medium text-zinc-400">
          {players.length}/2 seated
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-h-[30px] py-0.5 overflow-x-auto">
        {players.length === 0 ? (
          <span className="text-xs italic text-zinc-400">No players seated</span>
        ) : (
          players.map((player) => (
            <div
              key={player.userId}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200/60 bg-white px-2 py-1 text-xs shadow-2xs shrink-0"
            >
              <CharacterFace character={player.character} className="size-4 shrink-0" />
              <span className="max-w-[85px] truncate font-medium text-zinc-800">
                {player.name}
              </span>
              {player.userId === myId && (
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    isA ? 'text-blue-600' : 'text-red-600',
                  )}
                >
                  (You)
                </span>
              )}
              {player.away && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1 rounded">
                  away
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-1 pt-1 border-t border-zinc-200/60 flex justify-end">
        {isMySide ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={!isLobby}
            onClick={onStand}
          >
            Stand up
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-xs"
            data-testid={`foosball-sit-${side}`}
            disabled={!isLobby || !canSit}
            onClick={() => onSit(side)}
          >
            {isA ? 'Sit Left' : 'Sit Right'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FoosballPanel({ objectId, socket, me }: GamePanelProps) {
  const { state, status, error, send, onEvent } = useGameSession<FoosballView>(
    socket,
    'foosball',
    objectId,
  );
  const view: FoosballView = isFoosballView(state) ? state : DEFAULT_VIEW;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { activeRod, selectRod, locked, cursorPosRef, onPointerMove, onPointerDown } =
    useFoosballMouse({
      you: view.you,
      phase: view.phase,
      send: (action: FoosballAction) => send(action),
      canvasRef,
    });

  const seatsA = view.seats.A;
  const seatsB = view.seats.B;

  // Report counts to GameHost full-screen top bar
  useGameChromeInfo({
    players: seatsA.length + seatsB.length,
    spectators: view.spectators,
  });

  useEffect(() => {
    return onEvent((event) => {
      if (event === 'goal') playBeep(587.33, 0.35, 'triangle');
      else if (event === 'kick') playBeep(220, 0.05, 'sine');
    });
  }, [onEvent]);

  const isLobbyOrEnded = view.phase === 'lobby' || view.phase === 'ended';
  const youSeated = Boolean(view.you?.side);
  const equalTeams = seatsA.length > 0 && seatsA.length === seatsB.length;
  const canStart = view.phase === 'lobby' && youSeated && equalTeams;

  let startHint = '';
  if (view.phase === 'lobby') {
    if (!youSeated) startHint = 'Take a seat to start the match';
    else if (seatsA.length === 0 || seatsB.length === 0)
      startHint = 'Both teams need players (1v1 or 2v2)';
    else if (seatsA.length !== seatsB.length)
      startHint = 'Teams must have equal players (1v1 or 2v2)';
  }

  return (
    <div
      data-captures-keys=""
      data-testid="foosball-panel"
      data-phase={view.phase}
      className="flex flex-col h-full w-full min-h-0 overflow-hidden select-none text-left"
    >
      {status === 'joining' && (
        <div className="shrink-0 mb-1.5 rounded-lg bg-zinc-100 px-3 py-1 text-xs text-zinc-600 text-center">
          Joining Baby foot match...
        </div>
      )}
      {status === 'error' && (
        <div className="shrink-0 mb-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-700 text-center">
          {error?.message || 'Error connecting to match'}
        </div>
      )}

      {/* Lobby / Ended: compact row of two TeamBoxes (+ Start match / Rematch + start hint) above the canvas */}
      {isLobbyOrEnded && (
        <div className="shrink-0 mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamBox
            side="A"
            players={seatsA}
            myId={me.id}
            isLobby={isLobbyOrEnded}
            isMySide={view.you?.side === 'A'}
            canSit={!youSeated && seatsA.length < 2}
            onSit={(side) => send({ type: 'sit', side })}
            onStand={() => send({ type: 'stand' })}
          />

          <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-2 text-center min-w-[140px]">
            {view.phase === 'lobby' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  data-testid="foosball-start"
                  disabled={!canStart}
                  onClick={() => send({ type: 'start' })}
                >
                  Start match
                </Button>
                {startHint && (
                  <span className="text-[11px] text-zinc-500 max-w-[180px] leading-tight">
                    {startHint}
                  </span>
                )}
              </>
            )}

            {view.phase === 'ended' && youSeated && (
              <Button variant="primary" size="sm" onClick={() => send({ type: 'rematch' })}>
                Rematch
              </Button>
            )}
          </div>

          <TeamBox
            side="B"
            players={seatsB}
            myId={me.id}
            isLobby={isLobbyOrEnded}
            isMySide={view.you?.side === 'B'}
            canSit={!youSeated && seatsB.length < 2}
            onSit={(side) => send({ type: 'sit', side })}
            onStand={() => send({ type: 'stand' })}
          />
        </div>
      )}

      {/* Scalable canvas area */}
      <FoosballCanvas
        canvasRef={canvasRef}
        view={view}
        activeRod={activeRod}
        youSide={view.you?.side ?? null}
        locked={locked}
        cursorPosRef={cursorPosRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onRematch={() => send({ type: 'rematch' })}
      />

      {/* Slim strip under the canvas: rod chips (shown whenever seated, including lobby) and mouse hint */}
      <div className="shrink-0 mt-1.5 flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-xs text-zinc-600 rounded-lg border border-zinc-200/80 bg-zinc-50/70">
        {view.you ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-zinc-700 text-[11px]">Active rod:</span>
            <div className="flex items-center gap-1">
              {view.you.rods.map((rod) => (
                <button
                  key={rod}
                  type="button"
                  data-testid={`foosball-rod-${rod}`}
                  onClick={() => selectRod(rod)}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium transition cursor-pointer select-none',
                    rod === activeRod
                      ? 'bg-amber-400 text-zinc-950 font-semibold shadow-xs ring-1 ring-amber-500'
                      : 'bg-white text-zinc-700 hover:bg-zinc-200 ring-1 ring-zinc-200',
                  )}
                >
                  {rod + 1}: {ROD_NAMES[rod]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-400 italic">
            Spectating match — take a seat above to play
          </div>
        )}

        <div className="text-[11px] text-zinc-500 select-none truncate">
          Move the mouse to move the rod · click a rod to select it · click or flick to kick
        </div>
      </div>

      {/* active-rod-pos for test assertion */}
      <span
        data-testid="active-rod-pos"
        data-y={view.you ? (view.rods[view.you.side]?.[activeRod]?.y ?? 0) : 0}
        className="hidden"
      />
    </div>
  );
}