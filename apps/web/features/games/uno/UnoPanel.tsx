'use client';

import { useState } from 'react';
import { Crown, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
import { useGameChromeInfo } from '../GameChrome';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';
import { UnoCard } from './UnoCard';
import type { Color, UnoView } from './types';

export default function UnoPanel({ objectId, socket, me }: GamePanelProps) {
  const { state, status, error, send } = useGameSession<UnoView>(socket, 'uno', objectId);
  const [colorPickerCardId, setColorPickerCardId] = useState<number | null>(null);

  useGameChromeInfo({
    players: state ? state.players.length : null,
    spectators: state?.spectators && state.spectators.length > 0 ? state.spectators.length : null,
  });

  const isHost = Boolean(state?.hostId === me.id);
  const isMyTurn = Boolean(state?.phase === 'playing' && state?.turnId === me.id);
  const isPlayer = state?.role === 'player';
  const isSpectator = state?.role === 'spectator';

  const handleSelectColor = (color: Color) => {
    if (colorPickerCardId === null) return;
    send({ type: 'play', cardId: colorPickerCardId, color });
    setColorPickerCardId(null);
  };

  const handleCardClick = (cardId: number, isWild: boolean) => {
    if (!isMyTurn || !state?.playable.includes(cardId)) return;
    if (isWild) {
      setColorPickerCardId(cardId);
    } else {
      send({ type: 'play', cardId });
    }
  };

  const activeColorRing: Record<Color, string> = {
    red: 'ring-4 ring-red-500 shadow-red-500/20',
    yellow: 'ring-4 ring-yellow-400 shadow-yellow-400/20',
    green: 'ring-4 ring-green-600 shadow-green-600/20',
    blue: 'ring-4 ring-blue-600 shadow-blue-600/20',
  };

  const activeColorBg: Record<Color, string> = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-400',
    green: 'bg-green-600',
    blue: 'bg-blue-600',
  };

  const topCardColorRing = (state?.currentColor && activeColorRing[state.currentColor]) || 'ring-2 ring-zinc-300';
  const topCardColorBg = (state?.currentColor && activeColorBg[state.currentColor]) || 'bg-zinc-400';

  const winner = state?.players.find((p) => p.id === state.winnerId);

  return (
    <div
      data-captures-keys=""
      className="flex h-full w-full min-h-0 flex-col p-3 sm:p-4 text-zinc-900 select-none overflow-hidden"
    >
      {/* Action / Session Error (non-fatal) */}
      {error && (
        <div className="shrink-0 mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error.message || 'An error occurred'}
        </div>
      )}

      {/* Loading / Disconnected / Stub / Left States */}
      {status === 'joining' && !state && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          <span className="size-5 animate-spin rounded-full border-2 border-zinc-400 border-r-transparent mb-2" />
          Joining Uno table...
        </div>
      )}

      {status === 'left' && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          You left the Uno table.
        </div>
      )}

      {status === 'error' && !state && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-600">
          {error?.message || 'Error connecting to Uno table.'}
        </div>
      )}

      {state && !state.phase && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          Waiting for game state...
        </div>
      )}

      {/* LOBBY PHASE */}
      {state?.phase === 'lobby' && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Seated Players ({state.players.length}/6)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {state.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-2xs"
                >
                  <CharacterFace character={player.character} className="size-8 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate text-sm font-medium text-zinc-900">{player.name}</span>
                      {player.id === me.id && (
                        <span className="text-xs text-zinc-400">(You)</span>
                      )}
                    </div>
                  </div>
                  {player.id === state.hostId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/60">
                      <Crown className="size-3" />
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>

            {state.spectators && state.spectators.length > 0 && (
              <div className="mt-4 border-t border-zinc-200 pt-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Spectators ({state.spectators.length})
                </span>
                <p className="mt-1 text-xs text-zinc-600">
                  {state.spectators.map((s) => s.name).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Lobby Actions */}
          <div className="flex flex-col items-center justify-center gap-2 pt-2">
            {isHost ? (
              <>
                <Button
                  data-testid="uno-start"
                  aria-label="Start game"
                  variant="primary"
                  size="md"
                  disabled={state.players.length < 2}
                  onClick={() => send({ type: 'start' })}
                >
                  Start game
                </Button>
                {state.players.length < 2 && (
                  <span className="text-xs text-zinc-400">At least 2 players needed to start</span>
                )}
              </>
            ) : (
              <span className="text-sm italic text-zinc-500">Waiting for host to start...</span>
            )}
          </div>
        </div>
      )}

      {/* PLAYING PHASE */}
      {state?.phase === 'playing' && (
        <div className="flex flex-1 min-h-0 flex-col justify-between gap-2 overflow-hidden">
          {/* Opponents row */}
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1">
              {isPlayer ? 'Opponents' : 'Players'}
            </span>
            <div className="flex flex-wrap gap-2">
              {(isPlayer ? state.players.filter((p) => p.id !== me.id) : state.players).map((p) => {
                const isCurrentTurn = p.id === state.turnId;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-2 shadow-2xs transition-all',
                      isCurrentTurn
                        ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-zinc-200 bg-zinc-50/50',
                    )}
                  >
                    <CharacterFace character={p.character} className="size-6 shrink-0" />
                    <div className="flex flex-col">
                      <span className="max-w-[90px] truncate text-xs font-semibold text-zinc-800">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {p.cards} {p.cards === 1 ? 'card' : 'cards'}
                      </span>
                    </div>
                    {isCurrentTurn && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Turn
                      </span>
                    )}
                    {p.saidUno && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs animate-bounce">
                        UNO!
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Draw Banner */}
          {state.pendingDraw > 0 && (
            <div className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-xs font-bold text-amber-900 animate-pulse">
              +{state.pendingDraw} pending — stack a +{state.pendingKind === 'draw2' ? 2 : 4} or draw {state.pendingDraw}
            </div>
          )}

          {/* Centre Table Area */}
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-100/60 p-3 sm:p-4">
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {/* Draw pile button */}
              <button
                type="button"
                data-testid="uno-draw"
                aria-label="Draw card"
                disabled={!isMyTurn || state.drewCardId != null || !isPlayer}
                onClick={() => send({ type: 'draw' })}
                className={cn(
                  'relative flex w-[clamp(5rem,min(8vw,14vh),8.5rem)] h-[clamp(7.5rem,min(11.5vw,20vh),12.75rem)] flex-col items-center justify-between rounded-2xl border-2 border-zinc-700 bg-zinc-800 p-2 sm:p-3 text-white shadow-md transition-all select-none',
                  isMyTurn && state.drewCardId == null && isPlayer
                    ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-zinc-500 active:scale-95'
                    : 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Deck
                </span>
                <span className="text-2xl sm:text-4xl font-black text-amber-400">
                  {state.drawPile}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-300">Draw</span>
              </button>

              {/* Direction arrow */}
              <div
                className="flex flex-col items-center gap-1 text-zinc-500 text-xs font-medium"
                title={state.direction === 1 ? 'Direction: Clockwise' : 'Direction: Counter-clockwise'}
              >
                {state.direction === 1 ? (
                  <RotateCw className="size-6 sm:size-8 text-zinc-600" />
                ) : (
                  <RotateCcw className="size-6 sm:size-8 text-zinc-600" />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {state.direction === 1 ? 'CW' : 'CCW'}
                </span>
              </div>

              {/* Top card of discard pile */}
              <div className="flex flex-col items-center gap-1.5">
                {state.top ? (
                  <div className={cn('rounded-2xl p-1 transition-all', topCardColorRing)}>
                    <UnoCard card={state.top} size="lg" />
                  </div>
                ) : (
                  <div className="flex w-[clamp(5rem,min(8vw,14vh),8.5rem)] h-[clamp(7.5rem,min(11.5vw,20vh),12.75rem)] items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white text-xs text-zinc-400">
                    Empty
                  </div>
                )}
                {state.currentColor && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 capitalize">
                    <span className={cn('size-2.5 rounded-full', topCardColorBg)} />
                    <span>{state.currentColor}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Turn indicator & Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isMyTurn && (
                <div
                  data-testid="uno-turn"
                  aria-label="Your turn"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 animate-pulse"
                >
                  Your turn
                </div>
              )}

              {state.drewCardId != null && (
                <Button
                  data-testid="uno-pass"
                  aria-label="Pass turn"
                  variant="secondary"
                  size="sm"
                  onClick={() => send({ type: 'pass' })}
                >
                  Pass
                </Button>
              )}

              {isPlayer && state.hand.length <= 2 && (
                <Button
                  data-testid="uno-uno"
                  aria-label="Call Uno"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-black animate-bounce shadow-md"
                  onClick={() => send({ type: 'uno' })}
                >
                  UNO!
                </Button>
              )}

              {state.vulnerableId && state.vulnerableId !== me.id && (
                <Button
                  data-testid="uno-catch"
                  aria-label="Catch player"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold animate-pulse shadow-md"
                  onClick={() => send({ type: 'catch' })}
                >
                  Catch!
                </Button>
              )}
            </div>
          </div>

          {/* 4-Colour Picker for Wild Cards */}
          {colorPickerCardId !== null && (
            <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-zinc-800">
                Choose a colour for wild card:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="uno-color-red"
                  aria-label="Choose red"
                  onClick={() => handleSelectColor('red')}
                  className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  Red
                </button>
                <button
                  type="button"
                  data-testid="uno-color-yellow"
                  aria-label="Choose yellow"
                  onClick={() => handleSelectColor('yellow')}
                  className="h-8 px-3 rounded-lg bg-yellow-400 text-zinc-950 text-xs font-bold hover:bg-yellow-500 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  Yellow
                </button>
                <button
                  type="button"
                  data-testid="uno-color-green"
                  aria-label="Choose green"
                  onClick={() => handleSelectColor('green')}
                  className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  Green
                </button>
                <button
                  type="button"
                  data-testid="uno-color-blue"
                  aria-label="Choose blue"
                  onClick={() => handleSelectColor('blue')}
                  className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  Blue
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColorPickerCardId(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Hand Area */}
          {isSpectator && (
            <div className="shrink-0 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-xs font-medium text-zinc-500">
              Spectating
            </div>
          )}

          {isPlayer && (
            <div className="flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                <span>Your hand ({state.hand.length} cards)</span>
                {isMyTurn && (
                  <span className="font-semibold text-emerald-600">
                    Your turn — play a card or draw
                  </span>
                )}
              </div>
              <div className="flex gap-2 justify-start sm:justify-center overflow-x-auto p-2 bg-zinc-50/50 rounded-xl border border-zinc-200/80">
                {state.hand.map((card) => {
                  const isPlayable = isMyTurn && state.playable.includes(card.id);
                  const isWild =
                    card.color === 'wild' || card.value === 'wild' || card.value === 'wild4';
                  return (
                    <div key={card.id} className="shrink-0">
                      <UnoCard
                        card={card}
                        isButton
                        disabled={!isPlayable}
                        onClick={() => handleCardClick(card.id, isWild)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Log Lines */}
          {state.log && state.log.length > 0 && (
            <div className="shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 p-2 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
                Game Log
              </span>
              <div className="flex flex-col gap-0.5 max-h-12 overflow-y-auto font-mono text-[11px] text-zinc-600">
                {state.log.map((line, idx) => (
                  <div key={idx} className="truncate">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENDED PHASE */}
      {state?.phase === 'ended' && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto">
          <div
            data-testid="uno-winner"
            aria-label="Winner banner"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-6 text-center max-w-md w-full"
          >
            <div className="text-3xl">🏆</div>
            <div className="text-base font-bold text-zinc-900">
              {state.winnerId === me.id
                ? 'You won the game!'
                : `${winner ? winner.name : 'Unknown player'} won the game!`}
            </div>
            <p className="text-xs text-zinc-600">
              The game has ended.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 pt-2">
            {isHost ? (
              <Button
                data-testid="uno-again"
                aria-label="Play again"
                variant="primary"
                size="md"
                onClick={() => send({ type: 'again' })}
              >
                Play again
              </Button>
            ) : (
              <span className="text-sm italic text-zinc-500">
                Waiting for host to start another game...
              </span>
            )}
          </div>

          {state.log && state.log.length > 0 && (
            <div className="w-full max-w-md rounded-xl border border-zinc-200/80 bg-zinc-50 p-2.5 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Final Game Log
              </span>
              <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto font-mono text-[11px] text-zinc-600">
                {state.log.map((line, idx) => (
                  <div key={idx} className="truncate">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}