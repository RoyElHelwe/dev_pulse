import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { type ActiveBooking, MeetingsService } from '../meetings/meetings.service';
import { OfficeGateway } from '../office/office.gateway';
import { bookingAllows, withinEarshot } from './talk-rule';

interface VoiceSocketData {
  userId: string;
  workspaceId: string;
  /** Signals received in the current second (flood protection). */
  rtcBudget?: { second: number; count: number };
}

interface VoiceState {
  muted: boolean;
  deafened: boolean;
  /** The tab that joined voice: its disconnect means "left voice". */
  socketId: string;
}

/** An offer with its ICE candidates is a few KB; anything bigger is not a signal. */
const MAX_SIGNAL_BYTES = 16_000;
const MAX_SIGNALS_PER_SECOND = 50;
/** Bookings are looked up at most every few seconds per room (ICE candidates come in bursts). */
const BOOKING_CACHE_MS = 5_000;

/**
 * Voice: relays WebRTC signaling between two people of the same office, only when
 * the server itself agrees they can hear each other (same room, close enough or in
 * a meeting room, attendees while it's booked), and shares who is muted.
 *
 * Runs on the /office namespace: the OfficeGateway middleware has already
 * authenticated the socket and set `socket.data`.
 *
 * Events:
 * - `rtc:signal { to, data }` → `rtc:signal { from, data }` to all of `to`'s tabs,
 *   or `rtc:refused { to }` back when they may not talk.
 * - `voice:state { muted, deafened }` (joined voice / changed) → `office:voice [userId, muted, deafened]`.
 * - `voice:leave` or the tab closing → `office:voice [userId, null, null]`.
 * - `voice:states` (with ack) → `[userId, muted, deafened][]` of everyone in voice.
 */
@WebSocketGateway({ namespace: '/office' })
export class VoiceGateway implements OnGatewayDisconnect {
  /** workspaceId → userId → state, for people in voice. */
  private readonly states = new Map<string, Map<string, VoiceState>>();
  private readonly bookings = new Map<string, { at: number; booking: ActiveBooking | null }>();

  constructor(
    private readonly office: OfficeGateway,
    private readonly meetings: MeetingsService,
  ) {}

  @SubscribeMessage('rtc:signal')
  async signal(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = socket.data as VoiceSocketData;
    if (!me?.userId || !this.withinBudget(me) || !body || typeof body !== 'object') return;
    const { to, data } = body as { to?: unknown; data?: unknown };
    if (typeof to !== 'string' || to === me.userId || !data || typeof data !== 'object') return;
    if (JSON.stringify(data).length > MAX_SIGNAL_BYTES) return;
    if (!(await this.mayTalk(me.workspaceId, me.userId, to))) return void socket.emit('rtc:refused', { to });
    this.office.sendTo(to, 'rtc:signal', { from: me.userId, data });
  }

  @SubscribeMessage('voice:state')
  state(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const me = socket.data as VoiceSocketData;
    if (!me?.userId || !this.withinBudget(me) || !body || typeof body !== 'object') return;
    const { muted, deafened } = body as { muted?: unknown; deafened?: unknown };
    if (typeof muted !== 'boolean' || typeof deafened !== 'boolean') return;
    let office = this.states.get(me.workspaceId);
    if (!office) this.states.set(me.workspaceId, (office = new Map()));
    const before = office.get(me.userId);
    office.set(me.userId, { muted, deafened, socketId: socket.id });
    if (before?.muted !== muted || before?.deafened !== deafened) {
      this.office.broadcast(me.workspaceId, 'office:voice', [me.userId, muted, deafened]);
    }
  }

  @SubscribeMessage('voice:leave')
  leave(@ConnectedSocket() socket: Socket) {
    const me = socket.data as VoiceSocketData;
    if (me?.userId) this.forget(me, socket.id);
  }

  /** Everyone in voice right now (answered through the ack). */
  @SubscribeMessage('voice:states')
  list(@ConnectedSocket() socket: Socket) {
    const me = socket.data as VoiceSocketData;
    const office = me?.workspaceId ? this.states.get(me.workspaceId) : undefined;
    return [...(office ?? [])].map(([userId, s]) => [userId, s.muted, s.deafened]);
  }

  handleDisconnect(socket: Socket) {
    const me = socket.data as VoiceSocketData | undefined;
    if (me?.userId) this.forget(me, socket.id);
  }

  /** The tab that joined voice left it. */
  private forget(me: VoiceSocketData, socketId: string) {
    const office = this.states.get(me.workspaceId);
    if (office?.get(me.userId)?.socketId !== socketId) return;
    office.delete(me.userId);
    if (office.size === 0) this.states.delete(me.workspaceId);
    this.office.broadcast(me.workspaceId, 'office:voice', [me.userId, null, null]);
  }

  /** Server geometry only (never what clients claim): same office, same room, in earshot, booking. */
  private async mayTalk(workspaceId: string, a: string, b: string) {
    const spotA = this.office.locate(workspaceId, a);
    const spotB = this.office.locate(workspaceId, b);
    if (!withinEarshot(spotA, spotB)) return false;
    const room = spotA!.room;
    if (room?.kind !== 'meeting') return true;
    return bookingAllows(await this.booking(workspaceId, room.id), a, b);
  }

  private async booking(workspaceId: string, roomId: string) {
    const key = `${workspaceId}:${roomId}`;
    const cached = this.bookings.get(key);
    if (cached && Date.now() - cached.at < BOOKING_CACHE_MS) return cached.booking;
    let booking: ActiveBooking | null;
    try {
      booking = await this.meetings.activeBooking(workspaceId, roomId);
    } catch {
      return { attendeeIds: [] }; // can't tell who is invited: nobody talks there for now
    }
    this.bookings.set(key, { at: Date.now(), booking });
    if (this.bookings.size > 1000) this.bookings.clear();
    return booking;
  }

  private withinBudget(data: VoiceSocketData) {
    const second = Math.floor(Date.now() / 1000);
    if (data.rtcBudget?.second !== second) data.rtcBudget = { second, count: 0 };
    return ++data.rtcBudget.count <= MAX_SIGNALS_PER_SECOND;
  }
}
