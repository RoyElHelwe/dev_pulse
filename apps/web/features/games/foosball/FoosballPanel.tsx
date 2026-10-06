'use client';

import { Button } from '@/components/ui/Button';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';

export default function FoosballPanel({ objectId, name, socket, onClose }: GamePanelProps) {
  const { state, status, error, leave } = useGameSession(socket, 'foosball', objectId);

  const handleLeave = () => {
    leave();
    onClose();
  };

  const playerCount =
    state && typeof state === 'object' && 'players' in state && Array.isArray((state as { players?: unknown[] }).players)
      ? (state as { players: unknown[] }).players.length
      : null;

  return (
    <div
      data-captures-keys=""
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center"
    >
      <div className="mb-1 text-base font-medium text-zinc-900">{name}</div>
      <p className="mb-4 text-xs text-zinc-500">
        {status === 'joining' && 'Joining foosball match...'}
        {status === 'joined' && 'Foosball match lobby (Coming soon)'}
        {status === 'left' && 'You left the foosball match.'}
        {status === 'error' && (error?.message || 'Error connecting to foosball match')}
      </p>
      {playerCount !== null && (
        <div className="mb-4 text-xs font-medium text-zinc-700">
          Players joined: {playerCount}
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={handleLeave}>
        Leave game
      </Button>
    </div>
  );
}
