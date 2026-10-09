import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import { SessionEvents } from '../auth/session-events';
import { TokensService } from '../auth/tokens.service';
import { authenticateSocket } from '../common/auth/socket-auth';
import { PrismaService } from '../prisma/prisma.service';
import { type WorkspaceEvent, WorkspaceEvents } from '../workspace/workspace-events';
import { AppConfig } from '../config/app-config';
import { TILE } from './layout/geometry';
import type { OfficeLayout, Room } from './layout/types';
import { Budget, claimOffice, limitMove, TAB_ID, ZONE_ID } from './rules';

/** 0 down, 1 up, 2 left, 3 right. */
type Dir = 0 | 1 | 2 | 3;

interface Player {
  id: string;
  name: string;
  character: string;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  seated: boolean;
  /** Status shown above the avatar (stored on the membership). */
  status: string | null;
  /** The zone they stand in (meeting room, lounge, desk), as their game reports it. */
  zone: string | null;
  /** When the last position was accepted (0: take the next one as is, e.g. after a reconnect). */
  movedAt: number;
  sockets: Set<string>;
}

interface SocketData {
  userId: string;
  sessionId: string;
  workspaceId: string;
  /** Flood protection for `move` and `zone`. */
  budget: Budget;
  /** The browser tab (random id per page load) and whether it asked to take the office over. */
  tabId: string;
  takeover: boolean;
}

const MAX_MOVES_PER_SECOND = 40;

export const wsRoom = (id: string) => `ws:${id}`;
export const userRoom = (id: string) => `user:${id}`;
const sessionRoom = (id: string) => `session:${id}`;

/**
 * The live office: who is here and where they walk.
 *
 * Positions travel as tiny arrays, about 20 times a second while walking,
 * with `volatile` (a slow connection skips old positions instead of queueing
 * them: no lag build-up). Clients smooth the movement of others.
 */
@WebSocketGateway({ namespace: '/office' })
export class OfficeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() private server!: Namespace;
  private readonly logger = new Logger(OfficeGateway.name);
  private readonly offices = new Map<string, { players: Map<string, Player>; layout: OfficeLayout }>();
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
    private readonly workspaceEvents: WorkspaceEvents,
    private readonly sessionEvents: SessionEvents,
    private readonly config: AppConfig,
  ) {}

  afterInit(namespace: Namespace) {
    // Only signed-in members of an office get in.
    namespace.use((socket, next) => {
      const user = authenticateSocket(socket, this.tokens);
      if (!user) return next(new Error('NOT_AUTHENTICATED'));
      Promise.all([this.tokens.isSessionAlive(user.sessionId), this.prisma.workspaceMember.findUnique({ where: { userId: user.id } })])
        .then(([alive, member]) => {
          if (!alive) return next(new Error('SESSION_ENDED'));
          if (!member) return next(new Error('NO_WORKSPACE'));
          const auth = (socket.handshake.auth ?? {}) as { tabId?: unknown; takeover?: unknown };
          const tabId = typeof auth.tabId === 'string' && TAB_ID.test(auth.tabId) ? auth.tabId : socket.id;
          const takeover = auth.takeover === true;
          socket.data = { userId: user.id, sessionId: user.sessionId, workspaceId: member.workspaceId, budget: new Budget(MAX_MOVES_PER_SECOND), tabId, takeover } satisfies SocketData;
          // One office tab at a time: refuse here already (the client reads the reason in connect_error).
          if (claimOffice(this.openTabs(member.workspaceId, user.id), tabId, takeover).refuse) return next(new Error('ALREADY_OPEN'));
          next();
        })
        .catch(() => next(new Error('SERVER_ERROR')));
    });

    this.subscriptions.add(this.workspaceEvents.events$.subscribe((event) => this.onWorkspaceEvent(event)));
    this.subscriptions.add(
      this.sessionEvents.ended$.subscribe(({ familyIds }) => {
        for (const id of familyIds) this.server.in(sessionRoom(id)).disconnectSockets(true);
      }),
    );
  }

  async handleConnection(socket: Socket) {
    // Nest doesn't catch this promise: a failure (office deleted, database down) just closes the socket.
    try {
      await this.join(socket);
    } catch (error) {
      this.logger.warn(`connection refused: ${(error as Error).message}`);
      socket.disconnect(true);
    }
  }

  private async join(socket: Socket) {
    const data = socket.data as SocketData;
    const member = await this.prisma.workspaceMember.findUnique({ where: { userId: data.userId }, include: { user: true } });
    if (!member || member.workspaceId !== data.workspaceId) return socket.disconnect(true);
    const office = await this.office(data.workspaceId);
    if (!socket.connected) return;

    // One office tab at a time (checked again here: two tabs may have connected at once).
    // Old tabs leave the player's sockets first, so their disconnect doesn't make the avatar "leave".
    const claim = claimOffice(this.openTabs(data.workspaceId, data.userId), data.tabId, data.takeover);
    if (claim.refuse) {
      socket.emit('office:busy');
      return socket.disconnect(true);
    }
    for (const old of claim.drop) {
      office.players.get(data.userId)?.sockets.delete(old.id);
      const oldSocket = this.server.sockets.get(old.id);
      if (claim.notify.includes(old)) oldSocket?.emit('office:replaced');
      // A moment for the message to arrive, then hang up (it never reconnects by itself after this).
      setTimeout(() => oldSocket?.disconnect(true), claim.notify.includes(old) ? 300 : 0);
    }

    let player = office.players.get(data.userId);
    if (!player) {
      player = {
        id: data.userId,
        name: member.user.displayName,
        character: member.character,
        x: office.layout.spawn.x * TILE,
        y: office.layout.spawn.y * TILE,
        dir: 0,
        moving: false,
        seated: false,
        status: member.status,
        zone: null,
        movedAt: 0,
        sockets: new Set(),
      };
      office.players.set(player.id, player);
      socket.to(wsRoom(data.workspaceId)).except(userRoom(data.userId)).emit('office:joined', this.publicPlayer(player));
    }
    player.sockets.add(socket.id);
    player.movedAt = 0; // a (re)connected tab announces where it stands
    await socket.join([wsRoom(data.workspaceId), userRoom(data.userId), sessionRoom(data.sessionId)]);
    const others = [...office.players.values()].filter((p) => p.id !== data.userId).map((p) => this.publicPlayer(p));
    socket.emit('office:state', { players: others });
  }

  handleDisconnect(socket: Socket) {
    const data = socket.data as SocketData | undefined;
    if (!data?.workspaceId) return;
    const office = this.offices.get(data.workspaceId);
    const player = office?.players.get(data.userId);
    if (!office || !player) return;
    player.sockets.delete(socket.id);
    if (player.sockets.size === 0) {
      office.players.delete(player.id);
      this.server.to(wsRoom(data.workspaceId)).emit('office:left', { id: player.id });
      if (office.players.size === 0) this.offices.delete(data.workspaceId);
    }
  }

  /**
   * [x, y, dir, moving, seated?] in pixels. Invalid or too frequent messages are ignored,
   * and nobody moves faster than walking (see limitMove; walls aren't checked).
   */
  @SubscribeMessage('move')
  move(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as SocketData;
    if (!Array.isArray(body) || (body.length !== 4 && body.length !== 5) || !data.budget.allow()) return;
    const [x, y, dir, moving] = body as [unknown, unknown, unknown, unknown];
    const office = this.offices.get(data.workspaceId);
    const player = office?.players.get(data.userId);
    if (!office || !player || !player.sockets.has(socket.id) || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const to = {
      x: Math.round(Math.min(Math.max(x, 0), office.layout.width * TILE)),
      y: Math.round(Math.min(Math.max(y, 0), office.layout.height * TILE)),
    };
    const now = Date.now();
    const spawn = { x: office.layout.spawn.x * TILE, y: office.layout.spawn.y * TILE };
    const at = player.movedAt ? limitMove(player, to, now - player.movedAt, spawn) : to;
    player.x = at.x;
    player.y = at.y;
    player.movedAt = now;
    player.dir = dir === 1 || dir === 2 || dir === 3 ? dir : 0;
    player.moving = moving === 1 || moving === true;
    player.seated = body[4] === 1 || body[4] === true;
    socket
      .to(wsRoom(data.workspaceId))
      .except(userRoom(data.userId))
      .volatile.emit('office:moved', [player.id, player.x, player.y, player.dir, player.moving ? 1 : 0, player.seated ? 1 : 0]);
  }

  /**
   * Dev-only teleport: [x, y] in pixels. Accepted only when DEV_LOGIN is enabled
   * outside production. Clamps to office bounds, resets speed baseline.
   */
  @SubscribeMessage('dev:teleport')
  teleport(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    if (!this.config.devLogin) return;
    const data = socket.data as SocketData;
    if (!Array.isArray(body) || body.length !== 2 || !data?.budget?.allow()) return;
    const [x, y] = body as [unknown, unknown];
    const office = this.offices.get(data.workspaceId);
    const player = office?.players.get(data.userId);
    if (!office || !player || !player.sockets.has(socket.id) || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = Math.round(Math.min(Math.max(x, 0), office.layout.width * TILE));
    player.y = Math.round(Math.min(Math.max(y, 0), office.layout.height * TILE));
    player.movedAt = 0;
    socket
      .to(wsRoom(data.workspaceId))
      .except(userRoom(data.userId))
      .volatile.emit('office:moved', [player.id, player.x, player.y, player.dir, player.moving ? 1 : 0, player.seated ? 1 : 0]);
  }

  /**
   * The zone the player just entered (or null when they left it), as their game
   * reports it: display only (the people list), never used for access.
   */
  @SubscribeMessage('zone')
  zone(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as SocketData;
    if (!data.budget.allow()) return;
    const zone = typeof body === 'string' && ZONE_ID.test(body) ? body : null;
    const player = this.offices.get(data.workspaceId)?.players.get(data.userId);
    if (!player || !player.sockets.has(socket.id) || player.zone === zone) return;
    player.zone = zone;
    socket.to(wsRoom(data.workspaceId)).except(userRoom(data.userId)).emit('office:zone', [player.id, zone]);
  }

  // ---- For the other live features (voice, chat, meetings) --------------------------

  /**
   * Where someone stands right now (pixels) and the room they are in: the server's
   * copy of the positions clients report, speed-limited so nobody can jump into a
   * room, and its own copy of the layout (booked rooms are protected by the
   * attendee check). Null when they aren't in the office.
   */
  locate(workspaceId: string, userId: string): { x: number; y: number; room: Room | null } | null {
    const office = this.offices.get(workspaceId);
    const player = office?.players.get(userId);
    if (!office || !player) return null;
    return { x: player.x, y: player.y, room: roomAt(office.layout, player.x / TILE, player.y / TILE) };
  }

  /** The live connections of someone in the office, with the browser tab each belongs to. */
  private openTabs(workspaceId: string, userId: string) {
    const player = this.offices.get(workspaceId)?.players.get(userId);
    if (!player) return [];
    return [...player.sockets].map((id) => ({ id, tabId: (this.server.sockets.get(id)?.data as SocketData | undefined)?.tabId ?? id }));
  }

  /** Ids of the people standing in a room right now. */
  peopleIn(workspaceId: string, roomId: string): string[] {
    const office = this.offices.get(workspaceId);
    if (!office) return [];
    return [...office.players.values()].filter((p) => roomAt(office.layout, p.x / TILE, p.y / TILE)?.id === roomId).map((p) => p.id);
  }

  /** Sends an event to everyone in the office. */
  broadcast(workspaceId: string, event: string, payload: unknown) {
    this.server.to(wsRoom(workspaceId)).emit(event, payload);
  }

  /** Sends an event to all the tabs of one person. */
  sendTo(userId: string, event: string, payload: unknown) {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /** Sends an event to one tab. */
  sendToSocket(socketId: string, event: string, payload: unknown) {
    this.server.to(socketId).emit(event, payload);
  }

  onModuleDestroy() {
    this.subscriptions.unsubscribe();
  }

  private async office(workspaceId: string) {
    const loaded = this.offices.get(workspaceId);
    if (loaded) return loaded;
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    // Someone else may have loaded it meanwhile: everyone shares the first one.
    const office = this.offices.get(workspaceId) ?? { players: new Map(), layout: workspace.layout as unknown as OfficeLayout };
    this.offices.set(workspaceId, office);
    return office;
  }

  private publicPlayer(p: Player) {
    return { id: p.id, name: p.name, character: p.character, x: p.x, y: p.y, dir: p.dir, moving: p.moving, seated: p.seated, status: p.status, zone: p.zone };
  }

  private onWorkspaceEvent(event: WorkspaceEvent) {
    const room = this.server.to(wsRoom(event.workspaceId));
    const office = this.offices.get(event.workspaceId);
    switch (event.type) {
      case 'layout':
        if (office) office.layout = event.layout;
        room.emit('office:layout', { layout: event.layout, version: event.version, by: event.by });
        break;
      case 'member-updated': {
        const player = office?.players.get(event.userId);
        if (player && event.character) player.character = event.character;
        if (player && event.status !== undefined) player.status = event.status;
        room.emit('office:updated', { id: event.userId, character: event.character, role: event.role, status: event.status });
        break;
      }
      case 'desks':
        room.emit('office:desks', { desks: event.desks });
        break;
      case 'bookings':
        room.emit('office:bookings', { changed: true });
        break;
      case 'member-removed':
        this.server.to(userRoom(event.userId)).emit('office:removed', { reason: 'removed' });
        setTimeout(() => this.server.in(userRoom(event.userId)).disconnectSockets(true), 500);
        break;
      case 'deleted':
        room.emit('office:removed', { reason: 'deleted' });
        setTimeout(() => this.server.in(wsRoom(event.workspaceId)).disconnectSockets(true), 500);
        this.offices.delete(event.workspaceId);
        break;
    }
    this.logger.debug(`workspace ${event.workspaceId}: ${event.type}`);
  }
}

/** The smallest room containing the point (rooms can sit inside the open space). Tiles. */
function roomAt(layout: OfficeLayout, x: number, y: number): Room | null {
  let best: Room | null = null;
  for (const r of layout.rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && (!best || r.w * r.h < best.w * best.h)) best = r;
  }
  return best;
}
