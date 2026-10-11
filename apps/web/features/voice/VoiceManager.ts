// Coordinator for proximity voice chat: socket signalling, membership/room layout tracking, and periodic tick loops.
// Coordinates VoicePeer connection instances and VoiceAudio processing.

import type { Socket } from 'socket.io-client';
import type { OfficeController, OfficeSnapshot } from '@/game/createGame';
import type { OfficeLayout, RoomKind } from '@/game/layout/types';
import { NEAR_RADIUS as NEAR } from '@/game/systems/Proximity';
import { relativeTo } from './spatial';
import { voiceStates } from './voiceStore';
import { calculateSpatialGain, setupUserAudio, VoiceLevel } from './VoiceAudio';
import { type VoiceSignal, VoicePeer } from './VoicePeer';

const ANSWER_RADIUS_TILES = NEAR + 1;
const TICK_INTERVAL_MS = 150;
const CALL_RETRY_DELAY_MS = 5_000;
const EARLY_CANDIDATES_TTL_MS = 2_000;
const MASTER_GAIN_RAMP_SMOOTH_SEC = 0.02;

type Spot = OfficeSnapshot['me'];

export interface VoiceSnapshot {
  joined: boolean;
  muted: boolean;
  deafened: boolean;
  pushToTalk: boolean;
  /** Our mic is sending sound right now. */
  live: boolean;
  /** Who we are connected to. */
  peers: string[];
}

interface Options {
  socket: Socket;
  myId: string;
  controller(): OfficeController | null;
  onChange(): void;
}

/** Coordinates proximity voice signalling, peer connections, and room audio updates. */
export class VoiceManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mic: MediaStream | null = null;
  private micLevel: VoiceLevel | null = null;
  private peers = new Map<string, VoicePeer>();
  private retryAt = new Map<string, number>();
  private early = new Map<string, { at: number; candidates: RTCIceCandidateInit[] }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private kinds = new Map<string, RoomKind>();
  private spans = new Map<string, number>();
  private muted = false;
  private deafened = false;
  private pushToTalk = false;
  private keyHeld = false;
  private destroyed = false;
  private me = { inCall: false, talking: false };

  constructor(private readonly opts: Options) {
    opts.socket.on('rtc:signal', this.onSignal);
    opts.socket.on('rtc:refused', this.onRefused);
    opts.socket.on('connect', this.onConnect);
  }

  snapshot(): VoiceSnapshot {
    return {
      joined: !!this.mic,
      muted: this.muted,
      deafened: this.deafened,
      pushToTalk: this.pushToTalk,
      live: this.micOpen(),
      peers: [...this.peers.keys()],
    };
  }

  setLayout(layout: OfficeLayout) {
    this.kinds = new Map(layout.rooms.map((r) => [r.id, r.kind]));
    this.spans = new Map(layout.rooms.map((r) => [r.id, Math.max(r.w, r.h)]));
  }

  async join(): Promise<'ok' | 'denied' | 'no-mic' | 'unsupported'> {
    if (this.ctx) return 'ok';
    const res = await setupUserAudio();
    if (!res.ok) return res.status;
    if (this.destroyed) {
      res.mic.getTracks().forEach((t) => t.stop());
      return 'ok';
    }
    this.ctx = res.ctx;
    this.mic = res.mic;
    this.master = res.ctx.createGain();
    this.master.connect(res.ctx.destination);
    this.micLevel = new VoiceLevel(res.ctx, res.ctx.createMediaStreamSource(res.mic));
    this.applyMic();
    this.timer = setInterval(this.tick, TICK_INTERVAL_MS);
    this.opts.onChange();
    return 'ok';
  }

  leave() {
    if (!this.ctx) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const id of [...this.peers.keys()]) this.hangUp(id);
    this.mic?.getTracks().forEach((t) => t.stop());
    this.micLevel?.disconnect();
    void this.ctx.close().catch(() => {});
    this.ctx = this.master = this.mic = this.micLevel = null;
    this.retryAt.clear();
    this.early.clear();
    this.showMe(false, false);
    if (this.opts.socket.connected) this.opts.socket.emit('voice:leave');
    this.opts.onChange();
  }

  destroy() {
    this.destroyed = true;
    this.leave();
    this.opts.socket.off('rtc:signal', this.onSignal);
    this.opts.socket.off('rtc:refused', this.onRefused);
    this.opts.socket.off('connect', this.onConnect);
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    this.applyMic();
  }

  setDeafened(deafened: boolean) {
    if (this.deafened === deafened) return;
    this.deafened = deafened;
    this.applyMic();
  }

  setPushToTalk(on: boolean) {
    this.pushToTalk = on;
    this.keyHeld = false;
    this.applyMic();
  }

  setKeyHeld(held: boolean) {
    if (this.keyHeld === held) return;
    this.keyHeld = held;
    this.applyMic();
  }

  private micOpen() {
    return !!this.mic && !this.muted && !this.deafened && (!this.pushToTalk || this.keyHeld);
  }

  private applyMic() {
    const open = this.micOpen();
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = open));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.deafened ? 0 : 1, this.ctx.currentTime, MASTER_GAIN_RAMP_SMOOTH_SEC);
    this.sendState();
    this.opts.onChange();
  }

  private sendState() {
    if (this.mic && this.opts.socket.connected) {
      this.opts.socket.emit('voice:state', { muted: this.muted, deafened: this.deafened });
    }
  }

  private onConnect = () => this.sendState();
  private inMeeting = (room: string | null) => room !== null && this.kinds.get(room) === 'meeting';
  private hearable = (me: Spot, other: Spot, radius: number) =>
    other.room === me.room && (this.inMeeting(me.room) || Math.hypot(other.x - me.x, other.y - me.y) < radius);

  private inEarshot(id: string) {
    const snap = this.opts.controller()?.snapshot();
    const other = snap?.others.find((o) => o.id === id);
    return !!snap && !!other && voiceStates.has(id) && this.hearable(snap.me, other, ANSWER_RADIUS_TILES);
  }

  private tick = () => {
    const snap = this.opts.controller()?.snapshot();
    if (!snap || !this.ctx) return;
    const now = performance.now();
    const span = this.inMeeting(snap.me.room) ? (this.spans.get(snap.me.room!) ?? 0) : 0;
    const before = this.peerKeys();
    const seen = new Set<string>();

    for (const other of snap.others) {
      seen.add(other.id);
      let peer = this.peers.get(other.id);
      // Hysteresis: only dial new calls inside NEAR, but maintain connected calls up to ANSWER_RADIUS_TILES to avoid perimeter flickering.
      const want = voiceStates.has(other.id) && this.hearable(snap.me, other, peer ? ANSWER_RADIUS_TILES : NEAR);
      if (peer && (!want || peer.stuck(now))) {
        if (want) this.retryAt.set(other.id, now + CALL_RETRY_DELAY_MS);
        this.hangUp(other.id);
        continue;
      }
      // Lexicographically smaller userId initiates call to prevent glare collisions over signalling.
      const caller = this.opts.myId < other.id;
      if (!peer && want && caller && this.opts.socket.connected && (this.retryAt.get(other.id) ?? 0) <= now) {
        peer = this.call(other.id);
      }
      if (peer) {
        const dx = other.x - snap.me.x;
        const dy = other.y - snap.me.y;
        const distance = Math.hypot(dx, dy);
        const gain = calculateSpatialGain(distance, span, ANSWER_RADIUS_TILES);
        peer.place(relativeTo(dx, dy, snap.me.dir), gain);
      }
    }
    for (const id of [...this.peers.keys()]) if (!seen.has(id)) this.hangUp(id);

    for (const peer of this.peers.values()) {
      const talking = peer.talking(now);
      if (peer.shown !== talking) {
        peer.shown = talking;
        this.opts.controller()?.setVoice(peer.id, true, talking);
      }
    }
    this.showMe(this.peers.size > 0, this.micOpen() && !!this.micLevel?.talking(now));
    if (this.peerKeys() !== before) this.opts.onChange();
  };

  private peerKeys = () => [...this.peers.keys()].join();

  private showMe(inCall: boolean, talking: boolean) {
    if (this.me.inCall === inCall && this.me.talking === talking) return;
    this.me = { inCall, talking };
    this.opts.controller()?.setVoice(this.opts.myId, inCall, talking);
  }

  private call(id: string) {
    const { socket } = this.opts;
    const peer = new VoicePeer(id, this.opts.myId < id, this.ctx!, this.master!, this.mic!, (data) => {
      if (socket.connected) socket.emit('rtc:signal', { to: id, data });
    });
    this.peers.set(id, peer);
    return peer;
  }

  private hangUp(id: string, tell = true) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (tell && this.opts.socket.connected) this.opts.socket.emit('rtc:signal', { to: id, data: { bye: true } });
    peer.close();
    this.peers.delete(id);
    this.opts.controller()?.setVoice(id, false, false);
  }

  private onSignal = ({ from, data }: { from: string; data: VoiceSignal }) => {
    if (!this.ctx || !this.mic || typeof from !== 'string' || !data || typeof data !== 'object') return;
    let peer = this.peers.get(from);
    if (data.bye) {
      this.retryAt.set(from, performance.now() + CALL_RETRY_DELAY_MS);
      if (peer) {
        this.hangUp(from, false);
        this.opts.onChange();
      }
      return;
    }
    if (!peer) {
      const now = performance.now();
      if (data.candidate) {
        // Buffer early ICE candidates that arrive ahead of the SDP offer description.
        const early = this.early.get(from);
        if (early && now - early.at < EARLY_CANDIDATES_TTL_MS) early.candidates.push(data.candidate);
        else this.early.set(from, { at: now, candidates: [data.candidate] });
        return;
      }
      if (data.description?.type !== 'offer' || !this.inEarshot(from)) return;
      peer = this.call(from);
      this.opts.onChange();
      void peer.receive(data);
      const early = this.early.get(from);
      this.early.delete(from);
      if (early && now - early.at < EARLY_CANDIDATES_TTL_MS) early.candidates.forEach((candidate) => void peer!.receive({ candidate }));
      return;
    }
    void peer.receive(data);
  };

  private onRefused = ({ to }: { to: string }) => {
    if (typeof to !== 'string' || !this.peers.has(to)) return;
    this.retryAt.set(to, performance.now() + CALL_RETRY_DELAY_MS);
    this.hangUp(to, false);
    this.opts.onChange();
  };
}
