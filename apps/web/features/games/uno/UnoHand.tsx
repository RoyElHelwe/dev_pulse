/**
 * Player hand component for active Uno matches.
 * Displays the local player's Uno card hand or spectator banner.
 */

'use client';

import type { Card } from './types';
import { UnoCard } from './UnoCard';

interface UnoHandProps {
  hand: Card[];
  playable: number[];
  isMyTurn: boolean;
  isPlayer: boolean;
  isSpectator: boolean;
  onCardClick: (cardId: number, isWild: boolean) => void;
}

/**
 * Renders the player's current hand of cards or spectator status.
 */
export function UnoHand({
  hand,
  playable,
  isMyTurn,
  isPlayer,
  isSpectator,
  onCardClick,
}: UnoHandProps) {
  if (isSpectator) {
    return (
      <div className="shrink-0 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-xs font-medium text-zinc-500">
        Spectating
      </div>
    );
  }

  if (!isPlayer) return null;

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
        <span>Your hand ({hand.length} cards)</span>
        {isMyTurn && (
          <span className="font-semibold text-emerald-600">Your turn — play a card or draw</span>
        )}
      </div>
      <div className="flex gap-2 justify-start sm:justify-center overflow-x-auto p-2 bg-zinc-50/50 rounded-xl border border-zinc-200/80">
        {hand.map((card) => {
          const isPlayable = isMyTurn && playable.includes(card.id);
          const isWild = card.color === 'wild' || card.value === 'wild' || card.value === 'wild4';
          return (
            <div key={card.id} className="shrink-0">
              <UnoCard
                card={card}
                isButton
                disabled={!isPlayable}
                onClick={() => onCardClick(card.id, isWild)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
