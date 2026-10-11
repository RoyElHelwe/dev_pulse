/**
 * WebSocket gateway handling office minigame interactions on the '/office' namespace.
 * Enforces rate limiting, validates spatial proximity, and routes join, leave, and action events.
 */

import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { OfficeGateway } from '../office/office.gateway';
import { Budget } from '../office/office.rules';
import { PrismaService } from '../prisma/prisma.service';
import { GameError, type GameKind, type GamePlayerRef } from './game.types';
import { GamesRegistry } from './games.registry';
import { gameRoom, GamesSessionManager } from './games.session';
import { isWithinProximity, JOIN_PROXIMITY_TILES } from './proximity';

/** Flood protection rate limit: at most 60 game events per second per socket. */
const GATEWAY_ACTION_BUDGET_PER_SEC = 60;

/** Socket data payload attached by auth and gateway middleware. */
interface SocketData {
  userId: string;
  sessionId: string;
  workspaceId: string;
  gameBudget?: Budget;
}

/** DTO for incoming 'game:join' WebSocket messages. */
interface GameJoinDto {
  game: GameKind;
  id: string;
  intent?: unknown;
}

/** DTO for incoming 'game:leave' WebSocket messages. */
interface GameLeaveDto {
  id: string;
}

/** DTO for incoming 'game:action' WebSocket messages. */
interface GameActionDto {
  id: string;
  action: unknown;
}

/**
 * WebSocket controller for minigame lifecycle and user action events.
 */
@WebSocketGateway({ namespace: '/office' })
export class GamesGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private server!: Namespace;
  private readonly logger = new Logger(GamesGateway.name);

  constructor(
    private readonly registry: GamesRegistry,
    private readonly sessionManager: GamesSessionManager,
    private readonly officeGateway: OfficeGateway,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Configures session manager message dispatchers once the WebSocket namespace is ready.
   */
  afterInit(namespace: Namespace) {
    this.sessionManager.setTransport({
      sendToUser: (userId, event, payload) => {
        this.officeGateway.sendTo(userId, event, payload);
      },
      sendToRoom: (room, event, payload) => {
        this.server.to(room).emit(event, payload);
      },
    });
  }

  /**
   * Handles socket disconnects by notifying active sessions with reason 'disconnected'.
   */
  handleDisconnect(socket: Socket) {
    const data = socket.data as Partial<SocketData> | undefined;
    if (!data?.userId) return;
    this.sessionManager.handleDisconnect(data.userId);
  }

  /**
   * Enforces a per-socket rate limit to prevent abuse or flood attacks.
   * WHY: Gateway-level rate-limiting protects against socket spam before invoking game logic.
   */
  private checkBudget(socket: Socket, id?: string): boolean {
    const data = socket.data as Partial<SocketData>;
    if (!data.gameBudget) {
      data.gameBudget = new Budget(GATEWAY_ACTION_BUDGET_PER_SEC);
    }
    if (!data.gameBudget.allow()) {
      socket.emit('game:error', {
        id,
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded (too many actions)',
      });
      return false;
    }
    return true;
  }

  /**
   * Subscribes a player to a minigame session after verifying proximity and furniture kind.
   */
  @SubscribeMessage('game:join')
  async handleJoin(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as Partial<SocketData> | undefined;
    if (!data?.userId || !data?.workspaceId) return;

    const payload = body as Partial<GameJoinDto> | undefined;
    const id = typeof payload?.id === 'string' ? payload.id : undefined;

    if (!this.checkBudget(socket, id)) return;

    if (!id || typeof payload?.game !== 'string') {
      socket.emit('game:error', {
        id,
        code: 'BAD_REQUEST',
        message: 'Invalid game:join payload',
      });
      return;
    }

    const gameKind = payload.game as GameKind;
    const def = this.registry.get(gameKind);
    if (!def) {
      socket.emit('game:error', {
        id,
        code: 'WRONG_GAME',
        message: `Unknown or unregistered game kind: ${gameKind}`,
      });
      return;
    }

    // WHY: Verify target furniture exists in current layout to prevent orphan sessions
    const layout = await this.sessionManager.getLayout(data.workspaceId);
    const furniture = layout?.furniture.find((f) => f.id === id);
    if (!furniture) {
      socket.emit('game:error', {
        id,
        code: 'NOT_FOUND',
        message: `Furniture object ${id} not found in workspace layout`,
      });
      return;
    }

    // WHY: Ensure client cannot join a Foosball game using a Lego board or card table
    if (furniture.kind !== def.furnitureKind) {
      socket.emit('game:error', {
        id,
        code: 'WRONG_GAME',
        message: `Furniture kind ${furniture.kind} does not match game ${gameKind} (${def.furnitureKind})`,
      });
      return;
    }

    // WHY: Proximity check ensures avatar is physically close (<= 4 tiles) to furniture
    const loc = this.officeGateway.locate(data.workspaceId, data.userId);
    if (
      !loc ||
      !isWithinProximity(
        { x: loc.x, y: loc.y },
        { x: furniture.x, y: furniture.y },
        JOIN_PROXIMITY_TILES,
      )
    ) {
      socket.emit('game:error', {
        id,
        code: 'NOT_NEAR',
        message: 'Too far away from the game object to join (must be within 4 tiles)',
      });
      return;
    }

    // Fetch user display name and character
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId: data.userId },
      include: { user: true },
    });
    const playerRef: GamePlayerRef = {
      userId: data.userId,
      name: member?.user.displayName ?? 'Player',
      character: member?.character ?? 'maya',
    };

    await socket.join(gameRoom(data.workspaceId, id));
    this.sessionManager.join(data.workspaceId, id, def, playerRef, payload.intent);
  }

  /**
   * Removes a player from an active minigame session upon explicit departure request.
   */
  @SubscribeMessage('game:leave')
  handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as Partial<SocketData> | undefined;
    if (!data?.userId || !data?.workspaceId) return;

    const payload = body as Partial<GameLeaveDto> | undefined;
    const id = typeof payload?.id === 'string' ? payload.id : undefined;

    if (!this.checkBudget(socket, id)) return;
    if (!id) return;

    this.sessionManager.leave(data.workspaceId, id, data.userId, 'left');
    socket.leave(gameRoom(data.workspaceId, id));
  }

  /**
   * Forwards a minigame action to the corresponding active session.
   */
  @SubscribeMessage('game:action')
  handleAction(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as Partial<SocketData> | undefined;
    if (!data?.userId || !data?.workspaceId) return;

    const payload = body as Partial<GameActionDto> | undefined;
    const id = typeof payload?.id === 'string' ? payload.id : undefined;

    if (!this.checkBudget(socket, id)) return;
    if (!id) return;

    try {
      this.sessionManager.action(data.workspaceId, id, data.userId, payload?.action);
    } catch (err) {
      if (err instanceof GameError) {
        socket.emit('game:error', {
          id,
          code: err.code,
          message: err.message,
        });
      } else {
        this.logger.error(`Error processing game action: ${(err as Error).message}`);
        socket.emit('game:error', {
          id,
          code: 'INTERNAL_ERROR',
          message: 'Failed to process game action',
        });
      }
    }
  }
}
