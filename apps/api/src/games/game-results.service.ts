/**
 * Match results persistence and leaderboard aggregation service for office minigames.
 * Records game outcomes and calculates ranked stats over configurable time windows.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GameKind } from './game.types';

/** Default number of top players returned on leaderboards. */
export const DEFAULT_LEADERBOARD_LIMIT = 10;

/** Default query window in days for leaderboard aggregation. */
export const DEFAULT_LEADERBOARD_DAYS = 7;

/** Number of milliseconds in a standard 24-hour day. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Aggregated score statistics for a single player.
 */
export interface LeaderboardAggregationEntry {
  userId: string;
  wins: number;
  losses: number;
  games: number;
}

/**
 * Leaderboard entry enriched with member display name and sprite character.
 */
export interface LeaderboardEntry extends LeaderboardAggregationEntry {
  name: string;
  character: string;
}

/**
 * Result payload containing ranked leaderboard entries for a given minigame.
 */
export interface LeaderboardResult {
  game: GameKind | string;
  days: number;
  entries: LeaderboardEntry[];
}

/**
 * Pure function to aggregate GameResult rows into sorted leaderboard statistics.
 * Rules:
 * - Each row gives 1 win and 1 game to unique winners.
 * - Each row gives 1 loss and 1 game to unique losers.
 * - If a user appears in both winners and losers for the same row, they get 1 win, 1 loss, 1 game.
 * - Sorted by: wins desc, losses asc, games desc.
 * - Max limit entries returned.
 *
 * WHY: Deduplication within each row ensures multi-player matches do not award duplicate
 * wins/losses to the same user in a single match.
 */
export function aggregateLeaderboard(
  rows: Array<{ winners: string[]; losers: string[] }>,
  limit: number = DEFAULT_LEADERBOARD_LIMIT,
): LeaderboardAggregationEntry[] {
  const map = new Map<string, LeaderboardAggregationEntry>();

  for (const row of rows) {
    const winnerSet = new Set(row.winners);
    const loserSet = new Set(row.losers);

    for (const userId of winnerSet) {
      const entry = map.get(userId) ?? { userId, wins: 0, losses: 0, games: 0 };
      entry.wins += 1;
      entry.games += 1;
      map.set(userId, entry);
    }

    for (const userId of loserSet) {
      const entry = map.get(userId) ?? { userId, wins: 0, losses: 0, games: 0 };
      entry.losses += 1;
      // WHY: If user was already counted in winnerSet, do not double-increment total games played
      if (!winnerSet.has(userId)) {
        entry.games += 1;
      }
      map.set(userId, entry);
    }
  }

  const entries = Array.from(map.values());
  // WHY: Rank by wins first; break ties by fewer losses; break second ties by total participation
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.games - a.games;
  });

  return entries.slice(0, limit);
}

/**
 * Service managing persistence of match outcomes and generating ranked leaderboards.
 */
@Injectable()
export class GameResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a completed match result to the database.
   */
  async record(params: {
    workspaceId: string;
    game: string;
    winners: string[];
    losers: string[];
  }) {
    return this.prisma.gameResult.create({
      data: {
        workspaceId: params.workspaceId,
        game: params.game,
        winners: params.winners,
        losers: params.losers,
      },
    });
  }

  /**
   * Computes the ranked leaderboard for a given game in a workspace over the specified past days.
   */
  async leaderboard(
    workspaceId: string,
    game: GameKind | string,
    days: number = DEFAULT_LEADERBOARD_DAYS,
  ): Promise<LeaderboardResult> {
    const since = new Date(Date.now() - days * MS_PER_DAY);
    const rows = await this.prisma.gameResult.findMany({
      where: {
        workspaceId,
        game,
        createdAt: { gte: since },
      },
      select: {
        winners: true,
        losers: true,
      },
    });

    const top = aggregateLeaderboard(rows, DEFAULT_LEADERBOARD_LIMIT);
    if (top.length === 0) {
      return { game, days, entries: [] };
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: top.map((t) => t.userId) },
      },
      include: {
        user: true,
      },
    });

    const memberMap = new Map(
      members.map((m) => [m.userId, { name: m.user.displayName, character: m.character }]),
    );

    const entries: LeaderboardEntry[] = top.map((t) => ({
      userId: t.userId,
      name: memberMap.get(t.userId)?.name ?? 'Unknown',
      character: memberMap.get(t.userId)?.character ?? 'maya',
      wins: t.wins,
      losses: t.losses,
      games: t.games,
    }));

    return {
      game,
      days,
      entries,
    };
  }
}
