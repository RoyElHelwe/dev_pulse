import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameContext, GameDefinition, GameInstance, GamePlayerRef } from './game.types';
import { GameError } from './game.types';
import { GamesSessionManager, type GameSessionTransport } from './games.session';

describe('GamesSessionManager and GameSession', () => {
  let manager: GamesSessionManager;
  let fakeOfficeGateway: any;
  let fakePrisma: any;
  let fakeResultsService: any;
  let fakeWorkspaceEvents: any;
  let fakeTransport: GameSessionTransport;

  let createdInstances: Array<{ instance: GameInstance; ctx: GameContext }>;

  const createFakeDefinition = (kind: any = 'foosball', furnitureKind: any = 'foosball'): GameDefinition => {
    return {
      kind,
      furnitureKind,
      create(ctx: GameContext): GameInstance {
        const players: GamePlayerRef[] = [];
        const instance: GameInstance = {
          onJoin: vi.fn((p: GamePlayerRef) => {
            players.push(p);
            ctx.emitState();
          }),
          onLeave: vi.fn((userId: string) => {
            const idx = players.findIndex((p) => p.userId === userId);
            if (idx !== -1) players.splice(idx, 1);
            ctx.emitState();
          }),
          onAction: vi.fn((userId: string, action: unknown) => {
            if (action === 'invalid') {
              throw new GameError('BAD_MOVE', 'Invalid action');
            }
          }),
          view: vi.fn((userId: string) => {
            // Per-viewer view: customized for each user
            return {
              viewer: userId,
              playerCount: players.length,
            };
          }),
          dispose: vi.fn(),
        };
        createdInstances.push({ instance, ctx });
        return instance;
      },
    };
  };

  beforeEach(() => {
    createdInstances = [];
    fakeOfficeGateway = {
      locate: vi.fn(),
      sendTo: vi.fn(),
    };
    fakePrisma = {
      workspace: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ws-1',
          layout: {
            width: 30,
            height: 30,
            rooms: [],
            walls: [],
            spawn: { x: 5, y: 5 },
            furniture: [
              { id: 'furn-1', kind: 'foosball', x: 10, y: 10, w: 3, h: 2 },
              { id: 'furn-2', kind: 'cardTable', x: 20, y: 20, w: 2, h: 2 },
            ],
          },
        }),
      },
    };
    fakeResultsService = {
      record: vi.fn().mockResolvedValue({ id: 'gr-1' }),
    };
    fakeWorkspaceEvents = {
      events$: {
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      },
    };
    fakeTransport = {
      sendToUser: vi.fn(),
      sendToRoom: vi.fn(),
    };

    manager = new GamesSessionManager(
      fakeOfficeGateway,
      fakePrisma,
      fakeResultsService,
      fakeWorkspaceEvents,
    );
    manager.setTransport(fakeTransport);
  });

  it('joins a game, calls onJoin and emitState', () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };

    const session = manager.join('ws-1', 'furn-1', def, player1, { side: 'red' });
    expect(session).toBeDefined();
    expect(session.participants()).toEqual([player1]);

    const { instance } = createdInstances[0];
    expect(instance.onJoin).toHaveBeenCalledWith(player1, { side: 'red' });
    expect(instance.view).toHaveBeenCalledWith('u1');
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith(
      'u1',
      'game:state',
      expect.objectContaining({
        id: 'furn-1',
        game: 'foosball',
        state: { viewer: 'u1', playerCount: 1 },
      }),
    );
  });

  it('delivers per-viewer custom view to each participant', () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };
    const player2: GamePlayerRef = { userId: 'u2', name: 'Bob', character: 'sam' };

    manager.join('ws-1', 'furn-1', def, player1, null);
    manager.join('ws-1', 'furn-1', def, player2, null);

    // Verify player 1 got state with viewer 'u1'
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith(
      'u1',
      'game:state',
      expect.objectContaining({ state: { viewer: 'u1', playerCount: 2 } }),
    );
    // Verify player 2 got state with viewer 'u2'
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith(
      'u2',
      'game:state',
      expect.objectContaining({ state: { viewer: 'u2', playerCount: 2 } }),
    );
  });

  it('leaves a game and disposes session when empty', () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };

    const session = manager.join('ws-1', 'furn-1', def, player1, null);
    const { instance } = createdInstances[0];

    expect(session.isDisposed()).toBe(false);

    manager.leave('ws-1', 'furn-1', 'u1', 'left');

    expect(instance.onLeave).toHaveBeenCalledWith('u1', 'left');
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith('u1', 'game:left', {
      id: 'furn-1',
      reason: 'left',
    });
    expect(instance.dispose).toHaveBeenCalled();
    expect(session.isDisposed()).toBe(true);

    // Manager should remove empty disposed session
    expect(manager.getSession('ws-1', 'furn-1')).toBeUndefined();
    expect(manager.getUserActiveSession('u1')).toBeUndefined();
  });

  it('enforces one active game per user: joining a second game leaves the first', () => {
    const defFoosball = createFakeDefinition('foosball', 'foosball');
    const defUno = createFakeDefinition('uno', 'cardTable');
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };

    // Join game 1
    manager.join('ws-1', 'furn-1', defFoosball, player1, null);
    const foosballInstance = createdInstances[0].instance;
    expect(manager.getUserActiveSession('u1')).toEqual({
      workspaceId: 'ws-1',
      objectId: 'furn-1',
    });

    // Join game 2
    manager.join('ws-1', 'furn-2', defUno, player1, null);

    // Should have left game 1 with reason 'left'
    expect(foosballInstance.onLeave).toHaveBeenCalledWith('u1', 'left');
    expect(foosballInstance.dispose).toHaveBeenCalled();
    expect(manager.getSession('ws-1', 'furn-1')).toBeUndefined();

    // Now active in game 2
    expect(manager.getUserActiveSession('u1')).toEqual({
      workspaceId: 'ws-1',
      objectId: 'furn-2',
    });
  });

  it('auto-leaves when participant moves beyond 7 tiles or is not located', async () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };
    const player2: GamePlayerRef = { userId: 'u2', name: 'Bob', character: 'sam' };

    manager.join('ws-1', 'furn-1', def, player1, null);
    manager.join('ws-1', 'furn-1', def, player2, null);
    const { instance } = createdInstances[0];

    // Furniture is at (10, 10) tiles.
    // u1 is near: (10, 10) tiles -> (320, 320) px
    // u2 is far: (20, 10) tiles (10 tiles away > 7) -> (640, 320) px
    fakeOfficeGateway.locate.mockImplementation((_wsId: string, userId: string) => {
      if (userId === 'u1') return { x: 320, y: 320 };
      if (userId === 'u2') return { x: 640, y: 320 };
      return null;
    });

    await manager.sweepProximity();

    // u2 was far -> left with 'far'
    expect(instance.onLeave).toHaveBeenCalledWith('u2', 'far');
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith('u2', 'game:left', {
      id: 'furn-1',
      reason: 'far',
    });

    // u1 remains
    expect(manager.getUserActiveSession('u1')).toBeDefined();
    expect(manager.getUserActiveSession('u2')).toBeUndefined();

    // Now u1 disconnects / leaves office (locate returns null)
    fakeOfficeGateway.locate.mockReturnValue(null);
    await manager.sweepProximity();

    expect(instance.onLeave).toHaveBeenCalledWith('u1', 'far');
    expect(instance.dispose).toHaveBeenCalled();
    expect(manager.getSession('ws-1', 'furn-1')).toBeUndefined();
  });

  it('routes action to instance and propagates GameError', () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };

    manager.join('ws-1', 'furn-1', def, player1, null);
    const { instance } = createdInstances[0];

    manager.action('ws-1', 'furn-1', 'u1', { move: 'kick' });
    expect(instance.onAction).toHaveBeenCalledWith('u1', { move: 'kick' });

    expect(() => {
      manager.action('ws-1', 'furn-1', 'u1', 'invalid');
    }).toThrow(GameError);
  });

  it('closes session completely when close() is called', () => {
    const def = createFakeDefinition();
    const player1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };
    const player2: GamePlayerRef = { userId: 'u2', name: 'Bob', character: 'sam' };

    const session = manager.join('ws-1', 'furn-1', def, player1, null);
    manager.join('ws-1', 'furn-1', def, player2, null);
    const { instance, ctx } = createdInstances[0];

    ctx.close();

    expect(fakeTransport.sendToUser).toHaveBeenCalledWith('u1', 'game:ended', {
      id: 'furn-1',
      result: { reason: 'closed' },
    });
    expect(fakeTransport.sendToUser).toHaveBeenCalledWith('u1', 'game:left', {
      id: 'furn-1',
      reason: 'closed',
    });
    expect(instance.dispose).toHaveBeenCalled();
    expect(session.isDisposed()).toBe(true);
    expect(manager.getSession('ws-1', 'furn-1')).toBeUndefined();
  });
});
