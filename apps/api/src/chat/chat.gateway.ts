import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { ChatService } from './chat.service';

/**
 * Chat over the office socket. No auth here: OfficeGateway's middleware already
 * let in only signed-in members and set `socket.data`.
 */
@WebSocketGateway({ namespace: '/office' })
export class ChatGateway {
  constructor(private readonly chat: ChatService) {}

  /** `{ channel, text }` → acked with `{ ok, message }` or `{ ok: false, error }`. */
  @SubscribeMessage('chat:send')
  send(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const { userId, workspaceId } = socket.data as { userId: string; workspaceId: string };
    return this.chat.send(workspaceId, userId, body);
  }
}
