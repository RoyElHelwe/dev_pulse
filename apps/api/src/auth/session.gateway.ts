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

/**
 * Every signed-in tab keeps a connection here. When its device is signed out
 * (another device took over, "sign out everywhere", password changed...), the
 * tab is told at once and goes to the sign-in page, even in the middle of
 * walking around the office.
 */
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
        // Give the message a moment to arrive, then hang up.
        setTimeout(() => this.server.in(roomOf(id)).disconnectSockets(true), 1000);
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
