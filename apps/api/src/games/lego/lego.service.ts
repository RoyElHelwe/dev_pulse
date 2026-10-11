/**
 * Lego board persistence, in-memory caching, and debounced/throttled change propagation.
 * Coordinates Prisma LegoBoard storage and emits real-time office websocket updates.
 */

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { OfficeGateway } from '../../office/office.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { GameError } from '../game.types';
import {
  type Brick,
  parseBricks,
  removeBrickAt,
  validatePlace,
} from './lego.rules';

export { LegoGameInstance } from './lego.game';

/** Debounce delay before persisting in-memory board modifications to PostgreSQL. */
export const SAVE_DEBOUNCE_MS = 400;

/** Throttle duration between broadcasting board state changes to the office. */
export const BROADCAST_THROTTLE_MS = 300;

/**
 * In-memory representation of an active Lego board.
 */
export interface CachedBoard {
  bricks: Brick[];
  version: number;
  loaded: boolean;
  saveTimer?: ReturnType<typeof setTimeout> | null;
  broadcastTimer?: ReturnType<typeof setTimeout> | null;
}

/**
 * Service managing Lego board lifecycle, caching, and persistence.
 */
@Injectable()
export class LegoService implements OnModuleDestroy {
  private readonly logger = new Logger(LegoService.name);
  private readonly cache = new Map<string, CachedBoard>();
  private readonly loadingPromises = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly officeGateway: OfficeGateway,
  ) {}

  /**
   * Ensures that the specified Lego board is loaded from the database into the cache.
   * Concurrent requests for the same board share the in-flight database load promise.
   */
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

  /**
   * Returns current cached bricks and version for a board without initiating a database fetch.
   */
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

  /**
   * Places a brick onto the cached board, schedules a debounced save, and throttles broadcast.
   */
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

  /**
   * Removes any brick covering coordinate (x, y) from the board.
   * Returns true if a brick was found and removed, false otherwise.
   */
  remove(workspaceId: string, objectId: string, x: number, y: number): boolean {
    const key = `${workspaceId}:${objectId}`;
    const entry = this.cache.get(key);
    if (!entry || !entry.loaded) {
      throw new GameError('LOADING', 'Board is not loaded yet');
    }

    const { nextBricks, removed } = removeBrickAt(entry.bricks, x, y);
    if (removed) {
      entry.bricks = nextBricks;
      entry.version++;
      this.scheduleDebouncedSave(workspaceId, objectId);
      this.scheduleThrottledBroadcast(workspaceId, objectId);
      return true;
    }
    return false;
  }

  /**
   * Clears all bricks from the specified board.
   */
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

  /**
   * Persists the current in-memory board state to the database using an upsert.
   * WHY: Single JSON column upsert per board is significantly faster than per-brick rows.
   */
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

  /**
   * Schedules a debounced database write for the board.
   * WHY: Debouncing (400ms) absorbs rapid brick edits while guaranteeing persistence.
   */
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
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Schedules a trailing throttled broadcast to notify office clients of changes.
   * WHY: Throttling (300ms) prevents flooding sockets during multi-user building bursts.
   */
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
    }, BROADCAST_THROTTLE_MS);
  }

  /**
   * Lists all Lego boards in a workspace, merging database records with dirty in-memory cache entries.
   */
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

  /**
   * Flushes all pending debounced saves immediately to database.
   */
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

  /**
   * Cleans up all pending timers and flushes unpersisted boards on module shutdown.
   */
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
