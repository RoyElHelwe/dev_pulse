/**
 * Screen sharing in meeting rooms: one presenter per room, WebRTC video peer to peer.
 * The server only tracks who presents and relays signalling between presenter and viewers.
 */

import { ConnectedSocket, MessageBody, type OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { OfficeGateway } from '../office/office.gateway';
import { Budget } from '../office/office.rules';
import { roomOf } from './meeting-room.rules';
import { RoomAccess } from './room-access';

interface ScreenSocketData {
  userId: string;
  workspaceId: string;
  /** Flood protection for screen messages (separate from the office's and voice's). */
  screenBudget?: Budget;
}

interface Presenter {
  userId: string;
  /** The tab that shares: its disconnect ends the share. */
  socketId: string;
}

/** An offer with its ICE candidates is a few KB (video adds a little over audio). */
const MAX_SIGNAL_BYTES = 32_000;
const MAX_MESSAGES_PER_SECOND = 50;

const key = (workspaceId: string, roomId: string) => `${workspaceId}:${roomId}`;

/** Tracks the presenter of each meeting room and relays presenter ↔ viewer WebRTC signalling. */
@WebSocketGateway({ namespace: '/office' })
export class ScreenGateway implements OnGatewayDisconnect {
  /** "workspaceId:roomId" → who shares their screen there. */
  private readonly presenters = new Map<string, Presenter>();

  constructor(
    private readonly office: OfficeGateway,
    private readonly access: RoomAccess,
  ) {}

  /** Become the room's presenter. Ack: { ok } or { error: 'FORBIDDEN' | 'BUSY', by? }. */
  @SubscribeMessage('screen:start')
  async start(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId) return { error: 'FORBIDDEN' };
    if (!(await this.access.allows(me.workspaceId, me.userId, roomId))) return { error: 'FORBIDDEN' };
    const current = await this.current(me.workspaceId, roomId);
    if (current && current.userId !== me.userId) return { error: 'BUSY', by: current.userId };
    this.presenters.set(key(me.workspaceId, roomId), { userId: me.userId, socketId: socket.id });
    await this.announce(me.workspaceId, roomId, me.userId);
    return { ok: true };
  }

  @SubscribeMessage('screen:stop')
  async stop(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId) return;
    const current = this.presenters.get(key(me.workspaceId, roomId));
    if (current?.socketId !== socket.id) return;
    this.presenters.delete(key(me.workspaceId, roomId));
    await this.announce(me.workspaceId, roomId, null);
  }

  /** Who presents in the room (ack: user id or null); only answered to people allowed in it. */
  @SubscribeMessage('screen:who')
  async who(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId || !(await this.access.allows(me.workspaceId, me.userId, roomId))) return null;
    return (await this.current(me.workspaceId, roomId))?.userId ?? null;
  }

  /**
   * { roomId, to, data }: relayed only between the room's presenter and one viewer,
   * both standing in the room and invited to its running booking.
   */
  @SubscribeMessage('screen:signal')
  async signal(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    if (!me || !body || typeof body !== 'object') return;
    const { to, data } = body as { to?: unknown; data?: unknown };
    const roomId = roomOf(body);
    if (!roomId || typeof to !== 'string' || to === me.userId || !data || typeof data !== 'object') return;
    if (JSON.stringify(data).length > MAX_SIGNAL_BYTES) return;
    const presenter = await this.current(me.workspaceId, roomId);
    if (!presenter || (presenter.userId !== me.userId && presenter.userId !== to)) return void socket.emit('screen:refused', { roomId, to });
    const [mine, theirs] = await Promise.all([this.access.allows(me.workspaceId, me.userId, roomId), this.access.allows(me.workspaceId, to, roomId)]);
    if (!mine || !theirs) return void socket.emit('screen:refused', { roomId, to });
    const message = { roomId, from: me.userId, data };
    // To the presenter: the sharing tab only. To a viewer: their office tab (one per person).
    if (presenter.userId === to) this.office.sendToSocket(presenter.socketId, 'screen:signal', message);
    else this.office.sendTo(to, 'screen:signal', message);
  }

  async handleDisconnect(socket: Socket) {
    const me = socket.data as ScreenSocketData | undefined;
    if (!me?.workspaceId) return;
    for (const [k, p] of this.presenters) {
      if (p.socketId !== socket.id) continue;
      this.presenters.delete(k);
      await this.announce(me.workspaceId, k.slice(me.workspaceId.length + 1), null);
    }
  }

  /** The room's presenter, dropped when they walked out or lost access (their client may have crashed). */
  private async current(workspaceId: string, roomId: string) {
    const presenter = this.presenters.get(key(workspaceId, roomId));
    if (!presenter) return null;
    if (await this.access.allows(workspaceId, presenter.userId, roomId)) return presenter;
    this.presenters.delete(key(workspaceId, roomId));
    await this.announce(workspaceId, roomId, null);
    return null;
  }

  /** Tells everyone allowed in the room who presents now (null: nobody). */
  private async announce(workspaceId: string, roomId: string, userId: string | null) {
    for (const id of await this.access.audience(workspaceId, roomId)) this.office.sendTo(id, 'screen:presenter', { roomId, userId });
  }

  private me(socket: Socket) {
    const me = socket.data as ScreenSocketData | undefined;
    if (!me?.userId || !me.workspaceId) return null;
    return (me.screenBudget ??= new Budget(MAX_MESSAGES_PER_SECOND)).allow() ? me : null;
  }
}
