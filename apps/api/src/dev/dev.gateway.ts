/**
 * Dev/test only: socket events that exist for browser tests, on the /office namespace.
 * Never active in production because DevModule is only loaded when DEV_LOGIN=true outside
 * production, so `dev:teleport` is simply not a known event there.
 */
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { OfficeGateway } from '../office/office.gateway';

/** Same namespace as OfficeGateway (it owns the connection and its auth); this adds the test-only events. */
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
