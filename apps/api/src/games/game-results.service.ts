import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GameKind } from './game.types';

export interface LeaderboardAggregationEntry {
  userId: string;
  wins: number;
  losses: number;
  games: number;
}

export interface LeaderboardEntry extends LeaderboardAggregationEntry {
  name: string;
  character: string;
}

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
 * - Max 10 entries returned.
 */
export function aggregateLeaderboard(
  rows: Array<{ winners: string[]; losers: string[] }>,
  limit = 10,
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
      if (!winnerSet.has(userId)) {
        entry.games += 1;
      }
      map.set(userId, entry);
    }
  }

  const entries = Array.from(map.values());
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.games - a.games;
  });

  return entries.slice(0, limit);
}

@Injectable()
export class GameResultsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async leaderboard(
    workspaceId: string,
    game: GameKind | string,
    days = 7,
  ): Promise<LeaderboardResult> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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

    const top = aggregateLeaderboard(rows, 10);
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
