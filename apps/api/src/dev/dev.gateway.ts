/**
 * Dev/test only socket gateway mounted on /office namespace.
 * Exposes helper events such as dev:teleport for end-to-end browser testing.
 */
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { OfficeGateway } from '../office/office.gateway';

/** Dev-only WebSocket gateway adding testing utilities to the /office namespace. */
@WebSocketGateway({ namespace: '/office' })
export class DevGateway {

  constructor(private readonly office: OfficeGateway) {}

  /**
   * `dev:teleport` with `[x, y]` in pixels: puts the player there at once, so e2e tests can
   * reach a room without walking. The move rules of OfficeGateway.teleport still apply.
   */
  @SubscribeMessage('dev:teleport')
  teleport(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    this.office.teleport(socket, body);
  }
}
