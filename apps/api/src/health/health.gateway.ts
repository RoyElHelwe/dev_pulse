import { type OnGatewayConnection, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { TokensService } from '../auth/tokens.service';
import { authenticateSocket } from '../common/auth/socket-auth';

// Smallest possible Socket.IO gateway: proves websockets work through nginx.
// Feature gateways should use their own namespace, e.g.
// @WebSocketGateway({ namespace: '/office' }), and disconnect anonymous users.
@WebSocketGateway()
export class HealthGateway implements OnGatewayConnection {
  constructor(private readonly tokens: TokensService) {}

  // This gateway stays open to everyone; it only remembers who is signed in.
  handleConnection(socket: Socket) {
    authenticateSocket(socket, this.tokens);
  }

  @SubscribeMessage('ping')
  ping() {
    return 'pong';
  }

  /** Example of reading the signed-in user in a socket event. */
  @SubscribeMessage('whoami')
  whoami(socket: Socket) {
    // Always return an object: Nest sends no reply at all for null.
    return { userId: (socket.data.user?.id as string | undefined) ?? null };
  }
}
