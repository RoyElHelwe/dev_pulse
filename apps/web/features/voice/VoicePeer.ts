// Peer-to-peer WebRTC connection lifecycle and negotiation state handling.
// Owned by VoiceManager to maintain RTCPeerConnection instances, ICE negotiation, and remote tracks.

import { PeerAudio } from './VoiceAudio';

const CONNECTION_TIMEOUT_MS = 12_000;
/** A connected call that drops to "disconnected" often recovers by itself (Wi-Fi blip): wait this long. */
const DISCONNECTED_GRACE_MS = 8_000;
/** STUN only: enough on a LAN and most home networks (see docs/code/voice.md for TURN). */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** What travels through the server. `bye`: hung up. */
export type VoiceSignal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; bye?: true };

/** Manages WebRTC peer connection negotiation and associated spatial audio output for one remote peer. */
export class VoicePeer {
  /** Talking state last shown on the avatar (null = not shown yet). */
  shown: boolean | null = null;
  private readonly pc: RTCPeerConnection;
  private readonly audio: PeerAudio;
  private readonly createdAt = performance.now();
  /** Last time the connection was seen up (null: never connected yet). */
  private connectedAt: number | null = null;
  private makingOffer = false;
  private ignoreOffer = false;

  constructor(
    readonly id: string,
    /** The polite side gives way when both send an offer at once. */
    private readonly polite: boolean,
    ctx: AudioContext,
    out: AudioNode,
    mic: MediaStream,
    private readonly send: (data: VoiceSignal) => void,
  ) {
    this.audio = new PeerAudio(ctx, out);
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    for (const track of mic.getAudioTracks()) this.pc.addTrack(track, mic);

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) this.send({ description: this.pc.localDescription.toJSON() });
      } catch {
        // Peer connection closed concurrently during offer creation.
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.onicecandidate = ({ candidate }) => candidate && this.send({ candidate: candidate.toJSON() });
    this.pc.ontrack = ({ track, streams }) => this.audio.attach(streams[0] ?? new MediaStream([track]));
  }

  async receive({ description, candidate }: VoiceSignal): Promise<void> {
    try {
      if (description) {
        // Perfect negotiation glare resolution: polite peer backs down while impolite peer drops collided offer.
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
          // Safe to ignore candidates belonging to rejected offers or prematurely closed calls.
        });
      }
    } catch {
      // Negotiation failure leaves peer stuck, which the coordinator will drop and reconnect on subsequent ticks.
    }
  }

  /** Checks whether the peer connection failed or took too long to reach connected state. */
  stuck(now: number): boolean {
    const state = this.pc.connectionState;
    if (state === 'connected') {
      this.connectedAt = now;
      return false;
    }
    if (state === 'failed' || state === 'closed') return true;
    // Never came up, or lost for longer than a short network blip.
    if (this.connectedAt === null) return now - this.createdAt > CONNECTION_TIMEOUT_MS;
    return now - this.connectedAt > DISCONNECTED_GRACE_MS;
  }

  /** Sends another microphone track (the previous one was unplugged), without renegotiating. */
  replaceMic(track: MediaStreamTrack): void {
    for (const sender of this.pc.getSenders()) if (sender.track?.kind !== 'video') void sender.replaceTrack(track).catch(() => {});
  }

  place(at: { x: number; z: number }, gain: number): void {
    this.audio.place(at, gain);
  }

  talking(now: number): boolean {
    return this.audio.talking(now);
  }

  close(): void {
    this.pc.close();
    this.audio.close();
  }
}
