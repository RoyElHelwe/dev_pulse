/**
 * Leaderboard component displaying recent player rankings for a game.
 * Fetches weekly win/loss stats and listens for live socket match-end events to refresh rankings.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { GameKind, LeaderboardEntry, LeaderboardResponse } from './types';

/** Aggregation window in days for leaderboard rankings. */
const LEADERBOARD_WINDOW_DAYS = 7;

/** Props for the Leaderboard component. */
export interface LeaderboardProps {
  /** Target game kind for which rankings are fetched. */
  game: GameKind;
  /** Socket instance used to listen for game completion events. */
  socket?: Socket | null;
  /** Optional additional CSS classes for container layout. */
  className?: string;
}

/**
 * Renders a weekly leaderboard card showing top players with win/loss counts.
 */
export function Leaderboard({ game, socket, className }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api<LeaderboardResponse>(
        `/workspace/games/leaderboard?game=${game}&days=${LEADERBOARD_WINDOW_DAYS}`,
      );
      if (data && Array.isArray(data.entries)) {
        setEntries(data.entries);
      } else {
        setEntries([]);
      }
    } catch {
      // WHY: Gracefully default to empty rankings if the API endpoint fails or no games have occurred yet.
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    setLoading(true);
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  // WHY: Subscribing to 'game:ended' ensures rankings refresh in real time immediately when any match finishes,
  // without requiring manual user refreshes or aggressive background polling.
  useEffect(() => {
    if (!socket) return;
    const onEnded = () => {
      void fetchLeaderboard();
    };
    socket.on('game:ended', onEnded);
    return () => {
      socket.off('game:ended', onEnded);
    };
  }, [socket, fetchLeaderboard]);

  return (
    <div className={cn('rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xl', className)}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Top players this week
        </h3>
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-4 text-center text-xs text-zinc-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="py-4 text-center text-xs text-zinc-400">No games yet this week</div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, index) => (
            <div
              key={entry.userId || index}
              className="flex items-center gap-2.5 rounded-lg border border-zinc-200/50 bg-white px-3 py-2 text-xs shadow-xs"
            >
              <span className="w-4 font-mono font-bold text-zinc-400 text-center">{index + 1}</span>
              <CharacterFace character={entry.character} className="size-6 shrink-0" />
              <span className="flex-1 truncate font-medium text-zinc-800">{entry.name}</span>
              <span className="font-mono text-zinc-500">
                {entry.wins}W / {entry.losses}L
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
