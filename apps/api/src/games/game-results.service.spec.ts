import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aggregateLeaderboard, GameResultsService } from './game-results.service';

describe('GameResultsService and aggregateLeaderboard', () => {
  describe('aggregateLeaderboard pure function', () => {
    it('aggregates wins, losses, and total games correctly', () => {
      const rows = [
        { winners: ['userA'], losers: ['userB'] },
        { winners: ['userA'], losers: ['userC'] },
        { winners: ['userB'], losers: ['userC'] },
      ];

      const result = aggregateLeaderboard(rows);

      // userA: 2 wins, 0 losses, 2 games
      // userB: 1 win, 1 loss, 2 games
      // userC: 0 wins, 2 losses, 2 games
      expect(result).toEqual([
        { userId: 'userA', wins: 2, losses: 0, games: 2 },
        { userId: 'userB', wins: 1, losses: 1, games: 2 },
        { userId: 'userC', wins: 0, losses: 2, games: 2 },
      ]);
    });

    it('sorts by wins desc, losses asc, games desc', () => {
      const rows = [
        { winners: ['tied1'], losers: ['loser1'] },
        { winners: ['tied2'], losers: ['loser1', 'loser2'] },
      ];
      // tied1: 1 win, 0 loss, 1 game
      // tied2: 1 win, 0 loss, 1 game
      // loser1: 0 win, 2 loss, 2 games
      // loser2: 0 win, 1 loss, 1 game
      const result = aggregateLeaderboard(rows);

      // loser2 has 1 loss, loser1 has 2 losses -> loser2 before loser1 (losses asc)
      expect(result[0].wins).toBe(1);
      expect(result[1].wins).toBe(1);
      expect(result[2].userId).toBe('loser2');
      expect(result[3].userId).toBe('loser1');
    });

    it('handles multiple participants in a single match and deduplicates within match', () => {
      const rows = [
        { winners: ['teamA1', 'teamA2', 'teamA1'], losers: ['teamB1', 'teamB2'] },
      ];

      const result = aggregateLeaderboard(rows);
      expect(result.length).toBe(4);
      const teamA1 = result.find((r) => r.userId === 'teamA1');
      expect(teamA1).toEqual({ userId: 'teamA1', wins: 1, losses: 0, games: 1 });
    });

    it('limits results to top 10', () => {
      const rows: Array<{ winners: string[]; losers: string[] }> = [];
      for (let i = 0; i < 15; i++) {
        rows.push({ winners: [`winner${i}`], losers: ['constantLoser'] });
      }

      const result = aggregateLeaderboard(rows, 10);
      expect(result.length).toBe(10);
    });

    it('handles empty results', () => {
      expect(aggregateLeaderboard([])).toEqual([]);
    });
  });

  describe('GameResultsService', () => {
    let service: GameResultsService;
    let fakePrisma: any;

    beforeEach(() => {
      fakePrisma = {
        gameResult: {
          create: vi.fn(),
          findMany: vi.fn(),
        },
        workspaceMember: {
          findMany: vi.fn(),
        },
      };
      service = new GameResultsService(fakePrisma);
    });

    it('records a game result row in Prisma', async () => {
      const mockRow = { id: 'gr-1' };
      fakePrisma.gameResult.create.mockResolvedValue(mockRow);

      const result = await service.record({
        workspaceId: 'ws-1',
        game: 'foosball',
        winners: ['u1', 'u2'],
        losers: ['u3'],
      });

      expect(fakePrisma.gameResult.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          game: 'foosball',
          winners: ['u1', 'u2'],
          losers: ['u3'],
        },
      });
      expect(result).toBe(mockRow);
    });

    it('returns empty leaderboard when no results exist in timeframe', async () => {
      fakePrisma.gameResult.findMany.mockResolvedValue([]);

      const leaderboard = await service.leaderboard('ws-1', 'foosball', 7);

      expect(leaderboard).toEqual({
        game: 'foosball',
        days: 7,
        entries: [],
      });
      expect(fakePrisma.workspaceMember.findMany).not.toHaveBeenCalled();
    });

    it('maps members display name and character onto aggregated leaderboard', async () => {
      fakePrisma.gameResult.findMany.mockResolvedValue([
        { winners: ['user-1'], losers: ['user-2'] },
      ]);
      fakePrisma.workspaceMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          character: 'sam',
          user: { displayName: 'User One' },
        },
        {
          userId: 'user-2',
          character: 'alex',
          user: { displayName: 'User Two' },
        },
      ]);

      const leaderboard = await service.leaderboard('ws-1', 'foosball', 7);

      expect(leaderboard.entries).toEqual([
        {
          userId: 'user-1',
          name: 'User One',
          character: 'sam',
          wins: 1,
          losses: 0,
          games: 1,
        },
        {
          userId: 'user-2',
          name: 'User Two',
          character: 'alex',
          wins: 0,
          losses: 1,
          games: 1,
        },
      ]);
    });
  });
});
