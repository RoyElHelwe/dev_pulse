/**
 * Active game session management and spatial proximity enforcement.
 * Binds office furniture objects to GameInstance lifecycles and routes participant interactions.
 */

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Subscription } from 'rxjs';
import { OfficeGateway } from '../office/office.gateway';
import type { OfficeLayout } from '../office/layout/types';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceEvents } from '../workspace/workspace-events';
import {
  type GameContext,
  type GameDefinition,
  GameError,
  type GameInstance,
  type GameKind,
  type GamePlayerRef,
} from './game.types';
import { GameResultsService } from './game-results.service';
import { distanceInTiles, LEAVE_PROXIMITY_TILES } from './proximity';

/** Interval in milliseconds between background spatial proximity sweeps. */
export const PROXIMITY_SWEEP_INTERVAL_MS = 1000;

/** Time-to-live in milliseconds for cached workspace office layouts. */
export const LAYOUT_CACHE_TTL_MS = 10_000;

/**
 * Computes the Socket.IO room name for a game instance bound to a furniture item.
 */
export const gameRoom = (workspaceId: string, objectId: string): string =>
  `game:${workspaceId}:${objectId}`;

/**
 * Transport abstraction allowing GameSession to deliver messages to users and rooms
 * without being tightly coupled to a specific WebSocket implementation.
 */
export interface GameSessionTransport {
  /** Sends a named event with payload directly to a specific user ID. */
  sendToUser(userId: string, event: string, payload: unknown): void;
  /** Broadcasts a named event with payload to an entire Socket.IO room. */
  sendToRoom(room: string, event: string, payload: unknown): void;
}

/**
 * Manages the lifecycle and participant roster of a single running minigame instance.
 */
export class GameSession {
  private readonly participantsMap = new Map<string, GamePlayerRef>();
  private readonly instance: GameInstance;
  private disposed = false;

  constructor(
    readonly workspaceId: string,
    readonly objectId: string,
    readonly definition: GameDefinition,
    private readonly transport: GameSessionTransport,
    private readonly resultsService: GameResultsService,
    private readonly onDisposed?: (session: GameSession) => void,
  ) {
    const ctx: GameContext = {
      workspaceId: this.workspaceId,
      objectId: this.objectId,
      kind: this.definition.kind,
      participants: () => this.participants(),
      emitState: () => this.emitState(),
      emitEvent: (event, data, only) => this.emitEvent(event, data, only),
      record: async (r) => {
        await this.resultsService.record({
          workspaceId: this.workspaceId,
          game: this.definition.kind,
          winners: r.winners,
          losers: r.losers,
        });
      },
      close: () => this.close(),
    };
    this.instance = this.definition.create(ctx);
  }

  /** Minigame kind identifier. */
  get kind(): GameKind {
    return this.definition.kind;
  }

  /** Returns the underlying concrete GameInstance engine. */
  getInstance(): GameInstance {
    return this.instance;
  }

  /** Indicates whether this session has been disposed. */
  isDisposed(): boolean {
    return this.disposed;
  }

  /** Returns all current players and spectators in this session. */
  participants(): GamePlayerRef[] {
    return Array.from(this.participantsMap.values());
  }

  /** Checks if a user is currently registered in this session. */
  hasParticipant(userId: string): boolean {
    return this.participantsMap.has(userId);
  }

  /**
   * Adds a player to the session, delegates to GameInstance.onJoin, and emits state.
   */
  join(player: GamePlayerRef, intent: unknown): void {
    if (this.disposed) return;
    this.participantsMap.set(player.userId, player);
    this.instance.onJoin(player, intent);
    this.emitState();
  }

  /**
   * Removes a player from the session and notifies the game engine.
   * Disposes the session immediately if the last participant departs.
   *
   * WHY: Zero-participant sessions are immediately cleaned up to reclaim memory
   * and stop any active timers or physics loops.
   */
  leave(userId: string, reason: 'left' | 'far' | 'disconnected'): void {
    if (this.disposed) return;
    if (!this.participantsMap.has(userId)) return;

    this.participantsMap.delete(userId);
    this.instance.onLeave(userId, reason);
    this.transport.sendToUser(userId, 'game:left', { id: this.objectId, reason });

    if (this.participantsMap.size === 0) {
      this.dispose();
    } else {
      this.emitState();
    }
  }

  /**
   * Forwards an action to the game instance if the sender is an active participant.
   */
  action(userId: string, action: unknown): void {
    if (this.disposed) return;
    if (!this.participantsMap.has(userId)) {
      throw new GameError('NOT_FOUND', 'User is not a participant in this game');
    }
    this.instance.onAction(userId, action);
  }

  /**
   * Broadcasts individualized game:state projections to each participant.
   * WHY: Each user receives a custom view via instance.view(userId) to prevent leaking hidden state.
   */
  emitState(): void {
    if (this.disposed) return;
    for (const player of this.participantsMap.values()) {
      const state = this.instance.view(player.userId);
      this.transport.sendToUser(player.userId, 'game:state', {
        id: this.objectId,
        game: this.kind,
        state,
      });
    }
  }

  /**
   * Dispatches a custom game event either to specific users or to the entire room.
   */
  emitEvent(event: string, data?: unknown, only?: string[]): void {
    if (this.disposed) return;
    const payload = { id: this.objectId, event, data };
    if (only && only.length > 0) {
      for (const userId of only) {
        if (this.participantsMap.has(userId)) {
          this.transport.sendToUser(userId, 'game:event', payload);
        }
      }
    } else {
      this.transport.sendToRoom(gameRoom(this.workspaceId, this.objectId), 'game:event', payload);
    }
  }

  /**
   * Closes the session forcibly, ejecting all participants and disposing the instance.
   */
  close(): void {
    if (this.disposed) return;
    const participants = this.participants();
    for (const p of participants) {
      this.transport.sendToUser(p.userId, 'game:ended', {
        id: this.objectId,
        result: { reason: 'closed' },
      });
      this.transport.sendToUser(p.userId, 'game:left', {
        id: this.objectId,
        reason: 'closed',
      });
    }
    this.participantsMap.clear();
    this.dispose();
  }

  /**
   * Releases resources, triggers engine disposal, and fires the disposal callback.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.instance.dispose();
    } catch {
      // ignore errors during disposal
    }
    this.onDisposed?.(this);
  }
}

/**
 * Service managing all concurrent minigame sessions across workspaces.
 * Tracks active sessions, enforces one-session-per-user, and executes periodic proximity sweeps.
 */
@Injectable()
export class GamesSessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamesSessionManager.name);
  private readonly sessions = new Map<string, GameSession>();
  private readonly userActiveSession = new Map<
    string,
    { workspaceId: string; objectId: string }
  >();
  private readonly layoutCache = new Map<string, { layout: OfficeLayout; fetchedAt: number }>();
  private subscription?: Subscription;
  private sweepInterval?: NodeJS.Timeout;
  private transport?: GameSessionTransport;

  constructor(
    private readonly officeGateway: OfficeGateway,
    private readonly prisma: PrismaService,
    private readonly resultsService: GameResultsService,
    private readonly workspaceEvents: WorkspaceEvents,
  ) {}

  /**
   * Initializes layout cache subscriptions and starts the periodic proximity sweep loop.
   */
  onModuleInit() {
    this.subscription = this.workspaceEvents.events$.subscribe((event) => {
      if (event.type === 'layout') {
        this.layoutCache.set(event.workspaceId, { layout: event.layout, fetchedAt: Date.now() });
      }
    });

    this.sweepInterval = setInterval(() => {
      this.sweepProximity().catch((err) => {
        this.logger.error(`Error in proximity sweep: ${(err as Error).message}`);
      });
    }, PROXIMITY_SWEEP_INTERVAL_MS);
  }

  /**
   * Shuts down sweep timers and disposes all active sessions on module teardown.
   */
  onModuleDestroy() {
    if (this.sweepInterval) clearInterval(this.sweepInterval);
    this.subscription?.unsubscribe();
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
    this.userActiveSession.clear();
  }

  /**
   * Overrides the default session transport mechanism.
   */
  setTransport(transport: GameSessionTransport) {
    this.transport = transport;
  }

  /**
   * Returns the configured transport or a fallback bridging through OfficeGateway.
   */
  getTransport(): GameSessionTransport {
    if (this.transport) return this.transport;
    return {
      sendToUser: (userId, event, payload) => this.officeGateway.sendTo(userId, event, payload),
      sendToRoom: (_room, _event, _payload) => {
        this.logger.warn('No custom room transport set');
      },
    };
  }

  /**
   * Retrieves an active game session by workspaceId and objectId.
   */
  getSession(workspaceId: string, objectId: string): GameSession | undefined {
    return this.sessions.get(`${workspaceId}:${objectId}`);
  }

  /**
   * Returns the active game location (workspaceId + objectId) for a user, if currently playing.
   */
  getUserActiveSession(userId: string): { workspaceId: string; objectId: string } | undefined {
    return this.userActiveSession.get(userId);
  }

  /**
   * Returns an array of all active game sessions.
   */
  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Fetches or retrieves cached office layout for proximity calculations.
   * WHY: Caching layout for 10s prevents querying PostgreSQL on every 1-second proximity sweep.
   */
  async getLayout(workspaceId: string): Promise<OfficeLayout | null> {
    const cached = this.layoutCache.get(workspaceId);
    if (cached && Date.now() - cached.fetchedAt < LAYOUT_CACHE_TTL_MS) {
      return cached.layout;
    }
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) return null;
    const layout = ws.layout as unknown as OfficeLayout;
    this.layoutCache.set(workspaceId, { layout, fetchedAt: Date.now() });
    return layout;
  }

  /**
   * Joins a player into a game session, creating a new session if none currently exists.
   * WHY: A user can only participate in one game at a time; if they were in another session,
   * they are automatically removed with reason 'left'.
   */
  join(
    workspaceId: string,
    objectId: string,
    definition: GameDefinition,
    player: GamePlayerRef,
    intent: unknown,
  ): GameSession {
    const current = this.userActiveSession.get(player.userId);
    if (current && (current.workspaceId !== workspaceId || current.objectId !== objectId)) {
      this.leave(current.workspaceId, current.objectId, player.userId, 'left');
    }

    const key = `${workspaceId}:${objectId}`;
    let session = this.sessions.get(key);
    if (!session || session.isDisposed()) {
      session = new GameSession(
        workspaceId,
        objectId,
        definition,
        this.getTransport(),
        this.resultsService,
        (s) => this.onSessionDisposed(s),
      );
      this.sessions.set(key, session);
    }

    session.join(player, intent);
    this.userActiveSession.set(player.userId, { workspaceId, objectId });
    return session;
  }

  /**
   * Removes a player from an active session.
   */
  leave(
    workspaceId: string,
    objectId: string,
    userId: string,
    reason: 'left' | 'far' | 'disconnected',
  ): void {
    const key = `${workspaceId}:${objectId}`;
    const session = this.sessions.get(key);
    if (session) {
      session.leave(userId, reason);
    }

    const active = this.userActiveSession.get(userId);
    if (active && active.workspaceId === workspaceId && active.objectId === objectId) {
      this.userActiveSession.delete(userId);
    }
  }

  /**
   * Handles user socket disconnection, marking them as departed with reason 'disconnected'.
   */
  handleDisconnect(userId: string): void {
    const active = this.userActiveSession.get(userId);
    if (active) {
      this.leave(active.workspaceId, active.objectId, userId, 'disconnected');
    }
  }

  /**
   * Dispatches an action to the target game session.
   */
  action(workspaceId: string, objectId: string, userId: string, action: unknown): void {
    const session = this.getSession(workspaceId, objectId);
    if (!session) {
      throw new GameError('NOT_FOUND', 'Game session not found');
    }
    session.action(userId, action);
  }

  /**
   * Periodic sweep checking distances between joined players and their furniture items.
   * WHY: Players walking away (> 7 tiles) are automatically ejected with reason 'far'
   * so abandoned games do not remain blocked indefinitely.
   */
  async sweepProximity(): Promise<void> {
    for (const session of Array.from(this.sessions.values())) {
      if (session.isDisposed()) continue;

      const layout = await this.getLayout(session.workspaceId);
      const furniture = layout?.furniture.find((f) => f.id === session.objectId);

      for (const p of session.participants()) {
        const loc = this.officeGateway.locate(session.workspaceId, p.userId);
        const isFar =
          !loc ||
          !furniture ||
          distanceInTiles({ x: loc.x, y: loc.y }, { x: furniture.x, y: furniture.y }) >
            LEAVE_PROXIMITY_TILES;

        if (isFar) {
          this.leave(session.workspaceId, session.objectId, p.userId, 'far');
        }
      }
    }
  }

  /**
   * Callback invoked when a GameSession disposes, cleaning up manager maps.
   */
  private onSessionDisposed(session: GameSession): void {
    const key = `${session.workspaceId}:${session.objectId}`;
    if (this.sessions.get(key) === session) {
      this.sessions.delete(key);
    }
    for (const [userId, active] of this.userActiveSession.entries()) {
      if (active.workspaceId === session.workspaceId && active.objectId === session.objectId) {
        this.userActiveSession.delete(userId);
      }
    }
  }
}
