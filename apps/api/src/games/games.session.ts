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

export const gameRoom = (workspaceId: string, objectId: string) =>
  `game:${workspaceId}:${objectId}`;

export interface GameSessionTransport {
  sendToUser(userId: string, event: string, payload: unknown): void;
  sendToRoom(room: string, event: string, payload: unknown): void;
}

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

  get kind(): GameKind {
    return this.definition.kind;
  }

  getInstance(): GameInstance {
    return this.instance;
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  participants(): GamePlayerRef[] {
    return Array.from(this.participantsMap.values());
  }

  hasParticipant(userId: string): boolean {
    return this.participantsMap.has(userId);
  }

  join(player: GamePlayerRef, intent: unknown): void {
    if (this.disposed) return;
    this.participantsMap.set(player.userId, player);
    this.instance.onJoin(player, intent);
    this.emitState();
  }

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

  action(userId: string, action: unknown): void {
    if (this.disposed) return;
    if (!this.participantsMap.has(userId)) {
      throw new GameError('NOT_FOUND', 'User is not a participant in this game');
    }
    this.instance.onAction(userId, action);
  }

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
    }, 1000);
  }

  onModuleDestroy() {
    if (this.sweepInterval) clearInterval(this.sweepInterval);
    this.subscription?.unsubscribe();
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
    this.userActiveSession.clear();
  }

  setTransport(transport: GameSessionTransport) {
    this.transport = transport;
  }

  getTransport(): GameSessionTransport {
    if (this.transport) return this.transport;
    return {
      sendToUser: (userId, event, payload) => this.officeGateway.sendTo(userId, event, payload),
      sendToRoom: (_room, _event, _payload) => {
        // Fallback: without socket server room broadcast, send to each member
        this.logger.warn('No custom room transport set');
      },
    };
  }

  getSession(workspaceId: string, objectId: string): GameSession | undefined {
    return this.sessions.get(`${workspaceId}:${objectId}`);
  }

  getUserActiveSession(userId: string): { workspaceId: string; objectId: string } | undefined {
    return this.userActiveSession.get(userId);
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  async getLayout(workspaceId: string): Promise<OfficeLayout | null> {
    const cached = this.layoutCache.get(workspaceId);
    if (cached && Date.now() - cached.fetchedAt < 10_000) {
      return cached.layout;
    }
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) return null;
    const layout = ws.layout as unknown as OfficeLayout;
    this.layoutCache.set(workspaceId, { layout, fetchedAt: Date.now() });
    return layout;
  }

  join(
    workspaceId: string,
    objectId: string,
    definition: GameDefinition,
    player: GamePlayerRef,
    intent: unknown,
  ): GameSession {
    // One active game per user: leaving previous game if different
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

  handleDisconnect(userId: string): void {
    const active = this.userActiveSession.get(userId);
    if (active) {
      this.leave(active.workspaceId, active.objectId, userId, 'disconnected');
    }
  }

  action(workspaceId: string, objectId: string, userId: string, action: unknown): void {
    const session = this.getSession(workspaceId, objectId);
    if (!session) {
      throw new GameError('NOT_FOUND', 'Game session not found');
    }
    session.action(userId, action);
  }

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
