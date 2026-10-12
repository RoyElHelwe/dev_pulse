/**
 * Live meeting room whiteboard on the /office socket: join, merged edits, and collaborator cursors.
 * Only people standing in the room (and invited to its running booking) can read or draw.
 */

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { Budget } from '../office/office.rules';
import { roomOf } from './meeting-room.rules';
import { RoomAccess } from './room-access';
import { MAX_UPDATE_BYTES, parseElements } from './whiteboard.rules';
import { WhiteboardService } from './whiteboard.service';

interface BoardSocketData {
  userId: string;
  workspaceId: string;
  /** Flood protection: edits and cursor moves (cursors are sent ~20 times a second). */
  boardBudget?: Budget;
}

const MAX_MESSAGES_PER_SECOND = 60;
const POINTER_TOOLS = new Set(['pointer', 'laser']);

/** Socket.IO room of the people who have a room's board open. */
const channel = (workspaceId: string, roomId: string) => `wb:${workspaceId}:${roomId}`;

/** Relays whiteboard edits and cursors between the people who have a meeting room's board open. */
@WebSocketGateway({ namespace: '/office' })
export class WhiteboardGateway {
  @WebSocketServer() private server!: Namespace;

  constructor(
    private readonly boards: WhiteboardService,
    private readonly access: RoomAccess,
  ) {}

  /** Open the room's board. Ack: { elements } or { error: 'FORBIDDEN' | 'UNAVAILABLE' }. */
  @SubscribeMessage('wb:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId || !(await this.access.allows(me.workspaceId, me.userId, roomId)))
      return { error: 'FORBIDDEN' };
    try {
      const elements = await this.boards.elements(me.workspaceId, roomId);
      // One board open per tab.
      for (const r of socket.rooms) if (r.startsWith('wb:')) await socket.leave(r);
      await socket.join(channel(me.workspaceId, roomId));
      return { elements };
    } catch {
      return { error: 'UNAVAILABLE' };
    }
  }

  @SubscribeMessage('wb:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = socket.data as BoardSocketData | undefined;
    const roomId = roomOf(body);
    if (me?.workspaceId && roomId) await socket.leave(channel(me.workspaceId, roomId));
  }

  /** { roomId, elements }: changed elements; the newer copy of each is kept and passed on. */
  @SubscribeMessage('wb:update')
  async update(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId || !socket.rooms.has(channel(me.workspaceId, roomId))) return;
    if (JSON.stringify(body).length > MAX_UPDATE_BYTES) return;
    const elements = parseElements((body as { elements?: unknown }).elements);
    if (!elements?.length || !(await this.access.allows(me.workspaceId, me.userId, roomId))) return;
    const accepted = await this.boards.apply(me.workspaceId, roomId, elements).catch(() => []);
    if (accepted.length > 0)
      await this.relay(socket, me.workspaceId, roomId, 'wb:update', { roomId, elements: accepted });
  }

  /** { roomId, x, y, tool, button }: where someone's cursor is on the board (scene coordinates). */
  @SubscribeMessage('wb:pointer')
  async pointer(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = this.me(socket);
    const roomId = roomOf(body);
    if (!me || !roomId || !socket.rooms.has(channel(me.workspaceId, roomId))) return;
    const { x, y, tool, button } = body as {
      x?: unknown;
      y?: unknown;
      tool?: unknown;
      button?: unknown;
    };
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      return;
    const pointer = {
      roomId,
      from: me.userId,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      tool: typeof tool === 'string' && POINTER_TOOLS.has(tool) ? tool : 'pointer',
      button: button === 'down' ? 'down' : 'up',
    };
    await this.relay(socket, me.workspaceId, roomId, 'wb:pointer', pointer, true);
  }

  /**
   * Sends to the others who have the board open. Anyone who walked out of the room (or
   * lost access to a booking that started) is dropped from the board instead.
   */
  private async relay(
    from: Socket,
    workspaceId: string,
    roomId: string,
    event: string,
    payload: unknown,
    volatile = false,
  ) {
    const sockets = await this.server.in(channel(workspaceId, roomId)).fetchSockets();
    for (const s of sockets) {
      if (s.id === from.id) continue;
      const userId = (s.data as BoardSocketData | undefined)?.userId;
      if (!userId || !(await this.access.allows(workspaceId, userId, roomId))) {
        s.leave(channel(workspaceId, roomId));
        s.emit('wb:closed', { roomId });
        continue;
      }
      // Cursors are volatile: a slow connection skips old positions instead of queueing them.
      if (volatile) this.server.to(s.id).volatile.emit(event, payload);
      else s.emit(event, payload);
    }
  }

  private me(socket: Socket) {
    const me = socket.data as BoardSocketData | undefined;
    if (!me?.userId || !me.workspaceId) return null;
    return (me.boardBudget ??= new Budget(MAX_MESSAGES_PER_SECOND)).allow() ? me : null;
  }
}
