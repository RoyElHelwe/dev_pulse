/**
 * Real-time session monitoring WebSocket gateway.
 * Maintains persistent connections for active browser tabs to push instant logout signals upon session revocation.
 */
import type { OnModuleDestroy } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser } from '../common/auth/auth-user';
import { authenticateSocket } from '../common/auth/socket-auth';
import { SessionEvents } from './session-events';
import { TokensService } from './tokens.service';

// Grace period allows client socket to receive 'session:ended' packet before connection teardown.
const DISCONNECT_GRACE_PERIOD_MS = 1000;

/** Real-time gateway notifying connected browser tabs immediately when their session family is revoked. */
@WebSocketGateway({ namespace: '/session' })
export class SessionGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() private server!: Namespace;
  private subscription?: Subscription;

  constructor(
    private readonly tokens: TokensService,
    private readonly events: SessionEvents,
  ) {}

  afterInit(namespace: Namespace) {
    // Refuse the connection itself (the client gets the reason in connect_error).
    namespace.use((socket, next) => {
      const user = authenticateSocket(socket, this.tokens);
      if (!user) return next(new Error('NOT_AUTHENTICATED'));
      this.tokens.isSessionAlive(user.sessionId).then(
        (alive) => next(alive ? undefined : new Error('SESSION_ENDED')),
        () => next(new Error('SERVER_ERROR')),
      );
    });

    this.subscription = this.events.ended$.subscribe(({ familyIds, reason }) => {
      for (const id of familyIds) {
        this.server.to(roomOf(id)).emit('session:ended', { reason });
        // Give the message a moment to arrive before hanging up.
        setTimeout(() => this.server.in(roomOf(id)).disconnectSockets(true), DISCONNECT_GRACE_PERIOD_MS);
      }
    });
  }

  handleConnection(socket: Socket) {
    const user = socket.data.user as AuthUser;
    void socket.join(roomOf(user.sessionId));
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }
}

const roomOf = (sessionId: string) => `session:${sessionId}`;

