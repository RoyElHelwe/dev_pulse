// Web Audio spatial graph and voice activity level metering.
// Owned by VoicePeer and VoiceManager to manage spatial positioning, gain attenuation, and RMS speech detection.

import { type MicProblem, micProblem, openMicrophone, routeOutput } from './devices';
import { meetingGain, openGain } from './spatial';

const ANALYSER_FFT_SIZE = 512;
/** Loudness above which someone counts as talking (shown on the mic test meter too). */
export const TALKING_RMS_THRESHOLD = 0.02;
const TALKING_HOLD_DURATION_MS = 300;
const PANNER_REF_DISTANCE_TILES = 1;
const PANNER_MAX_DISTANCE_TILES = 10_000;
const PANNER_ROLLOFF_FACTOR = 0;
const AUDIO_PARAM_RAMP_SMOOTH_SEC = 0.08;

const PANNER_OPTIONS: PannerOptions = {
  panningModel: 'HRTF',
  distanceModel: 'linear',
  refDistance: PANNER_REF_DISTANCE_TILES,
  maxDistance: PANNER_MAX_DISTANCE_TILES,
  rolloffFactor: PANNER_ROLLOFF_FACTOR,
};

/** Computes spatial gain based on distance, room span, and open-space cutoff radius. */
export function calculateSpatialGain(distance: number, span: number, edge: number): number {
  return span > 0 ? meetingGain(distance, span) : openGain(distance, edge);
}

/**
 * Initialises an AudioContext on the chosen speakers and opens the chosen microphone
 * (Settings → Voice), falling back to the system defaults.
 */
export async function setupUserAudio(): Promise<{ ok: true; ctx: AudioContext; mic: MediaStream } | { ok: false; status: MicProblem }> {
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    return { ok: false, status: 'unsupported' };
  }
  const ctx = new AudioContext();
  void ctx.resume().catch(() => {});
  try {
    const mic = await openMicrophone();
    await routeOutput(ctx);
    return { ok: true, ctx, mic };
  } catch (err) {
    void ctx.close().catch(() => {});
    return { ok: false, status: micProblem(err) };
  }
}

/** Measures an AudioNode's RMS volume level to detect active speech. */
export class VoiceLevel {
  private readonly analyser: AnalyserNode;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private loudAt = -Infinity;

  constructor(ctx: AudioContext, source: AudioNode) {
    this.analyser = new AnalyserNode(ctx, { fftSize: ANALYSER_FFT_SIZE });
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
  }

  talking(now: number): boolean {
    if (this.level() > TALKING_RMS_THRESHOLD) this.loudAt = now;
    return now - this.loudAt < TALKING_HOLD_DURATION_MS;
  }

  /** Current loudness (RMS of the waveform, 0 silent … ~0.5 very loud), for level meters. */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (const v of this.buffer) sum += v * v;
    return Math.sqrt(sum / this.buffer.length);
  }

  disconnect(): void {
    this.analyser.disconnect();
  }
}

/** Web Audio node graph for an individual peer, controlling spatial panning and distance gain. */
export class PeerAudio {
  private readonly panner: PannerNode;
  private readonly volume: GainNode;
  private audio: HTMLAudioElement | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private level: VoiceLevel | null = null;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
  ) {
    // Rolloff is 0 because custom distance falloff curves are handled via GainNode; panner handles HRTF direction only.
    this.panner = new PannerNode(ctx, PANNER_OPTIONS);
    this.volume = new GainNode(ctx, { gain: 0 });
    this.panner.connect(this.volume);
    this.volume.connect(destination);
  }

  attach(stream: MediaStream): void {
    if (this.source) return;
    // Chromium bug workaround: remote WebRTC audio streams only decode into Web Audio when played via an audio element.
    this.audio = new Audio();
    this.audio.muted = true;
    this.audio.srcObject = stream;
    void this.audio.play().catch(() => {});
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.panner);
    this.level = new VoiceLevel(this.ctx, this.source);
  }

  place(at: { x: number; z: number }, gain: number): void {
    const t = this.ctx.currentTime;
    this.panner.positionX.setTargetAtTime(at.x, t, AUDIO_PARAM_RAMP_SMOOTH_SEC);
    this.panner.positionZ.setTargetAtTime(at.z, t, AUDIO_PARAM_RAMP_SMOOTH_SEC);
    this.volume.gain.setTargetAtTime(gain, t, AUDIO_PARAM_RAMP_SMOOTH_SEC);
  }

  talking(now: number): boolean {
    return !!this.level?.talking(now);
  }

  close(): void {
    this.source?.disconnect();
    this.level?.disconnect();
    this.panner.disconnect();
    this.volume.disconnect();
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
  }
}
