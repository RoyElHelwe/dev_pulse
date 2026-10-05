import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

// Smallest possible Socket.IO gateway: proves websockets work through nginx.
// Feature gateways should use their own namespace, e.g.
// @WebSocketGateway({ namespace: '/office' }).
@WebSocketGateway()
export class HealthGateway {
  @SubscribeMessage('ping')
  ping() {
    return 'pong';
  }
}
