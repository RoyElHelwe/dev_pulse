/**
 * WebSocket gateway handling real-time chat message transmission over the office namespace.
 * Receives socket events and delegates persistence and broadcast to ChatService.
 */

import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { ChatService } from './chat.service';

/** WebSocket gateway receiving live text chat submissions from connected office clients. */
@WebSocketGateway({ namespace: '/office' })
export class ChatGateway {
  constructor(private readonly chat: ChatService) {}

  /** `{ channel, text }` → acked with `{ ok, message }` or `{ ok: false, error }`. */
  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    // Authentication and membership were already validated at handshake by OfficeGateway middleware.
    const { userId, workspaceId } = socket.data as { userId: string; workspaceId: string };
    return this.chat.send(workspaceId, userId, body);
  }
}

