import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameError, type GamePlayerRef } from '../game.types';
import { LegoController } from './lego.controller';
import {
  ALLOWED_SIZES,
  BOARD_H,
  BOARD_W,
  brickAt,
  type Brick,
  bricksOverlap,
  parseBricks,
  validatePlace,
} from './lego.rules';
import { LegoGameInstance, LegoService } from './lego.service';

describe('Lego Wall', () => {
  describe('lego.rules', () => {
    it('validates allowed and rejected brick sizes', () => {
      for (const [w, h] of ALLOWED_SIZES) {
        expect(validatePlace([], [0, 0, w, h, 0])).toBeNull();
      }

      expect(validatePlace([], [0, 0, 3, 3, 0])).toContain('Invalid brick size');
      expect(validatePlace([], [0, 0, 1, 3, 0])).toContain('Invalid brick size');
      expect(validatePlace([], [0, 0, 5, 1, 0])).toContain('Invalid brick size');
    });

    it('validates boundary conditions (bounds)', () => {
      // Valid corners
      expect(validatePlace([], [0, 0, 1, 1, 0])).toBeNull();
      expect(validatePlace([], [BOARD_W - 1, BOARD_H - 1, 1, 1, 0])).toBeNull();
      expect(validatePlace([], [BOARD_W - 4, BOARD_H - 2, 4, 2, 0])).toBeNull();

      // Negative coordinates
      expect(validatePlace([], [-1, 0, 1, 1, 0])).toContain('out of bounds');
      expect(validatePlace([], [0, -1, 1, 1, 0])).toContain('out of bounds');

      // Exceeding width/height
      expect(validatePlace([], [BOARD_W - 1, 0, 2, 1, 0])).toContain('out of bounds');
      expect(validatePlace([], [0, BOARD_H - 1, 1, 2, 0])).toContain('out of bounds');
      expect(validatePlace([], [BOARD_W, 0, 1, 1, 0])).toContain('out of bounds');
      expect(validatePlace([], [0, BOARD_H, 1, 1, 0])).toContain('out of bounds');
    });

    it('validates palette color bounds', () => {
      expect(validatePlace([], [0, 0, 1, 1, 0])).toBeNull();
      expect(validatePlace([], [0, 0, 1, 1, 15])).toBeNull();
      expect(validatePlace([], [0, 0, 1, 1, -1])).toContain('Invalid color index');
      expect(validatePlace([], [0, 0, 1, 1, 16])).toContain('Invalid color index');
    });

    it('detects overlap correctly', () => {
      const b1: Brick = [5, 5, 2, 2, 1];

      // Exact overlap
      expect(bricksOverlap(b1, [5, 5, 2, 2, 2])).toBe(true);
      // Partial overlap
      expect(bricksOverlap(b1, [6, 6, 2, 2, 2])).toBe(true);
      // Adjacent horizontally (touching edges but not overlapping)
      expect(bricksOverlap(b1, [7, 5, 2, 2, 2])).toBe(false);
      // Adjacent vertically
      expect(bricksOverlap(b1, [5, 7, 2, 2, 2])).toBe(false);
      // Disjoint
      expect(bricksOverlap(b1, [10, 10, 2, 2, 2])).toBe(false);

      expect(validatePlace([b1], [6, 6, 2, 2, 2])).toContain('overlaps');
      expect(validatePlace([b1], [7, 5, 2, 2, 2])).toBeNull();
    });

    it('brickAt returns the correct brick or undefined', () => {
      const bricks: Brick[] = [
        [0, 0, 2, 2, 1],
        [10, 10, 4, 2, 2],
      ];

      expect(brickAt(bricks, 0, 0)).toEqual([0, 0, 2, 2, 1]);
      expect(brickAt(bricks, 1, 1)).toEqual([0, 0, 2, 2, 1]);
      expect(brickAt(bricks, 2, 2)).toBeUndefined();
      expect(brickAt(bricks, 13, 11)).toEqual([10, 10, 4, 2, 2]);
      expect(brickAt(bricks, 14, 11)).toBeUndefined();
    });

    it('parseBricks sanitises data and drops invalid or overlapping bricks', () => {
      expect(parseBricks(null)).toEqual([]);
      expect(parseBricks('invalid json')).toEqual([]);

      const raw = [
        [0, 0, 2, 2, 1], // valid
        [1, 1, 2, 2, 2], // overlaps with first -> dropped
        [10, 10, 1, 1, 5], // valid
        [100, 100, 1, 1, 0], // out of bounds -> dropped
        [20, 20, 3, 3, 0], // invalid size -> dropped
        [20, 20, 1, 1, 99], // invalid color -> dropped
        ['bad', 'tuple'], // malformed -> dropped
      ];

      const parsed = parseBricks(raw);
      expect(parsed).toEqual([
        [0, 0, 2, 2, 1],
        [10, 10, 1, 1, 5],
      ]);

      // Can also parse from valid JSON string
      expect(parseBricks(JSON.stringify(raw))).toEqual([
        [0, 0, 2, 2, 1],
        [10, 10, 1, 1, 5],
      ]);
    });
  });

  describe('LegoService', () => {
    let service: LegoService;
    let fakePrisma: any;
    let fakeOfficeGateway: any;

    beforeEach(() => {
      vi.useFakeTimers();
      fakePrisma = {
        legoBoard: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          upsert: vi.fn().mockResolvedValue({}),
        },
      };
      fakeOfficeGateway = {
        broadcast: vi.fn(),
      };

      service = new LegoService(fakePrisma, fakeOfficeGateway);
    });

    it('ensureLoaded loads from database and peek reflects it', async () => {
      fakePrisma.legoBoard.findUnique.mockResolvedValue({
        workspaceId: 'ws-1',
        objectId: 'board-1',
        bricks: [[0, 0, 1, 1, 2]],
      });

      expect(service.peek('ws-1', 'board-1')).toBeUndefined();

      await service.ensureLoaded('ws-1', 'board-1');

      const peeked = service.peek('ws-1', 'board-1');
      expect(peeked).toBeDefined();
      expect(peeked?.bricks).toEqual([[0, 0, 1, 1, 2]]);
      expect(peeked?.version).toBe(1);
    });

    it('places bricks, increments version, and debounces save / throttles broadcast', async () => {
      fakePrisma.legoBoard.findUnique.mockResolvedValue(null);
      await service.ensureLoaded('ws-1', 'board-1');

      service.place('ws-1', 'board-1', [0, 0, 2, 1, 3]);

      const peeked = service.peek('ws-1', 'board-1');
      expect(peeked?.bricks).toEqual([[0, 0, 2, 1, 3]]);
      expect(peeked?.version).toBe(2);

      // Throttled broadcast after 300ms
      expect(fakeOfficeGateway.broadcast).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(fakeOfficeGateway.broadcast).toHaveBeenCalledWith('ws-1', 'lego:art', {
        id: 'board-1',
        bricks: [[0, 0, 2, 1, 3]],
      });

      // Debounced save after 400ms
      expect(fakePrisma.legoBoard.upsert).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fakePrisma.legoBoard.upsert).toHaveBeenCalledWith({
        where: { workspaceId_objectId: { workspaceId: 'ws-1', objectId: 'board-1' } },
        create: { workspaceId: 'ws-1', objectId: 'board-1', bricks: [[0, 0, 2, 1, 3]] },
        update: { bricks: [[0, 0, 2, 1, 3]] },
      });
    });

    it('removes brick covering coordinates', async () => {
      fakePrisma.legoBoard.findUnique.mockResolvedValue({
        workspaceId: 'ws-1',
        objectId: 'board-1',
        bricks: [[2, 2, 2, 2, 1]],
      });
      await service.ensureLoaded('ws-1', 'board-1');

      const removed = service.remove('ws-1', 'board-1', 3, 3);
      expect(removed).toBe(true);
      expect(service.peek('ws-1', 'board-1')?.bricks).toEqual([]);

      const removedAgain = service.remove('ws-1', 'board-1', 3, 3);
      expect(removedAgain).toBe(false);
    });

    it('clears all bricks', async () => {
      fakePrisma.legoBoard.findUnique.mockResolvedValue({
        workspaceId: 'ws-1',
        objectId: 'board-1',
        bricks: [
          [0, 0, 1, 1, 1],
          [2, 2, 1, 1, 2],
        ],
      });
      await service.ensureLoaded('ws-1', 'board-1');

      service.clear('ws-1', 'board-1');
      expect(service.peek('ws-1', 'board-1')?.bricks).toEqual([]);
    });

    it('listBoards combines database records and memory cache', async () => {
      fakePrisma.legoBoard.findMany.mockResolvedValue([
        { objectId: 'board-db', bricks: [[0, 0, 1, 1, 1]] },
      ]);
      fakePrisma.legoBoard.findUnique.mockResolvedValue(null);

      await service.ensureLoaded('ws-1', 'board-mem');
      service.place('ws-1', 'board-mem', [5, 5, 1, 1, 4]);

      const boards = await service.listBoards('ws-1');
      expect(boards).toHaveLength(2);
      expect(boards.find((b) => b.id === 'board-db')?.bricks).toEqual([[0, 0, 1, 1, 1]]);
      expect(boards.find((b) => b.id === 'board-mem')?.bricks).toEqual([[5, 5, 1, 1, 4]]);
    });

    it('flushes pending saves on module destroy', async () => {
      fakePrisma.legoBoard.findUnique.mockResolvedValue(null);
      await service.ensureLoaded('ws-1', 'board-1');
      service.place('ws-1', 'board-1', [0, 0, 1, 1, 0]);

      expect(fakePrisma.legoBoard.upsert).not.toHaveBeenCalled();

      await service.onModuleDestroy();
      expect(fakePrisma.legoBoard.upsert).toHaveBeenCalled();
    });
  });

  describe('LegoGameInstance', () => {
    let service: LegoService;
    let fakePrisma: any;
    let fakeOfficeGateway: any;
    let ctx: any;
    let instance: LegoGameInstance;

    beforeEach(() => {
      fakePrisma = {
        legoBoard: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
        workspaceMember: {
          findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
        },
      };
      fakeOfficeGateway = {
        broadcast: vi.fn(),
      };

      service = new LegoService(fakePrisma, fakeOfficeGateway);
      ctx = {
        workspaceId: 'ws-1',
        objectId: 'board-1',
        kind: 'lego',
        participants: vi.fn().mockReturnValue([]),
        emitState: vi.fn(),
        emitEvent: vi.fn(),
        record: vi.fn(),
        close: vi.fn(),
      };

      instance = new LegoGameInstance(ctx, service, fakePrisma);
    });

    it('onJoin registers player, loads board, queries role, and emits state', async () => {
      const p: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'char1' };
      instance.onJoin(p, null);

      // Wait for ensureLoaded and role promises
      await Promise.resolve();
      await Promise.resolve();

      expect(ctx.emitState).toHaveBeenCalled();
      const state = instance.view('u1');
      expect(state.ready).toBe(true);
      expect(state.players).toContain('Alice');
      expect(state.canClear).toBe(true);
    });

    it('throws LOADING if action performed before board is loaded', () => {
      expect(() => {
        instance.onAction('u1', { type: 'place', x: 0, y: 0, w: 1, h: 1, c: 0 });
      }).toThrowError(GameError);
    });

    it('places a brick and emits state when valid', async () => {
      await service.ensureLoaded('ws-1', 'board-1');

      instance.onAction('u1', { type: 'place', x: 0, y: 0, w: 1, h: 1, c: 0 });

      expect(ctx.emitState).toHaveBeenCalled();
      const state = instance.view('u1');
      expect(state.bricks).toEqual([[0, 0, 1, 1, 0]]);
    });

    it('rejects invalid brick placement with INVALID_BRICK', async () => {
      await service.ensureLoaded('ws-1', 'board-1');

      expect(() => {
        instance.onAction('u1', { type: 'place', x: 0, y: 0, w: 3, h: 3, c: 0 });
      }).toThrowError(/Invalid brick size/);
    });

    it('handles remove action and emits state', async () => {
      await service.ensureLoaded('ws-1', 'board-1');
      service.place('ws-1', 'board-1', [5, 5, 2, 2, 1]);

      instance.onAction('u1', { type: 'remove', x: 6, y: 6 });

      expect(instance.view('u1').bricks).toEqual([]);
      expect(ctx.emitState).toHaveBeenCalled();
    });

    it('enforces clear permissions: allows OWNER/ADMIN, forbids MEMBER', async () => {
      await service.ensureLoaded('ws-1', 'board-1');
      service.place('ws-1', 'board-1', [0, 0, 1, 1, 0]);

      // u-member is MEMBER
      fakePrisma.workspaceMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' });
      instance.onJoin({ userId: 'u-member', name: 'Bob', character: 'char2' }, null);
      await Promise.resolve();
      await Promise.resolve();

      expect(() => {
        instance.onAction('u-member', { type: 'clear' });
      }).toThrowError(GameError);

      // u-admin is ADMIN
      fakePrisma.workspaceMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
      instance.onJoin({ userId: 'u-admin', name: 'Admin', character: 'char3' }, null);
      await Promise.resolve();
      await Promise.resolve();

      instance.onAction('u-admin', { type: 'clear' });
      expect(instance.view('u-admin').bricks).toEqual([]);
    });

    it('enforces rate limit of 15 actions per second', async () => {
      await service.ensureLoaded('ws-1', 'board-1');

      for (let i = 0; i < 15; i++) {
        instance.onAction('u1', { type: 'remove', x: 0, y: 0 });
      }

      let error: any;
      try {
        instance.onAction('u1', { type: 'remove', x: 0, y: 0 });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(GameError);
      expect(error.code).toBe('RATE_LIMIT');
    });

    it('rejects malformed or unknown actions with BAD_REQUEST', async () => {
      await service.ensureLoaded('ws-1', 'board-1');

      expect(() => {
        instance.onAction('u1', null);
      }).toThrowError(GameError);

      expect(() => {
        instance.onAction('u1', { type: 'unknown_type' });
      }).toThrowError(GameError);
    });
  });

  describe('LegoController', () => {
    it('GET /workspace/lego returns boards for user workspace', async () => {
      const fakeMembership = {
        require: vi.fn().mockResolvedValue({ workspaceId: 'ws-123' }),
      };
      const fakeLegoService = {
        listBoards: vi.fn().mockResolvedValue([{ id: 'board-1', bricks: [] }]),
      };

      const controller = new LegoController(
        fakeLegoService as any,
        fakeMembership as any,
      );

      const result = await controller.getBoards({ id: 'user-1' } as any);
      expect(fakeMembership.require).toHaveBeenCalledWith('user-1');
      expect(fakeLegoService.listBoards).toHaveBeenCalledWith('ws-123');
      expect(result).toEqual({ boards: [{ id: 'board-1', bricks: [] }] });
    });
  });
});
