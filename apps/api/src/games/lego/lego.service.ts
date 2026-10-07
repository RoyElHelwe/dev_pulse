import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { OfficeGateway } from '../../office/office.gateway';
import { Budget } from '../../office/rules';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type GameContext,
  GameError,
  type GameInstance,
  type GamePlayerRef,
} from '../game.types';
import {
  BOARD_H,
  BOARD_W,
  type Brick,
  parseBricks,
  validatePlace,
} from './lego.rules';

export interface CachedBoard {
  bricks: Brick[];
  version: number;
  loaded: boolean;
  saveTimer?: ReturnType<typeof setTimeout> | null;
  broadcastTimer?: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class LegoService implements OnModuleDestroy {
  private readonly logger = new Logger(LegoService.name);
  private readonly cache = new Map<string, CachedBoard>();
  private readonly loadingPromises = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly officeGateway: OfficeGateway,
  ) {}

  async ensureLoaded(workspaceId: string, objectId: string): Promise<void> {
    const key = `${workspaceId}:${objectId}`;
    const cached = this.cache.get(key);
    if (cached && cached.loaded) {
      return;
    }

    const existingPromise = this.loadingPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const loadPromise = (async () => {
      try {
        const record = await this.prisma.legoBoard.findUnique({
          where: {
            workspaceId_objectId: { workspaceId, objectId },
          },
        });

        const bricks = record ? parseBricks(record.bricks) : [];
        const entry = this.cache.get(key);
        if (entry) {
          entry.bricks = bricks;
          entry.loaded = true;
        } else {
          this.cache.set(key, {
            bricks,
            version: 1,
            loaded: true,
            saveTimer: null,
            broadcastTimer: null,
          });
        }
      } finally {
        this.loadingPromises.delete(key);
      }
    })();

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  peek(
    workspaceId: string,
    objectId: string,
  ): { bricks: Brick[]; version: number } | undefined {
    const entry = this.cache.get(`${workspaceId}:${objectId}`);
    if (!entry || !entry.loaded) {
      return undefined;
    }
    return {
      bricks: entry.bricks,
      version: entry.version,
    };
  }

  place(workspaceId: string, objectId: string, brick: Brick): void {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry || !entry.loaded) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    const err = validatePlace(entry.bricks, brick);
    if (err) {
      throw new GameError('INVALID_BRICK', err);
    }

    entry.bricks.push(brick);
    entry.version++;
    this.scheduleDebouncedSave(workspaceId, objectId);
    this.scheduleThrottledBroadcast(workspaceId, objectId);
  }

  remove(workspaceId: string, objectId: string, x: number, y: number): boolean {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry || !entry.loaded) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    const idx = entry.bricks.findIndex(
      ([bx, by, bw, bh]) => bx <= x && x < bx + bw && by <= y && y < by + bh,
    );
    if (idx !== -1) {
      entry.bricks.splice(idx, 1);
      entry.version++;
      this.scheduleDebouncedSave(workspaceId, objectId);
      this.scheduleThrottledBroadcast(workspaceId, objectId);
      return true;
    }
    return false;
  }

  clear(workspaceId: string, objectId: string): void {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry || !entry.loaded) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    entry.bricks = [];
    entry.version++;
    this.scheduleDebouncedSave(workspaceId, objectId);
    this.scheduleThrottledBroadcast(workspaceId, objectId);
  }

  async persistBoard(workspaceId: string, objectId: string): Promise<void> {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry) return;

    try {
      await this.prisma.legoBoard.upsert({
        where: {
          workspaceId_objectId: { workspaceId, objectId },
        },
        create: {
          workspaceId,
          objectId,
          bricks: entry.bricks,
        },
        update: {
          bricks: entry.bricks,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist lego board ${key}:`, err);
    }
  }

  private scheduleDebouncedSave(workspaceId: string, objectId: string): void {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry) return;

    if (entry.saveTimer) {
      clearTimeout(entry.saveTimer);
    }

    entry.saveTimer = setTimeout(() => {
      entry.saveTimer = null;
      void this.persistBoard(workspaceId, objectId);
    }, 400);
  }

  private scheduleThrottledBroadcast(workspaceId: string, objectId: string): void {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry) return;

    if (entry.broadcastTimer) {
      return;
    }

    entry.broadcastTimer = setTimeout(() => {
      entry.broadcastTimer = null;
      this.officeGateway.broadcast(workspaceId, 'lego:art', {
        id: objectId,
        bricks: [...entry.bricks],
      });
    }, 300);
  }

  async listBoards(
    workspaceId: string,
  ): Promise<Array<{ id: string; bricks: Brick[] }>> {
    const records = await this.prisma.legoBoard.findMany({
      where: { workspaceId },
    });

    const resultMap = new Map<string, Brick[]>();
    for (const record of records) {
      resultMap.set(record.objectId, parseBricks(record.bricks));
    }

    const prefix = `${workspaceId}:`;
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix) && entry.loaded) {
        const objectId = key.slice(prefix.length);
        resultMap.set(objectId, entry.bricks);
      }
    }

    return Array.from(resultMap.entries()).map(([id, bricks]) => ({
      id,
      bricks,
    }));
  }

  async flush(): Promise<void> {
    const saves: Promise<void>[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (entry.saveTimer) {
        clearTimeout(entry.saveTimer);
        entry.saveTimer = null;
        const [workspaceId, objectId] = key.split(':');
        saves.push(this.persistBoard(workspaceId, objectId));
      }
    }
    await Promise.allSettled(saves);
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
    for (const entry of this.cache.values()) {
      if (entry.broadcastTimer) {
        clearTimeout(entry.broadcastTimer);
        entry.broadcastTimer = null;
      }
    }
  }
}

export class LegoGameInstance implements GameInstance {
  private readonly logger = new Logger(LegoGameInstance.name);
  private readonly players = new Map<string, GamePlayerRef>();
  private readonly roles = new Map<string, string>();
  private readonly budgets = new Map<string, Budget>();
  private disposed = false;

  constructor(
    private readonly ctx: GameContext,
    private readonly legoService: LegoService,
    private readonly prisma: PrismaService,
  ) {}

  onJoin(p: GamePlayerRef, _intent: unknown): void {
    if (this.disposed) return;
    this.players.set(p.userId, p);

    void this.legoService
      .ensureLoaded(this.ctx.workspaceId, this.ctx.objectId)
      .then(() => {
        if (!this.disposed) {
          this.ctx.emitState();
        }
      })
      .catch((err) => {
        this.logger.error('Failed to ensure board loaded on join', err);
      });

    void this.prisma.workspaceMember
      .findUnique({
        where: { userId: p.userId },
        select: { role: true },
      })
      .then((member) => {
        if (member && !this.disposed) {
          this.roles.set(p.userId, member.role);
          this.ctx.emitState();
        }
      })
      .catch((err) => {
        this.logger.error('Failed to get member role on join', err);
      });
  }

  onLeave(userId: string, _reason: 'left' | 'far' | 'disconnected'): void {
    this.players.delete(userId);
    this.roles.delete(userId);
    this.budgets.delete(userId);
    if (!this.disposed) {
      this.ctx.emitState();
    }
  }

  onAction(userId: string, action: unknown): void {
    if (this.disposed) return;

    let budget = this.budgets.get(userId);
    if (!budget) {
      budget = new Budget(15);
      this.budgets.set(userId, budget);
    }
    if (!budget.allow()) {
      throw new GameError('RATE_LIMIT', 'Too many actions');
    }

    if (!action || typeof action !== 'object' || !('type' in action)) {
      throw new GameError('BAD_REQUEST', 'Action must have a type');
    }

    const { type } = action as { type: unknown };

    if (type === 'place') {
      const { x, y, w, h, c } = action as Record<string, unknown>;
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof w !== 'number' ||
        typeof h !== 'number' ||
        typeof c !== 'number'
      ) {
        throw new GameError('BAD_REQUEST', 'Missing or invalid place parameters');
      }

      const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
      if (!board) {
        throw new GameError('LOADING', 'Board is not loaded yet');
      }

      const brick: Brick = [x, y, w, h, c];
      const validationError = validatePlace(board.bricks, brick);
      if (validationError) {
        throw new GameError('INVALID_BRICK', validationError);
      }

      this.legoService.place(this.ctx.workspaceId, this.ctx.objectId, brick);
      this.ctx.emitState();
      return;
    }

    if (type === 'remove') {
      const { x, y } = action as Record<string, unknown>;
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new GameError('BAD_REQUEST', 'Missing or invalid remove parameters');
      }

      const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
      if (!board) {
        throw new GameError('LOADING', 'Board is not loaded yet');
      }

      this.legoService.remove(this.ctx.workspaceId, this.ctx.objectId, x, y);
      this.ctx.emitState();
      return;
    }

    if (type === 'clear') {
      const role = this.roles.get(userId);
      if (role !== 'OWNER' && role !== 'ADMIN') {
        throw new GameError(
          'FORBIDDEN',
          'Only OWNER or ADMIN may clear the board',
        );
      }

      const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
      if (!board) {
        throw new GameError('LOADING', 'Board is not loaded yet');
      }

      this.legoService.clear(this.ctx.workspaceId, this.ctx.objectId);
      this.ctx.emitState();
      return;
    }

    throw new GameError('BAD_REQUEST', `Unknown action type: ${String(type)}`);
  }

  view(userId: string) {
    const board = this.legoService.peek(this.ctx.workspaceId, this.ctx.objectId);
    const role = this.roles.get(userId);
    const canClear = role === 'OWNER' || role === 'ADMIN';

    return {
      ready: !!board,
      w: BOARD_W,
      h: BOARD_H,
      bricks: board ? board.bricks : [],
      canClear,
      players: Array.from(this.players.values()).map((p) => p.name),
      version: board ? board.version : 0,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.players.clear();
    this.roles.clear();
    this.budgets.clear();
  }
}
