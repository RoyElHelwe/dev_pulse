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
import { Budget } from '../office/rules';
import { PrismaService } from '../prisma/prisma.service';
import { GameError, type GameKind, type GamePlayerRef } from './game.types';
import { GamesRegistry } from './games.registry';
import { gameRoom, GamesSessionManager } from './games.session';
import { isWithinProximity, JOIN_PROXIMITY_TILES } from './proximity';

interface SocketData {
  userId: string;
  sessionId: string;
  workspaceId: string;
  gameBudget?: Budget;
}

interface GameJoinDto {
  game: GameKind;
  id: string;
  intent?: unknown;
}

interface GameLeaveDto {
  id: string;
}

interface GameActionDto {
  id: string;
  action: unknown;
}

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

  handleDisconnect(socket: Socket) {
    const data = socket.data as Partial<SocketData> | undefined;
    if (!data?.userId) return;
    this.sessionManager.handleDisconnect(data.userId);
  }

  private checkBudget(socket: Socket, id?: string): boolean {
    const data = socket.data as Partial<SocketData>;
    if (!data.gameBudget) {
      data.gameBudget = new Budget(60);
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

    // Validate layout and furniture kind
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

    if (furniture.kind !== def.furnitureKind) {
      socket.emit('game:error', {
        id,
        code: 'WRONG_GAME',
        message: `Furniture kind ${furniture.kind} does not match game ${gameKind} (${def.furnitureKind})`,
      });
      return;
    }

    // Proximity check
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

  @SubscribeMessage('game:leave')
  handleLeave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as Partial<SocketData> | undefined;
    console.log('[DBG-FOOS] gateway handleLeave received:', data?.userId, body);
    if (!data?.userId || !data?.workspaceId) return;

    const payload = body as Partial<GameLeaveDto> | undefined;
    const id = typeof payload?.id === 'string' ? payload.id : undefined;

    if (!this.checkBudget(socket, id)) return;
    if (!id) return;

    this.sessionManager.leave(data.workspaceId, id, data.userId, 'left');
    socket.leave(gameRoom(data.workspaceId, id));
  }

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
