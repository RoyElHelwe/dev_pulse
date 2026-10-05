import type { Socket } from 'socket.io-client';
import type { OfficeController } from '@/game/createGame';
import type { OfficeLayout, RoomKind } from '@/game/layout/types';
import { roomFinder } from '@/game/systems/rooms';
import { voiceStates } from './store';

// Proximity voice: one peer-to-peer WebRTC audio call per person we can hear.
// Who we call comes from the game (same room, and close by or in a meeting room);
// the server relays the signaling only when it agrees (apps/api/src/voice).

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
/** Tiles. Call under NEAR, hang up past FAR (no flicker at the edge), answer up to ANSWER. */
const NEAR = 3;
const FAR = 3.5;
const ANSWER = 4;
const TICK_MS = 150;
/** A call that doesn't connect in time is dropped and tried again later. */
const CONNECT_TIMEOUT_MS = 12_000;
const RETRY_MS = 5_000;
/** RMS level above which someone is talking; the light stays on a moment after. */
const TALKING_LEVEL = 0.02;
const TALKING_HOLD_MS = 300;

/** Open space: full volume within a tile, silent at FAR. Meeting rooms: everyone clear. */
const FALLOFF_OPEN: Partial<PannerOptions> = { distanceModel: 'linear', refDistance: 1, maxDistance: FAR, rolloffFactor: 1 };
const FALLOFF_MEETING: Partial<PannerOptions> = { distanceModel: 'linear', refDistance: 2, maxDistance: 30, rolloffFactor: 0.4 };

/** What travels through the server. `bye`: hung up. */
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; bye?: true };

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

/** Plain-class voice engine; VoiceControls owns one per office connection. */
export class VoiceManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mic: MediaStream | null = null;
  private micLevel: Level | null = null;
  private peers = new Map<string, Peer>();
  private retryAt = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private roomAt: (x: number, y: number) => string | null = () => null;
  private kinds = new Map<string, RoomKind>();
  private muted = false;
  private deafened = false;
  private pushToTalk = false;
  private keyHeld = false;
  private destroyed = false;
  /** What we last told the game about our own avatar. */
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
    this.roomAt = roomFinder(layout);
    this.kinds = new Map(layout.rooms.map((r) => [r.id, r.kind]));
    // The game rebuilds the avatars: put the headsets back on next tick.
    this.me = { inCall: false, talking: false };
    this.peers.forEach((p) => (p.shown = null));
  }

  /**
   * Turns the mic on and starts calling people nearby. Call it from a click: the
   * AudioContext is created right away, inside the user gesture, so it can play.
   */
  async join(): Promise<'ok' | 'denied' | 'no-mic' | 'unsupported'> {
    if (this.ctx) return 'ok';
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') return 'unsupported';
    const ctx = new AudioContext();
    this.ctx = ctx;
    void ctx.resume().catch(() => {});
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      this.ctx = null;
      void ctx.close().catch(() => {});
      const name = err instanceof DOMException ? err.name : '';
      return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'no-mic';
    }
    if (this.destroyed || this.ctx !== ctx) {
      mic.getTracks().forEach((t) => t.stop());
      return 'ok';
    }
    this.mic = mic;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.micLevel = new Level(ctx, ctx.createMediaStreamSource(mic));
    this.applyMic();
    this.timer = setInterval(this.tick, TICK_MS);
    this.opts.onChange();
    return 'ok';
  }

  /** Hangs up everyone, turns the mic off. */
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

  /** Deafened: we hear nobody and our mic is off too; undeafen restores both. */
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

  /** The push-to-talk key is held down (or was released). */
  setKeyHeld(held: boolean) {
    if (this.keyHeld === held) return;
    this.keyHeld = held;
    this.applyMic();
  }

  // ---- internals ------------------------------------------------------------------

  private micOpen() {
    return !!this.mic && !this.muted && !this.deafened && (!this.pushToTalk || this.keyHeld);
  }

  private applyMic() {
    const open = this.micOpen();
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = open));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.deafened ? 0 : 1, this.ctx.currentTime, 0.02);
    this.sendState();
    this.opts.onChange();
  }

  private sendState() {
    if (this.mic && this.opts.socket.connected) {
      this.opts.socket.emit('voice:state', { muted: this.muted, deafened: this.deafened });
    }
  }

  /** Back online after a network drop: the server forgot our state. */
  private onConnect = () => this.sendState();

  /** Can we hear `id` from here? `radius` in tiles (meeting rooms: anyone inside). */
  private inEarshot(id: string, radius: number) {
    const snap = this.opts.controller()?.snapshot();
    const other = snap?.others.find((o) => o.id === id);
    if (!snap || !other) return false;
    const room = this.roomAt(snap.me.x, snap.me.y);
    if (this.roomAt(other.x, other.y) !== room) return false;
    return (room !== null && this.kinds.get(room) === 'meeting') || Math.hypot(other.x - snap.me.x, other.y - snap.me.y) < radius;
  }

  /** Every ~150 ms: who to call or hang up, where they are, who is talking. */
  private tick = () => {
    const snap = this.opts.controller()?.snapshot();
    if (!snap || !this.ctx) return;
    const now = performance.now();
    const myRoom = this.roomAt(snap.me.x, snap.me.y);
    const meeting = myRoom !== null && this.kinds.get(myRoom) === 'meeting';
    const before = this.peers.size;
    const seen = new Set<string>();

    for (const other of snap.others) {
      seen.add(other.id);
      const dx = other.x - snap.me.x;
      const dy = other.y - snap.me.y;
      let peer = this.peers.get(other.id);
      const want =
        voiceStates.has(other.id) &&
        this.roomAt(other.x, other.y) === myRoom &&
        (meeting || Math.hypot(dx, dy) < (peer ? FAR : NEAR));
      if (peer && (!want || peer.stuck(now))) {
        if (want) this.retryAt.set(other.id, now + RETRY_MS);
        this.hangUp(other.id);
        continue;
      }
      if (!peer && want && (this.retryAt.get(other.id) ?? 0) <= now) peer = this.call(other.id);
      peer?.place(dx, dy, meeting);
    }
    for (const id of [...this.peers.keys()]) if (!seen.has(id)) this.hangUp(id);

    // Headsets and talking lights (the game only hears about changes).
    for (const peer of this.peers.values()) {
      const talking = peer.talking(now);
      if (peer.shown !== talking) {
        peer.shown = talking;
        this.opts.controller()?.setVoice(peer.id, true, talking);
      }
    }
    this.showMe(this.peers.size > 0, this.micOpen() && !!this.micLevel?.talking(now));
    if (this.peers.size !== before) this.opts.onChange();
  };

  private showMe(inCall: boolean, talking: boolean) {
    if (this.me.inCall === inCall && this.me.talking === talking) return;
    this.me = { inCall, talking };
    this.opts.controller()?.setVoice(this.opts.myId, inCall, talking);
  }

  private call(id: string) {
    const peer = new Peer(id, this.opts.myId < id, this.ctx!, this.master!, this.mic!, (data) =>
      this.opts.socket.emit('rtc:signal', { to: id, data }),
    );
    this.peers.set(id, peer);
    return peer;
  }

  /** `tell`: let them know, so they hang up at once too. */
  private hangUp(id: string, tell = true) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (tell && this.opts.socket.connected) this.opts.socket.emit('rtc:signal', { to: id, data: { bye: true } });
    peer.close();
    this.peers.delete(id);
    this.opts.controller()?.setVoice(id, false, false);
  }

  private onSignal = ({ from, data }: { from: string; data: Signal }) => {
    if (!this.ctx || typeof from !== 'string' || !data || typeof data !== 'object') return;
    let peer = this.peers.get(from);
    if (data.bye) {
      if (peer) this.hangUp(from, false);
      this.opts.onChange();
      return;
    }
    if (!peer) {
      // Someone calls us: answer if we can hear them too.
      if (data.description?.type !== 'offer' || !voiceStates.has(from) || !this.inEarshot(from, ANSWER)) return;
      peer = this.call(from);
      this.opts.onChange();
    }
    void peer.receive(data);
  };

  /** The server says we may not talk to them (booked meeting, too far by its clock). */
  private onRefused = ({ to }: { to: string }) => {
    if (typeof to !== 'string' || !this.peers.has(to)) return;
    this.retryAt.set(to, performance.now() + RETRY_MS);
    this.hangUp(to, false);
    this.opts.onChange();
  };
}

/** One call: the RTCPeerConnection (perfect negotiation) and the sound we hear from it. */
class Peer {
  /** Talking state last shown on the avatar (null = not shown yet). */
  shown: boolean | null = null;
  private readonly pc: RTCPeerConnection;
  private readonly createdAt = performance.now();
  private readonly panner: PannerNode;
  private makingOffer = false;
  private ignoreOffer = false;
  private meeting: boolean | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private level: Level | null = null;

  constructor(
    readonly id: string,
    /** The polite side gives way when both send an offer at once. */
    private readonly polite: boolean,
    private readonly ctx: AudioContext,
    out: AudioNode,
    mic: MediaStream,
    private readonly send: (data: Signal) => void,
  ) {
    // Listener stays at the origin facing "up the screen" (the default: forward = -z).
    this.panner = new PannerNode(ctx, { panningModel: 'HRTF', ...FALLOFF_OPEN });
    this.panner.connect(out);

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    for (const track of mic.getAudioTracks()) this.pc.addTrack(track, mic);
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) this.send({ description: this.pc.localDescription.toJSON() });
      } catch {
        // Closed meanwhile.
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.onicecandidate = ({ candidate }) => candidate && this.send({ candidate: candidate.toJSON() });
    this.pc.ontrack = ({ track, streams }) => this.listen(streams[0] ?? new MediaStream([track]));
  }

  async receive({ description, candidate }: Signal) {
    try {
      if (description) {
        const collision = description.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;
        await this.pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await this.pc.setLocalDescription();
          if (this.pc.localDescription) this.send({ description: this.pc.localDescription.toJSON() });
        }
      } else if (candidate) {
        await this.pc.addIceCandidate(candidate).catch(() => {
          // Candidates of an offer we ignored, or a closed call: expected.
        });
      }
    } catch {
      // A broken or closed call: the tick drops it and calls again.
    }
  }

  /** Not connected after a while, or the connection failed. */
  stuck(now: number) {
    const state = this.pc.connectionState;
    return state === 'failed' || state === 'closed' || (state !== 'connected' && now - this.createdAt > CONNECT_TIMEOUT_MS);
  }

  /** Where they stand relative to us, in tiles (screen x → x, screen y → z). */
  place(dx: number, dy: number, meeting: boolean) {
    const t = this.ctx.currentTime;
    this.panner.positionX.setTargetAtTime(dx, t, 0.05);
    this.panner.positionZ.setTargetAtTime(dy, t, 0.05);
    if (meeting !== this.meeting) {
      this.meeting = meeting;
      const falloff = meeting ? FALLOFF_MEETING : FALLOFF_OPEN;
      this.panner.refDistance = falloff.refDistance!;
      this.panner.maxDistance = falloff.maxDistance!;
      this.panner.rolloffFactor = falloff.rolloffFactor!;
    }
  }

  talking(now: number) {
    return !!this.level?.talking(now);
  }

  close() {
    this.pc.close();
    this.source?.disconnect();
    this.level?.disconnect();
    this.panner.disconnect();
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
  }

  private listen(stream: MediaStream) {
    if (this.source) return;
    // Chrome only feeds a remote WebRTC stream to Web Audio while a media element
    // plays it too; the element stays muted, the sound goes through the panner.
    this.audio = new Audio();
    this.audio.muted = true;
    this.audio.srcObject = stream;
    void this.audio.play().catch(() => {});
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.panner);
    this.level = new Level(this.ctx, this.source);
  }
}

/** Is a stream loud enough to count as talking? (AnalyserNode RMS.) */
class Level {
  private readonly analyser: AnalyserNode;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private loudAt = -Infinity;

  constructor(ctx: AudioContext, source: AudioNode) {
    this.analyser = new AnalyserNode(ctx, { fftSize: 512 });
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
  }

  talking(now: number) {
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (const v of this.buffer) sum += v * v;
    if (Math.sqrt(sum / this.buffer.length) > TALKING_LEVEL) this.loudAt = now;
    return now - this.loudAt < TALKING_HOLD_MS;
  }

  disconnect() {
    this.analyser.disconnect();
  }
}
