/**
 * Uno in-play table screen component.
 * Displays seated opponents, center draw and discard piles, active hand, and round controls.
 */

'use client';

import { useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  ACTIVE_COLOR_BG,
  ACTIVE_COLOR_RING,
  DEFAULT_COLOR_BG,
  DEFAULT_COLOR_RING,
  DRAW_FOUR_COUNT,
  DRAW_TWO_COUNT,
  UNO_CALL_MAX_HAND_SIZE,
} from './constants';
import type { Color, UnoView } from './types';
import { UnoCard } from './UnoCard';
import { UnoColorPicker } from './UnoColorPicker';
import { UnoHand } from './UnoHand';
import { UnoOpponents } from './UnoOpponents';

interface UnoTableProps {
  state: UnoView;
  meId: string;
  onSend: (action: { type: string; [key: string]: unknown }) => void;
}

interface CenterBoardProps {
  state: UnoView;
  meId: string;
  isMyTurn: boolean;
  isPlayer: boolean;
  onSend: (action: { type: string; [key: string]: unknown }) => void;
}

function CenterBoard({ state, meId, isMyTurn, isPlayer, onSend }: CenterBoardProps) {
  const topCardColorRing = (state.currentColor && ACTIVE_COLOR_RING[state.currentColor]) || DEFAULT_COLOR_RING;
  const topCardColorBg = (state.currentColor && ACTIVE_COLOR_BG[state.currentColor]) || DEFAULT_COLOR_BG;

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-100/60 p-3 sm:p-4">
      <div className="flex items-center justify-center gap-6 sm:gap-10">
        {/* Draw pile button */}
        <button
          type="button"
          data-testid="uno-draw"
          aria-label="Draw card"
          disabled={!isMyTurn || state.drewCardId != null || !isPlayer}
          onClick={() => onSend({ type: 'draw' })}
          className={cn(
            'relative flex w-[clamp(5rem,min(8vw,14vh),8.5rem)] h-[clamp(7.5rem,min(11.5vw,20vh),12.75rem)] flex-col items-center justify-between rounded-2xl border-2 border-zinc-700 bg-zinc-800 p-2 sm:p-3 text-white shadow-md transition-all select-none',
            isMyTurn && state.drewCardId == null && isPlayer
              ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-zinc-500 active:scale-95'
              : 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">Deck</span>
          <span className="text-2xl sm:text-4xl font-black text-amber-400">{state.drawPile}</span>
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
            onClick={() => onSend({ type: 'pass' })}
          >
            Pass
          </Button>
        )}

        {isPlayer && state.hand.length <= UNO_CALL_MAX_HAND_SIZE && (
          <Button
            data-testid="uno-uno"
            aria-label="Call Uno"
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white font-black animate-bounce shadow-md"
            onClick={() => onSend({ type: 'uno' })}
          >
            UNO!
          </Button>
        )}

        {state.vulnerableId && state.vulnerableId !== meId && (
          <Button
            data-testid="uno-catch"
            aria-label="Catch player"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold animate-pulse shadow-md"
            onClick={() => onSend({ type: 'catch' })}
          >
            Catch!
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the active Uno table board with player cards, piles, and actions.
 */
export function UnoTable({ state, meId, onSend }: UnoTableProps) {
  const [colorPickerCardId, setColorPickerCardId] = useState<number | null>(null);

  const isMyTurn = Boolean(state.turnId === meId);
  const isPlayer = state.role === 'player';
  const isSpectator = state.role === 'spectator';

  const handleSelectColor = (color: Color) => {
    if (colorPickerCardId === null) return;
    onSend({ type: 'play', cardId: colorPickerCardId, color });
    setColorPickerCardId(null);
  };

  const handleCardClick = (cardId: number, isWild: boolean) => {
    if (!isMyTurn || !state.playable.includes(cardId)) return;
    if (isWild) {
      setColorPickerCardId(cardId);
    } else {
      onSend({ type: 'play', cardId });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col justify-between gap-2 overflow-hidden">
      <UnoOpponents players={state.players} meId={meId} turnId={state.turnId} isPlayer={isPlayer} />

      {state.pendingDraw > 0 && (
        <div className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-xs font-bold text-amber-900 animate-pulse">
          +{state.pendingDraw} pending — stack a +{state.pendingKind === 'draw2' ? DRAW_TWO_COUNT : DRAW_FOUR_COUNT} or draw {state.pendingDraw}
        </div>
      )}

      <CenterBoard state={state} meId={meId} isMyTurn={isMyTurn} isPlayer={isPlayer} onSend={onSend} />

      {colorPickerCardId !== null && (
        <UnoColorPicker onSelectColor={handleSelectColor} onCancel={() => setColorPickerCardId(null)} />
      )}

      <UnoHand
        hand={state.hand}
        playable={state.playable}
        isMyTurn={isMyTurn}
        isPlayer={isPlayer}
        isSpectator={isSpectator}
        onCardClick={handleCardClick}
      />

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
  );
}
