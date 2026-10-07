'use client';

import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { useKeybinds } from '@/features/settings/keybinds';
import { keyName } from '@/features/voice/settings';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
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
import { useFoosballKeys } from './useFoosballKeys';

function playBeep(freq: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function TeamBox({ side, players, myId, isLobby, isMySide, canSit, onSit, onStand }: TeamBoxProps) {
  const isA = side === 'A';
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', isA ? 'text-blue-700' : 'text-red-700')}>
          <span className={cn('size-2 rounded-full', isA ? 'bg-blue-600' : 'bg-red-600')} />
          {isA ? 'Team Left' : 'Team Right'}
        </span>
        <span className="text-[11px] font-medium text-zinc-400">{players.length}/2 seated</span>
      </div>

      <div className="flex-1 space-y-1.5 min-h-[64px]">
        {players.length === 0 ? (
          <div className="flex h-14 items-center justify-center text-xs italic text-zinc-400">No players seated</div>
        ) : (
          players.map((player) => (
            <div key={player.userId} className="flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
              <CharacterFace character={player.character} className="size-6 shrink-0" />
              <span className="flex-1 truncate font-medium text-zinc-800">{player.name}</span>
              {player.userId === myId && <span className={cn('text-[10px] font-semibold', isA ? 'text-blue-600' : 'text-red-600')}>(You)</span>}
              {player.away && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1 rounded">away</span>}
            </div>
          ))
        )}
      </div>

      <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex justify-end">
        {isMySide ? (
          <Button variant="secondary" size="sm" disabled={!isLobby} onClick={onStand}>Stand up</Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={!isLobby || !canSit} onClick={() => onSit(side)}>
            {isA ? 'Sit Left' : 'Sit Right'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FoosballPanel({ objectId, name, socket, me, onClose }: GamePanelProps) {
  const { state, status, error, send, leave, onEvent } = useGameSession<FoosballView>(socket, 'foosball', objectId);
  const view: FoosballView = isFoosballView(state) ? state : DEFAULT_VIEW;

  const keybinds = useKeybinds();
  const kickKeyName = keyName(keybinds.foosKick);
  const switchKeyName = keyName(keybinds.foosSwitch);

  const { activeRod, selectRod } = useFoosballKeys({
    you: view.you,
    phase: view.phase,
    send: (action: FoosballAction) => send(action),
  });

  useEffect(() => {
    return onEvent((event) => {
      if (event === 'goal') playBeep(587.33, 0.35, 'triangle');
      else if (event === 'kick') playBeep(220, 0.05, 'sine');
    });
  }, [onEvent]);

  const handleLeave = () => {
    leave();
    onClose();
  };

  const isLobbyOrEnded = view.phase === 'lobby' || view.phase === 'ended';
  const seatsA = view.seats.A;
  const seatsB = view.seats.B;
  const youSeated = Boolean(view.you?.side);
  const equalTeams = seatsA.length > 0 && seatsA.length === seatsB.length;
  const canStart = view.phase === 'lobby' && youSeated && equalTeams;

  let startHint = '';
  if (view.phase === 'lobby') {
    if (!youSeated) startHint = 'Take a seat to start the match';
    else if (seatsA.length === 0 || seatsB.length === 0) startHint = 'Both teams need players (1v1 or 2v2)';
    else if (seatsA.length !== seatsB.length) startHint = 'Teams must have equal players (1v1 or 2v2)';
  }

  return (
    <div data-captures-keys="" className="flex flex-col gap-4 text-left">
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">{name}</span>
          <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
            <Users className="size-3 text-zinc-500" />
            <span>{view.spectators} spectator{view.spectators === 1 ? '' : 's'}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleLeave}>Leave game</Button>
      </div>

      {status === 'joining' && <div className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 text-center">Joining foosball match...</div>}
      {status === 'error' && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 text-center">{error?.message || 'Error connecting to match'}</div>}

      <div className="grid grid-cols-2 gap-3">
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

      {view.phase === 'lobby' && (
        <div className="flex flex-col items-center gap-1 py-1">
          <Button variant="primary" size="sm" disabled={!canStart} onClick={() => send({ type: 'start' })}>Start match</Button>
          {startHint && <span className="text-xs text-zinc-500">{startHint}</span>}
        </div>
      )}

      {view.phase === 'ended' && youSeated && (
        <div className="flex flex-col items-center gap-1 py-1">
          <Button variant="primary" size="sm" onClick={() => send({ type: 'rematch' })}>Rematch</Button>
        </div>
      )}

      <FoosballCanvas
        view={view}
        activeRod={activeRod}
        youSide={view.you?.side ?? null}
        onRematch={() => send({ type: 'rematch' })}
      />

      {view.you ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 text-xs text-zinc-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-zinc-700">Active rod:</span>
            <div className="flex items-center gap-1">
              {view.you.rods.map((rod) => (
                <button
                  key={rod}
                  type="button"
                  onClick={() => selectRod(rod)}
                  className={cn(
                    'rounded-md px-2 py-0.5 font-medium transition cursor-pointer',
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

          <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
            <span><Kbd>W</Kbd>/<Kbd>S</Kbd> or <Kbd>↑</Kbd>/<Kbd>↓</Kbd> Move</span>
            <span><Kbd>{kickKeyName}</Kbd> Kick</span>
            <span><Kbd>{switchKeyName}</Kbd> or <Kbd>1</Kbd>–<Kbd>4</Kbd> Switch</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-2 text-xs text-zinc-400">
          Spectating match — take a seat above to play
        </div>
      )}
    </div>
  );
}
