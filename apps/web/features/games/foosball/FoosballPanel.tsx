'use client';

/**
 * Main Foosball game panel container.
 * Coordinates network session state, sound effects, lobby roster controls, and the interactive table.
 */

import { useEffect, useRef } from 'react';
import { useGameChromeInfo } from '../GameChrome';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';
import {
  DEFAULT_VIEW,
  isFoosballView,
  type FoosballAction,
  type FoosballView,
} from './constants';
import { FoosballLobby } from './FoosballLobby';
import { FoosballTable } from './FoosballTable';
import { useFoosballMouse } from './useFoosballMouse';

const GOAL_BEEP_FREQ_HZ = 587.33;
const GOAL_BEEP_DURATION_S = 0.35;
const KICK_BEEP_FREQ_HZ = 220;
const KICK_BEEP_DURATION_S = 0.05;
const BEEP_VOLUME = 0.08;

/** Plays a synthesized tone using the Web Audio API for kick or goal game events. */
function playBeep(freqHz: number, durationS: number, type: OscillatorType = 'sine') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqHz, ctx.currentTime);
    gain.gain.setValueAtTime(BEEP_VOLUME, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationS);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationS);
  } catch {}
}

/**
 * Foosball game panel entry point mounted inside the workspace GameHost.
 */
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
      if (event === 'goal') playBeep(GOAL_BEEP_FREQ_HZ, GOAL_BEEP_DURATION_S, 'triangle');
      else if (event === 'kick') playBeep(KICK_BEEP_FREQ_HZ, KICK_BEEP_DURATION_S, 'sine');
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

      {/* Lobby / Ended seating and start controls bar */}
      {isLobbyOrEnded && (
        <FoosballLobby
          phase={view.phase}
          seatsA={seatsA}
          seatsB={seatsB}
          myId={me.id}
          youSide={view.you?.side ?? null}
          canStart={canStart}
          startHint={startHint}
          onSit={(side) => send({ type: 'sit', side })}
          onStand={() => send({ type: 'stand' })}
          onStart={() => send({ type: 'start' })}
          onRematch={() => send({ type: 'rematch' })}
        />
      )}

      {/* Table canvas and HUD controls */}
      <FoosballTable
        canvasRef={canvasRef}
        view={view}
        activeRod={activeRod}
        locked={locked}
        cursorPosRef={cursorPosRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        selectRod={selectRod}
        onRematch={() => send({ type: 'rematch' })}
      />
    </div>
  );
}
