// Microphone and speaker choice for voice, remembered per browser.
// Device ids only mean something in this browser on this computer, so they live in localStorage, not the API.

const STORAGE_KEY = 'devpulse.voiceDevices';

/** A chosen device: its id, and its name to find it again if the browser renamed the id. */
export interface DeviceChoice {
  id: string;
  label: string;
}

/** The microphone and speakers picked in Settings → Voice (null: the system default). */
export interface VoiceDevices {
  input: DeviceChoice | null;
  output: DeviceChoice | null;
}

/** Same processing for calls and the mic test: what the others hear is what the test shows. */
const MIC_PROCESSING: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export function loadDevices(): VoiceDevices {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<VoiceDevices> | null;
    return { input: saved?.input ?? null, output: saved?.output ?? null };
  } catch {
    return { input: null, output: null };
  }
}

export function saveDevices(devices: VoiceDevices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // Private mode or storage disabled: the choice lasts for this page only.
  }
}

/** Microphones and speakers the browser knows about (names stay empty until mic access is allowed). */
export async function listDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  const all = (await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])) ?? [];
  // "default" / "communications" are aliases of real devices: the "System default" option covers them.
  const real = (d: MediaDeviceInfo) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications';
  return { inputs: all.filter((d) => d.kind === 'audioinput' && real(d)), outputs: all.filter((d) => d.kind === 'audiooutput' && real(d)) };
}

/** The chosen device's current id if it is plugged in (matched by id, else by name), or undefined. */
export function findDevice(choice: DeviceChoice | null, devices: MediaDeviceInfo[]): string | undefined {
  if (!choice) return undefined;
  return (devices.find((d) => d.deviceId === choice.id) ?? devices.find((d) => d.label && d.label === choice.label))?.deviceId;
}

/**
 * Opens the chosen microphone, or the system default when it is unplugged or refuses.
 * Throws the browser's error when no microphone can be opened at all.
 */
export async function openMicrophone(choice: DeviceChoice | null = loadDevices().input): Promise<MediaStream> {
  const id = findDevice(choice, (await listDevices()).inputs) ?? choice?.id;
  if (id) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { ...MIC_PROCESSING, deviceId: { exact: id } } });
    } catch (error) {
      // Permission refused: asking again for another device would be refused too.
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) throw error;
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: MIC_PROCESSING });
}

/** Chrome and Edge can send an AudioContext to a chosen output; other browsers use the system default. */
export function canPickOutput(): boolean {
  return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
}

/** Plays a context through the chosen speakers (no-op where unsupported or unplugged). */
export async function routeOutput(ctx: AudioContext, choice: DeviceChoice | null = loadDevices().output): Promise<void> {
  if (!canPickOutput()) return;
  const id = choice ? (findDevice(choice, (await listDevices()).outputs) ?? '') : '';
  // '' is the system default.
  await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(id).catch(() => {});
}

/** Why a microphone could not be opened, for messages. */
export type MicProblem = 'denied' | 'no-mic' | 'busy' | 'unsupported';

export function micProblem(error: unknown): MicProblem {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  // The device exists but cannot be opened: another app holds it, or the system blocks it.
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'no-mic';
}

/** Toast text for each problem. */
export const MIC_PROBLEM_TEXT: Record<MicProblem, string> = {
  denied: 'Microphone blocked. Allow it in your browser’s site settings to talk.',
  'no-mic': 'No microphone found. Plug one in and try again.',
  busy: 'Your microphone is in use by another app, or blocked by your system. Close that app and try again.',
  unsupported: 'Voice isn’t supported in this browser.',
};
