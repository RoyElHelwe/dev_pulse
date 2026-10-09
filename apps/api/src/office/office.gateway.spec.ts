import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { AppConfig } from '../config/app-config';
import { SessionEvents } from '../auth/session-events';
import { WorkspaceEvents } from '../workspace/workspace-events';
import { TILE } from './layout/geometry';
import type { OfficeLayout } from './layout/types';
import { OfficeGateway, userRoom, wsRoom } from './office.gateway';
import { Budget } from './rules';

const baseEnv = { JWT_SECRET: 'x'.repeat(40) };

function createTestSetup(env: NodeJS.ProcessEnv = { DEV_LOGIN: 'true' }) {
  const config = new AppConfig({ ...baseEnv, ...env });
  const gateway = new OfficeGateway(
    {} as any,
    {} as any,
    new WorkspaceEvents(),
    new SessionEvents(),
    config,
  );

  const layout: OfficeLayout = {
    width: 20, // 20 * 32 = 640 px
    height: 15, // 15 * 32 = 480 px
    spawn: { x: 5, y: 5 },
    rooms: [],
    walls: [],
    furniture: [],
  };

  const player = {
    id: 'u1',
    name: 'Alice',
    character: 'cat',
    x: 100,
    y: 100,
    dir: 2 as const,
    moving: false,
    seated: false,
    status: null,
    zone: null,
    movedAt: 5000,
    sockets: new Set(['s1']),
  };

  (gateway as any).offices.set('ws-1', {
    players: new Map([['u1', player]]),
    layout,
  });

  const emitSpy = vi.fn();
  const exceptSpy = vi.fn();
  const broadcastOperator = {
    emit: emitSpy,
    get volatile() {
      return this;
    },
    except: exceptSpy,
  };
  exceptSpy.mockReturnValue(broadcastOperator);
  const toSpy = vi.fn().mockReturnValue(broadcastOperator);

  const socket = {
    id: 's1',
    data: {
      userId: 'u1',
      sessionId: 'ses-1',
      workspaceId: 'ws-1',
      budget: new Budget(40),
      tabId: 'tab-1',
      takeover: false,
    },
    to: toSpy,
  } as unknown as Socket;

  return { gateway, player, socket, toSpy, exceptSpy, emitSpy, layout };
}

describe('OfficeGateway dev:teleport', () => {
  describe('when devLogin is true', () => {
    it('teleports to valid coordinates, resets movedAt baseline, and preserves dir', () => {
      const { gateway, player, socket, toSpy, exceptSpy, emitSpy } = createTestSetup();

      gateway.teleport(socket, [250, 350]);

      expect(player.x).toBe(250);
      expect(player.y).toBe(350);
      expect(player.movedAt).toBe(0);
      expect(player.dir).toBe(2);
      expect(toSpy).toHaveBeenCalledWith(wsRoom('ws-1'));
      expect(exceptSpy).toHaveBeenCalledWith(userRoom('u1'));
      expect(emitSpy).toHaveBeenCalledWith('office:moved', ['u1', 250, 350, 2, 0, 0]);
    });

    it('rounds non-integer coordinates', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup();

      gateway.teleport(socket, [120.6, 230.2]);

      expect(player.x).toBe(121);
      expect(player.y).toBe(230);
      expect(player.movedAt).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('office:moved', ['u1', 121, 230, 2, 0, 0]);
    });

    it('clamps coordinates to layout boundaries', () => {
      const { gateway, player, socket, layout, emitSpy } = createTestSetup();
      const maxX = layout.width * TILE; // 640
      const maxY = layout.height * TILE; // 480

      // Below 0
      gateway.teleport(socket, [-50, -100]);
      expect(player.x).toBe(0);
      expect(player.y).toBe(0);
      expect(player.movedAt).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('office:moved', ['u1', 0, 0, 2, 0, 0]);

      // Beyond layout boundaries
      gateway.teleport(socket, [9999, 8888]);
      expect(player.x).toBe(maxX);
      expect(player.y).toBe(maxY);
      expect(player.movedAt).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('office:moved', ['u1', maxX, maxY, 2, 0, 0]);
    });

    it('resets speed check baseline so the next move is accepted as-is', () => {
      const { gateway, player, socket } = createTestSetup();

      // Teleport far from initial position (100, 100) -> (500, 400)
      gateway.teleport(socket, [500, 400]);
      expect(player.x).toBe(500);
      expect(player.y).toBe(400);
      expect(player.movedAt).toBe(0);

      // Now send a move message with another large jump to (600, 450)
      // Because movedAt === 0, limitMove is bypassed and destination is taken as-is
      gateway.move(socket, [600, 450, 1, 1]);
      expect(player.x).toBe(600);
      expect(player.y).toBe(450);
      expect(player.movedAt).toBeGreaterThan(0);
    });

    it('preserves moving and seated states in the broadcast tuple', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup();
      player.moving = true;
      player.seated = true;

      gateway.teleport(socket, [200, 200]);

      expect(player.moving).toBe(true);
      expect(player.seated).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith('office:moved', ['u1', 200, 200, 2, 1, 1]);
    });

    it('is reflected in locate()', () => {
      const { gateway, socket } = createTestSetup();

      gateway.teleport(socket, [160, 192]);

      const loc = gateway.locate('ws-1', 'u1');
      expect(loc).toEqual({ x: 160, y: 192, room: null });
    });
  });

  describe('when devLogin is false', () => {
    it('refuses when DEV_LOGIN is false (position unchanged, nothing emitted)', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup({ DEV_LOGIN: 'false' });

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('refuses when DEV_LOGIN is unset (default false)', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup({});

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('refuses in production even if DEV_LOGIN is true (NODE_ENV=production)', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup({
        DEV_LOGIN: 'true',
        NODE_ENV: 'production',
      });

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('invalid payloads ignored', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['string', '100, 200'],
      ['number', 123],
      ['boolean', true],
      ['object', { x: 100, y: 200 }],
      ['empty array', []],
      ['single element array', [100]],
      ['three element array', [100, 200, 300]],
      ['string coordinates', ['100', '200']],
      ['NaN coordinate x', [NaN, 200]],
      ['NaN coordinate y', [100, NaN]],
      ['Infinity coordinate x', [Infinity, 200]],
      ['Infinity coordinate y', [100, Infinity]],
      ['-Infinity coordinate', [-Infinity, -Infinity]],
      ['null coordinate in array', [null, 200]],
      ['undefined coordinate in array', [100, undefined]],
    ])('ignores invalid payload: %s', (_desc, payload) => {
      const { gateway, player, socket, emitSpy } = createTestSetup();

      gateway.teleport(socket, payload);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('player and budget checks', () => {
    it('refuses when budget is exhausted', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup();
      // Drain budget (40 capacity)
      for (let i = 0; i < 40; i++) {
        socket.data.budget.allow();
      }

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('refuses when socket id does not belong to player sockets', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup();
      (socket as any).id = 'different-socket';

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('refuses when office does not exist', () => {
      const { gateway, player, socket, emitSpy } = createTestSetup();
      socket.data.workspaceId = 'unknown-workspace';

      gateway.teleport(socket, [300, 300]);

      expect(player.x).toBe(100);
      expect(player.y).toBe(100);
      expect(player.movedAt).toBe(5000);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
