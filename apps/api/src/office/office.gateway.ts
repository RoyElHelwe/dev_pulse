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
import { TILE } from './layout/geometry';
import type { OfficeLayout } from './layout/types';

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
  /** Status shown above the avatar (stored on the membership). */
  status: string | null;
  /** The zone they stand in (meeting room, lounge, desk), as their game reports it. */
  zone: string | null;
  sockets: Set<string>;
}

interface SocketData {
  userId: string;
  sessionId: string;
  workspaceId: string;
  /** Messages received in the current second (flood protection). */
  budget: { second: number; count: number };
}

const MAX_MOVES_PER_SECOND = 40;
const ZONE_ID = /^[\w:-]{1,64}$/;

const wsRoom = (id: string) => `ws:${id}`;
const userRoom = (id: string) => `user:${id}`;
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
  private readonly offices = new Map<string, { players: Map<string, Player>; width: number; height: number; spawn: { x: number; y: number } }>();
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
    private readonly workspaceEvents: WorkspaceEvents,
    private readonly sessionEvents: SessionEvents,
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
          socket.data = { userId: user.id, sessionId: user.sessionId, workspaceId: member.workspaceId, budget: { second: 0, count: 0 } } satisfies SocketData;
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
    const data = socket.data as SocketData;
    const office = await this.office(data.workspaceId);
    const member = await this.prisma.workspaceMember.findUnique({ where: { userId: data.userId }, include: { user: true } });
    if (!member || !socket.connected) return socket.disconnect(true);

    await socket.join([wsRoom(data.workspaceId), userRoom(data.userId), sessionRoom(data.sessionId)]);
    let player = office.players.get(data.userId);
    if (!player) {
      player = {
        id: data.userId,
        name: member.user.displayName,
        character: member.character,
        x: office.spawn.x * TILE,
        y: office.spawn.y * TILE,
        dir: 0,
        moving: false,
        status: member.status,
        zone: null,
        sockets: new Set(),
      };
      office.players.set(player.id, player);
      socket.to(wsRoom(data.workspaceId)).except(userRoom(data.userId)).emit('office:joined', this.publicPlayer(player));
    }
    player.sockets.add(socket.id);
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

  /** [x, y, dir, moving] in pixels. Invalid or too frequent messages are ignored. */
  @SubscribeMessage('move')
  move(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as SocketData;
    if (!Array.isArray(body) || body.length !== 4 || !this.withinBudget(data)) return;
    const [x, y, dir, moving] = body as [unknown, unknown, unknown, unknown];
    const office = this.offices.get(data.workspaceId);
    const player = office?.players.get(data.userId);
    if (!office || !player || typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    player.x = Math.round(Math.min(Math.max(x, 0), office.width * TILE));
    player.y = Math.round(Math.min(Math.max(y, 0), office.height * TILE));
    player.dir = dir === 1 || dir === 2 || dir === 3 ? dir : 0;
    player.moving = moving === 1 || moving === true;
    socket
      .to(wsRoom(data.workspaceId))
      .except(userRoom(data.userId))
      .volatile.emit('office:moved', [player.id, player.x, player.y, player.dir, player.moving ? 1 : 0]);
  }

  /** The zone the player just entered (or null when they left it): who is in which room. */
  @SubscribeMessage('zone')
  zone(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const data = socket.data as SocketData;
    if (!this.withinBudget(data)) return;
    const zone = typeof body === 'string' && ZONE_ID.test(body) ? body : null;
    const player = this.offices.get(data.workspaceId)?.players.get(data.userId);
    if (!player || player.zone === zone) return;
    player.zone = zone;
    socket.to(wsRoom(data.workspaceId)).except(userRoom(data.userId)).emit('office:zone', [player.id, zone]);
  }

  onModuleDestroy() {
    this.subscriptions.unsubscribe();
  }

  private withinBudget(data: SocketData) {
    const second = Math.floor(Date.now() / 1000);
    if (data.budget.second !== second) data.budget = { second, count: 0 };
    return ++data.budget.count <= MAX_MOVES_PER_SECOND;
  }

  private async office(workspaceId: string) {
    let office = this.offices.get(workspaceId);
    if (!office) {
      const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const layout = workspace.layout as unknown as OfficeLayout;
      office = { players: new Map(), width: layout.width, height: layout.height, spawn: layout.spawn };
      this.offices.set(workspaceId, office);
    }
    return office;
  }

  private publicPlayer(p: Player) {
    return { id: p.id, name: p.name, character: p.character, x: p.x, y: p.y, dir: p.dir, moving: p.moving, status: p.status, zone: p.zone };
  }

  private onWorkspaceEvent(event: WorkspaceEvent) {
    const room = this.server.to(wsRoom(event.workspaceId));
    const office = this.offices.get(event.workspaceId);
    switch (event.type) {
      case 'layout':
        if (office) Object.assign(office, { width: event.layout.width, height: event.layout.height, spawn: event.layout.spawn });
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
