// Screen sharing in meeting rooms: one presenter sends their screen to everyone in the room.
// One-way WebRTC connections (presenter → each viewer), separate from voice, signalled over /office.

import type { Socket } from 'socket.io-client';
import { ICE_SERVERS } from '@/features/voice/VoicePeer';

/** A viewer that has not connected by then asks again. */
const CONNECT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 3_000;
const ACK_TIMEOUT_MS = 5_000;
/** Screens are mostly text and slides: a lower frame rate keeps them sharp for the same bandwidth. */
const MAX_FRAME_RATE = 30;

/** What travels through the server. `want`: a viewer asks for the stream; `bye`: hung up. */
type ScreenSignal = { want?: true; bye?: true; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

/** Immutable view of the share in the room we stand in, for React. */
export interface ScreenSnapshot {
  roomId: string | null;
  /** Who presents in our room (may be us). */
  presenterId: string | null;
  /** Our own capture while we present. */
  local: MediaStream | null;
  /** The presenter's screen while we watch. */
  remote: MediaStream | null;
  /** How many people receive our screen. */
  viewers: number;
  /** The browser's screen picker is open. */
  starting: boolean;
}

/** Outcome of "Share screen". */
export type StartResult = 'ok' | 'unsupported' | 'cancelled' | 'busy' | 'forbidden' | 'failed';

/** Phones and tablets can watch but cannot capture their screen from a browser. */
export const canShareScreen = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

/** Presenter and viewer sides of meeting room screen sharing for one /office socket. */
export class ScreenShare {
  private roomId: string | null = null;
  private presenterId: string | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private starting = false;
  /** Presenter side: one connection per viewer. */
  private viewers = new Map<string, RTCPeerConnection>();
  /** Viewer side: the connection to the presenter. */
  private watching: RTCPeerConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every room change, so late answers about the previous room are ignored. */
  private generation = 0;

  constructor(
    private readonly socket: Socket,
    private readonly myId: string,
    private readonly onChange: () => void,
  ) {
    socket.on('screen:presenter', this.onPresenter);
    socket.on('screen:signal', this.onSignal);
    socket.on('screen:refused', this.onRefused);
    socket.on('connect', this.onConnect);
  }

  snapshot(): ScreenSnapshot {
    return {
      roomId: this.roomId,
      presenterId: this.presenterId,
      local: this.local,
      remote: this.remote,
      viewers: [...this.viewers.values()].filter((pc) => pc.connectionState === 'connected').length,
      starting: this.starting,
    };
  }

  /** The meeting room we stand in (null: none). Leaving a room ends sharing and watching there. */
  setRoom(roomId: string | null) {
    if (roomId === this.roomId) return;
    this.stopPresenting();
    this.stopWatching();
    this.presenterId = null;
    this.roomId = roomId;
    this.generation++;
    if (roomId) this.ask();
    this.onChange();
  }

  async startPresenting(): Promise<StartResult> {
    if (!canShareScreen()) return 'unsupported';
    const roomId = this.roomId;
    if (!roomId || this.starting) return 'forbidden';
    if (this.local) return 'ok';
    if (this.presenterId && this.presenterId !== this.myId) return 'busy';
    this.starting = true;
    this.onChange();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: MAX_FRAME_RATE } },
        // Tab audio (a video playing in the shared tab); never the whole system, which would echo the call.
        audio: true,
        systemAudio: 'exclude',
        // Sharing the office tab itself would show the share inside the share.
        selfBrowserSurface: 'exclude',
      } as DisplayMediaStreamOptions);
    } catch (error) {
      this.starting = false;
      this.onChange();
      return (error as Error)?.name === 'NotAllowedError' ? 'cancelled' : 'failed';
    }
    const stop = () => stream.getTracks().forEach((t) => t.stop());
    // Walked out while the picker was open.
    if (this.roomId !== roomId) {
      stop();
      this.starting = false;
      this.onChange();
      return 'cancelled';
    }
    const ack = (await this.socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck('screen:start', { roomId })
      .catch(() => null)) as { ok?: boolean; error?: string } | null;
    this.starting = false;
    if (!ack?.ok || this.roomId !== roomId) {
      stop();
      this.onChange();
      return ack?.error === 'BUSY' ? 'busy' : ack?.error === 'FORBIDDEN' ? 'forbidden' : 'failed';
    }
    for (const track of stream.getVideoTracks()) track.contentHint = 'detail';
    // The browser's own "Stop sharing" bar ends the track.
    stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stopPresenting());
    this.local = stream;
    this.stopWatching();
    this.presenterId = this.myId;
    this.onChange();
    return 'ok';
  }

  stopPresenting() {
    if (!this.local) return;
    this.local.getTracks().forEach((t) => t.stop());
    this.local = null;
    for (const id of [...this.viewers.keys()]) this.dropViewer(id, true);
    if (this.roomId && this.socket.connected) this.socket.emit('screen:stop', { roomId: this.roomId });
    if (this.presenterId === this.myId) this.presenterId = null;
    this.onChange();
  }

  destroy() {
    this.stopPresenting();
    this.stopWatching();
    this.socket.off('screen:presenter', this.onPresenter);
    this.socket.off('screen:signal', this.onSignal);
    this.socket.off('screen:refused', this.onRefused);
    this.socket.off('connect', this.onConnect);
  }

  // ---- viewer side -------------------------------------------------------------

  /** Asks the server who presents in our room (answered only while we may be there). */
  private ask() {
    const { roomId, generation } = this;
    if (!roomId || !this.socket.connected) return;
    this.socket.emit('screen:who', { roomId }, (id: unknown) => {
      if (generation === this.generation) this.setPresenter(typeof id === 'string' ? id : null);
    });
  }

  private setPresenter(id: string | null) {
    if (id !== this.presenterId) {
      this.stopWatching();
      // Someone else took the room while we thought we presented (e.g. after a reconnect).
      if (this.local && id !== this.myId) this.stopPresenting();
      this.presenterId = id;
    }
    if (id && id !== this.myId && !this.watching) this.watch();
    this.onChange();
  }

  /** Opens a receive-only connection and asks the presenter for their screen. */
  private watch() {
    const presenter = this.presenterId;
    if (!presenter || !this.roomId) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.watching = pc;
    pc.onicecandidate = ({ candidate }) => candidate && this.send(presenter, { candidate: candidate.toJSON() });
    pc.ontrack = ({ track, streams }) => {
      // Audio and video come in one stream; a new MediaStream object makes React re-render.
      this.remote = new MediaStream(streams[0]?.getTracks() ?? [track]);
      this.onChange();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.retry();
    };
    this.retryTimer = setTimeout(() => pc.connectionState !== 'connected' && this.retry(), CONNECT_TIMEOUT_MS);
    this.send(presenter, { want: true });
  }

  private stopWatching(tell = true) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (!this.watching) return;
    if (tell && this.presenterId) this.send(this.presenterId, { bye: true });
    this.watching.close();
    this.watching = null;
    if (this.remote) {
      this.remote = null;
      this.onChange();
    }
  }

  /** The connection failed or never came up: start over after a short pause. */
  private retry() {
    this.stopWatching();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.presenterId && this.presenterId !== this.myId && !this.watching) this.watch();
    }, RETRY_DELAY_MS);
  }

  // ---- presenter side ----------------------------------------------------------

  /** A viewer asked for the screen: a fresh connection carrying our tracks, offered by us. */
  private addViewer(id: string) {
    const stream = this.local;
    if (!stream) return;
    this.dropViewer(id, false);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.viewers.set(id, pc);
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    pc.onnegotiationneeded = async () => {
      try {
        await pc.setLocalDescription();
        if (pc.localDescription) this.send(id, { description: pc.localDescription.toJSON() });
      } catch {
        // Closed while the offer was being made.
      }
    };
    pc.onicecandidate = ({ candidate }) => candidate && this.send(id, { candidate: candidate.toJSON() });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.dropViewer(id, false);
      this.onChange();
    };
  }

  private dropViewer(id: string, tell: boolean) {
    const pc = this.viewers.get(id);
    if (!pc) return;
    if (tell) this.send(id, { bye: true });
    pc.close();
    this.viewers.delete(id);
  }

  // ---- signalling ----------------------------------------------------------------

  private send(to: string, data: ScreenSignal) {
    if (this.roomId && this.socket.connected) this.socket.emit('screen:signal', { roomId: this.roomId, to, data });
  }

  private onSignal = async ({ roomId, from, data }: { roomId: string; from: string; data: ScreenSignal }) => {
    if (roomId !== this.roomId || typeof from !== 'string' || !data || typeof data !== 'object') return;
    // We present: messages come from viewers.
    if (this.local) {
      if (data.want) return this.addViewer(from);
      if (data.bye) return this.dropViewer(from, false);
      const pc = this.viewers.get(from);
      if (!pc) return;
      try {
        if (data.description) await pc.setRemoteDescription(data.description);
        else if (data.candidate) await pc.addIceCandidate(data.candidate);
      } catch {
        // A stale answer or candidate from a connection that was replaced.
      }
      return;
    }
    // We watch: messages come from the presenter.
    const pc = this.watching;
    if (from !== this.presenterId || !pc) return;
    if (data.bye) return this.stopWatching(false);
    try {
      if (data.description?.type === 'offer') {
        await pc.setRemoteDescription(data.description);
        await pc.setLocalDescription();
        if (pc.localDescription) this.send(from, { description: pc.localDescription.toJSON() });
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch {
      // Negotiation failed: the connect timeout starts over.
    }
  };

  private onPresenter = ({ roomId, userId }: { roomId: string; userId: string | null }) => {
    if (roomId === this.roomId) this.setPresenter(typeof userId === 'string' ? userId : null);
  };

  private onRefused = ({ roomId }: { roomId: string }) => {
    // The presenter stopped, or one of us lost access: find out who presents now.
    if (roomId === this.roomId && !this.local) {
      this.stopWatching(false);
      this.ask();
    }
  };

  private onConnect = async () => {
    // The server forgot us when the socket dropped: claim the room again, or catch up as a viewer.
    if (this.local && this.roomId) {
      const ack = (await this.socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('screen:start', { roomId: this.roomId })
        .catch(() => null)) as { ok?: boolean } | null;
      if (!ack?.ok) this.stopPresenting();
      return;
    }
    this.stopWatching(false);
    this.presenterId = null;
    this.ask();
  };
}
