'use client';

// Settings → Voice: pick the microphone and speakers, test the mic on a live level meter, test the speakers.
// Choices are stored in this browser (devices.ts) and used the next time voice is joined in the office.

import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import {
  canPickOutput,
  type DeviceChoice,
  findDevice,
  listDevices,
  loadDevices,
  MIC_PROBLEM_TEXT,
  micProblem,
  openMicrophone,
  routeOutput,
  saveDevices,
  type VoiceDevices,
} from './devices';
import { TALKING_RMS_THRESHOLD, VoiceLevel } from './VoiceAudio';

/** The meter shows -60 dB (silence) to 0 dB (clipping), like most audio apps. */
const METER_FLOOR_DB = -60;
const TEST_TONE_SECONDS = 0.9;

interface MicTest {
  ctx: AudioContext;
  mic: MediaStream;
  meter: VoiceLevel;
  /** Plays the mic back to the speakers ("hear yourself"). */
  monitor: GainNode;
  frame: number;
}

/** Position of a loudness (RMS) on the meter, 0..1. */
const meterOf = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(rms, 1e-6)) - METER_FLOOR_DB) / -METER_FLOOR_DB));

/** Microphone / speaker pickers with a microphone test and a speaker test sound. */
export function AudioDevices() {
  const [devices, setDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] });
  const [choice, setChoice] = useState<VoiceDevices>({ input: null, output: null });
  const [outputSupported, setOutputSupported] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [hearSelf, setHearSelf] = useState(false);
  const [error, setError] = useState('');
  const test = useRef<MicTest | null>(null);

  const refresh = useCallback(async () => setDevices(await listDevices()), []);

  // Browser-only state (localStorage, devices) is read after mount, so the server render matches.
  useEffect(() => {
    setChoice(loadDevices());
    setOutputSupported(canPickOutput());
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);

  const stopTest = useCallback(() => {
    const t = test.current;
    test.current = null;
    if (!t) return;
    cancelAnimationFrame(t.frame);
    t.mic.getTracks().forEach((track) => track.stop());
    void t.ctx.close().catch(() => {});
    setTesting(null);
    setLevel(0);
  }, []);
  useEffect(() => stopTest, [stopTest]);

  const startTest = useCallback(
    async (devicesToUse: VoiceDevices, monitorOn: boolean) => {
      stopTest();
      setError('');
      let mic: MediaStream;
      try {
        mic = await openMicrophone(devicesToUse.input);
      } catch (err) {
        return setError(MIC_PROBLEM_TEXT[micProblem(err)]);
      }
      const ctx = new AudioContext();
      await routeOutput(ctx, devicesToUse.output);
      void ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(mic);
      const meter = new VoiceLevel(ctx, source);
      const monitor = new GainNode(ctx, { gain: monitorOn ? 1 : 0 });
      source.connect(monitor).connect(ctx.destination);
      const t: MicTest = { ctx, mic, meter, monitor, frame: 0 };
      const draw = () => {
        setLevel(meter.level());
        t.frame = requestAnimationFrame(draw);
      };
      t.frame = requestAnimationFrame(draw);
      test.current = t;
      setTesting(mic.getAudioTracks()[0]?.label || 'your microphone');
      // Device names are only visible once the microphone is allowed.
      void refresh();
    },
    [refresh, stopTest],
  );

  const choose = (kind: 'input' | 'output', id: string) => {
    const list = kind === 'input' ? devices.inputs : devices.outputs;
    const device = list.find((d) => d.deviceId === id);
    const picked: DeviceChoice | null = device ? { id: device.deviceId, label: device.label } : null;
    const next = { ...choice, [kind]: picked };
    setChoice(next);
    saveDevices(next);
    if (test.current) void startTest(next, hearSelf);
  };

  const toggleHearSelf = (on: boolean) => {
    setHearSelf(on);
    const t = test.current;
    if (t) t.monitor.gain.setTargetAtTime(on ? 1 : 0, t.ctx.currentTime, 0.02);
  };

  /** A short two-note chime on the chosen speakers. */
  const playSound = async () => {
    const ctx = new AudioContext();
    await routeOutput(ctx, choice.output);
    void ctx.resume().catch(() => {});
    const start = ctx.currentTime + 0.05;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = new OscillatorNode(ctx, { type: 'sine', frequency: freq });
      const gain = new GainNode(ctx, { gain: 0 });
      const at = start + i * 0.25;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.62);
    }
    setTimeout(() => void ctx.close().catch(() => {}), (TEST_TONE_SECONDS + 0.3) * 1000);
  };

  const named = devices.inputs.some((d) => d.label);
  const inputId = findDevice(choice.input, devices.inputs) ?? '';
  const outputId = findDevice(choice.output, devices.outputs) ?? '';
  const loud = level > TALKING_RMS_THRESHOLD;

  return (
    <Card title="Microphone and speakers" description="Saved in this browser. Used the next time you join voice in the office.">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Microphone" value={inputId} onChange={(e) => choose('input', e.target.value)}>
            <option value="">System default</option>
            {devices.inputs.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </Select>
          {outputSupported ? (
            <Select label="Speakers" value={outputId} onChange={(e) => choose('output', e.target.value)}>
              <option value="">System default</option>
              {devices.outputs.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speakers ${i + 1}`}
                </option>
              ))}
            </Select>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-800">Speakers</span>
              <p className="text-sm text-zinc-500">This browser plays voice through your system’s default speakers. Change them in your system’s sound settings.</p>
            </div>
          )}
        </div>
        {!named && <p className="text-sm text-zinc-500">Device names appear once you allow the microphone: start a test.</p>}

        <div className="flex flex-wrap gap-2">
          {testing ? (
            <Button variant="secondary" onClick={stopTest}>
              <MicOff className="size-4" /> Stop test
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => void startTest(choice, hearSelf)}>
              <Mic className="size-4" /> Test microphone
            </Button>
          )}
          <Button variant="secondary" onClick={() => void playSound()}>
            <Volume2 className="size-4" /> Play test sound
          </Button>
        </div>

        {testing && (
          <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/80">
            <p className="text-sm text-zinc-700">
              Testing <b className="font-semibold">{testing}</b>. Speak normally: the bar should pass the mark.
            </p>
            <div
              role="meter"
              aria-label="Microphone level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(meterOf(level) * 100)}
              className="relative h-3 overflow-hidden rounded-full bg-zinc-200"
            >
              <div className={cn('h-full rounded-full transition-[width] duration-75', loud ? 'bg-emerald-500' : 'bg-zinc-400')} style={{ width: `${meterOf(level) * 100}%` }} />
              <div className="absolute inset-y-0 w-0.5 bg-zinc-700/60" style={{ left: `${meterOf(TALKING_RMS_THRESHOLD) * 100}%` }} title="Others see you talking above this mark" />
            </div>
            <p className={cn('text-xs', loud ? 'text-emerald-700' : 'text-zinc-500')}>{loud ? 'Others hear you talking.' : 'Quiet: nobody hears anything right now.'}</p>
            <Checkbox label="Hear yourself (use headphones, or you will hear an echo)" checked={hearSelf} onChange={(e) => toggleHearSelf(e.target.checked)} />
          </div>
        )}

        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Card>
  );
}
