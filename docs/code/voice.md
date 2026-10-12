# Spatial Voice Architecture (`features/voice`)

## Purpose

The voice subsystem provides real-time, proximity-based spatial audio communication within the virtual office. It uses peer-to-peer WebRTC audio streams orchestrated through the server's `/office` WebSocket gateway, combined with the Web Audio API for 3D HRTF panning, realistic distance-based cosine falloff, acoustic wall partitioning, confidential meeting room audio isolation, RMS speech detection, and push-to-talk hotkey controls.

For details on the WebSocket wire events exchanged during voice sessions, see **[docs/code/office-protocol.md](office-protocol.md)**.

---

## Where it lives

### Backend (`apps/api/src/voice/`)

| File | One-line job |
| --- | --- |
| `apps/api/src/voice/voice.module.ts` | NestJS module registering `VoiceGateway`, `MeetingsService`, and office dependencies. |
| `apps/api/src/voice/voice.gateway.ts` | WebRTC signalling gateway on `/office` routing offers/answers/ICE candidates and tracking voice participation. |
| `apps/api/src/voice/voice.rules.ts` | Pure proximity distance calculations (`withinEarshot`) and meeting room booking authorization checks (`bookingAllows`). |
| `apps/api/src/voice/voice.rules.spec.ts` | Unit tests for proximity distance limits, room isolation, and confidential meeting reservations. |

### Frontend (`apps/web/features/voice/`)

| File | One-line job |
| --- | --- |
| `apps/web/features/voice/VoiceManager.ts` | Central client engine managing the AudioContext, microphone stream, peer connection lifecycle, and 150 ms proximity tick loop. |
| `apps/web/features/voice/VoicePeer.ts` | Encapsulates an individual `RTCPeerConnection` instance with polite/impolite glare handling and associated Web Audio output. |
| `apps/web/features/voice/VoiceAudio.ts` | Web Audio graph builder managing HRTF `PannerNode`, distance `GainNode`, microphone acquisition, and RMS voice level metering (`VoiceLevel`). |
| `apps/web/features/voice/spatial.ts` | Pure mathematical calculations for distance attenuation (cosine open falloff, meeting room curves) and listener-relative direction vectors. |
| `apps/web/features/voice/voiceStore.ts` | Reactive module store (`useSyncExternalStore`) caching office-wide voice presence, mute, and deafen states. |
| `apps/web/features/voice/settings.ts` | Voice preference types (`OPEN` vs `PUSH_TO_TALK`), defaults, and keyboard code formatters. |
| `apps/web/features/voice/VoiceControls.tsx` | Bottom HUD control bar rendering microphone status, mute/deafen buttons, peer indicators, and hotkey listeners. |
| `apps/web/features/voice/devices.ts` | Microphone / speaker choice per browser (`localStorage`), opening the chosen mic with fallback, output routing (`setSinkId`), and mic error messages. |
| `apps/web/features/voice/AudioDevices.tsx` | Settings card: device pickers, live mic test with level meter and "hear yourself", speaker test sound. |
| `apps/web/features/voice/VoiceSettings.tsx` | User preferences view for configuring transmission mode and push-to-talk hotkey rebinding. |

---

## How it works

### WebRTC Signalling Flow

Dev Pulse implements a decentralized peer-to-peer mesh for audio exchange. Media streams flow directly between client browsers, while signalling messages (SDP session descriptions and ICE candidates) are relayed by `VoiceGateway` over the existing `/office` Socket.IO connection.

```
Peer A (Calling)                    NestJS API (/office Gateway)                 Peer B (Receiving)
   │                                             │                                       │
   │── [tick detects Peer B in earshot]          │                                       │
   │── Checks caller rule: A.id < B.id           │                                       │
   │── VoicePeer created (polite = false)        │                                       │
   │                                             │                                       │
   │── onnegotiationneeded:                      │                                       │
   │   setLocalDescription(offer)                │                                       │
   │── emit('rtc:signal', { to: B, data: offer })►│                                       │
   │                                             │── Validates rate budget (50/s)        │
   │                                             │── Validates size (<= 16 KB)           │
   │                                             │── Checks withinEarshot(A, B)          │
   │                                             │── Checks bookingAllows(room, A, B)    │
   │                                             │                                       │
   │                                             │── emit('rtc:signal', { from: A, ... })►│
   │                                             │                                       │
   │                                             │                       [Buffers early ICE if needed]
   │                                             │                       VoicePeer created (polite = true)
   │                                             │                       setRemoteDescription(offer)
   │                                             │                       setLocalDescription(answer)
   │                                             │◄── emit('rtc:signal', { to: A, ... })──│
   │                                             │    (answer)                           │
   │◄── emit('rtc:signal', { from: B, ... })─────│                                       │
   │    (answer)                                 │                                       │
   │── setRemoteDescription(answer)              │                                       │
   │                                             │                                       │
   │── onicecandidate: candidate A               │                                       │
   │── emit('rtc:signal', { to: B, cand A })────►│── emit('rtc:signal', { from: A, ... })►│
   │                                             │── addIceCandidate(cand A)             │
   │                                             │                                       │
   │◄── P2P DTLS Handshake & SRTP Media Stream (WebRTC Direct UDP) ──────────────────────►│
   │    [Audio flows directly peer-to-peer without passing through the API server]       │
```

### Signalling Rejection (`rtc:refused`)
If Peer A attempts to signal Peer B but the server determines they are out of audible range (`withinEarshot === false`) or separated by a confidential meeting room reservation, `VoiceGateway` emits `rtc:refused` (`{ to: B }`) back to Peer A. Peer A immediately hangs up the pending peer connection and applies a 5-second backoff (`CALL_RETRY_DELAY_MS = 5_000`) before retrying.

### Perfect Negotiation Glare Resolution

When two peers walk towards each other simultaneously, both could theoretically initiate a call. Dev Pulse resolves offer collision ("glare") using the W3C Perfect Negotiation pattern in `VoicePeer.ts`:
- **Role Assignment**: Evaluated deterministically: `polite = myId < otherId`.
- **Glare Detection**: Occurs when an incoming offer arrives while `makingOffer === true` or `signalingState !== 'stable'`.
- **Resolution**:
  - The **impolite peer** (`polite === false`) ignores the collision offer (`this.ignoreOffer = true`) and proceeds with its own offer.
  - The **polite peer** (`polite === true`) yields, accepts the incoming offer, rolls back if necessary, and generates an answer.

### Connection Lifecycle & Proximity Tick Loop

`VoiceManager.ts` runs a periodic evaluation loop every 150 ms (`TICK_INTERVAL_MS = 150`):
1. **Snapshot Query**: Retrieves avatar positions, rooms, and facings from Phaser `OfficeController.snapshot()`.
2. **Caller Coordination**: To prevent redundant simultaneous calls, only the client with the lexicographically smaller user ID (`myId < other.id`) initiates dialing when entering range.
3. **Connection Hysteresis**:
   - **Dial Threshold**: A new call is initiated only when the distance is strictly within `NEAR` (3 tiles = 96 px).
   - **Hold Threshold**: Once established, the call is maintained up to `ANSWER_RADIUS_TILES` (4 tiles = 128 px).
   - This 1-tile hysteresis gap prevents rapid connection churn and audio stutter when players linger near the boundary.
4. **Spatial Placement**: Computes relative coordinate offsets rotated to avatar facing, determines gain attenuation, and updates `VoicePeer.place(relativeVector, gain)`.
5. **Speech Metering**: Checks active voice levels and instructs the game controller to display speech bubble indicators (`OfficeController.setVoice(id, inCall, talking)`).

---

## Rules & invariants

### 1. The Talk Rule (`voice.rules.ts`)

Two avatars may exchange audio if and only if `withinEarshot(a, b)` and `bookingAllows(booking, a, b)` evaluate to `true`:

```ts
export function withinEarshot(a: Spot | null, b: Spot | null): boolean {
  if (!a || !b) return false;
  if ((a.room?.id ?? null) !== (b.room?.id ?? null)) return false;
  if (a.room?.kind === 'meeting') return true;
  return Math.hypot(a.x - b.x, a.y - b.y) <= EARSHOT_PX;
}
```

- **Room Wall Partitioning**: If `a.room?.id !== b.room?.id`, audio is strictly blocked (`false`), even if avatars stand in adjacent tiles on opposite sides of a wall.
- **Meeting Room Override**: Within any room where `room.kind === 'meeting'`, physical distance is disregarded (`true`). All seated participants hear each other clearly across the entire room.
- **Open Floor Distance**: Outside meeting rooms, distance is calculated via Euclidean hypotenuse:
  - `SERVER_EARSHOT_TILES = 4` tiles.
  - Grid cell size: `TILE = 32` pixels.
  - Audible range threshold: `EARSHOT_PX = SERVER_EARSHOT_TILES * TILE = 128` pixels.

### 2. Meeting Room Confidentiality (`bookingAllows`)

```ts
export function bookingAllows(booking: { attendeeIds: string[] } | null, a: string, b: string): boolean {
  return !booking || (booking.attendeeIds.includes(a) && booking.attendeeIds.includes(b));
}
```

- **Unbooked Rooms**: Anyone in the room may converse freely (`booking === null`).
- **Active Bookings**: Only users included in `booking.attendeeIds` can exchange signalling. Uninvited members walking into the room cannot hear or speak to meeting participants.
- **Fail-Safe Privacy**: If the meetings database query throws an error, `mayTalk` defaults to `{ attendeeIds: [] }` (failing closed).

### 3. Server Signalling Rate & Payload Limits

- **Flood Protection**: Each socket is guarded by a token bucket `Budget` allowing a maximum of 50 signalling messages per second (`MAX_SIGNALS_PER_SECOND = 50`).
- **Payload Bound**: Signalling payloads exceeding 16 KB (`MAX_SIGNAL_BYTES = 16_000`) are dropped without inspection to mitigate denial-of-service attempts.
- **Single-Tab Voice Targeting**: Signalling is delivered strictly to the specific browser tab registered in voice (`socketId`). Relaying WebRTC messages across multiple tabs of the same user corrupts RTCPeerConnection internal state machines.

---

## Spatial audio math

Spatial audio processing executes client-side via the Web Audio API in `apps/web/features/voice/spatial.ts` and `VoiceAudio.ts`.

### 1. Distance Attenuation Curves

#### Open Space: Cosine Falloff Curve
In open office areas, volume stays at full level within 1 tile, then decays to zero at the edge using a raised cosine curve:

$$\text{gain} = 0.5 \times (1 + \cos(\pi \times t))$$

$$\text{where } t = \text{clamp}_{0,1}\left(\frac{\text{distance} - \text{CLOSE\_RADIUS\_TILES}}{\text{edge} - \text{CLOSE\_RADIUS\_TILES}}\right)$$

- `CLOSE_RADIUS_TILES = 1` tile (full volume radius).
- `edge = ANSWER_RADIUS_TILES = 4` tiles (cutoff threshold).
- **Unit**: `distance` and `edge` in map tiles (1 tile = 32 px). Output `gain` in normalized amplitude $[0.0, 1.0]$.
- **Acoustic Rationale**: Raised cosine guarantees both zero slope at full volume and zero slope at cutoff, eliminating harsh audio pops or clipping as players walk into range.

#### Meeting Room: Power Falloff with Volume Floor
Inside meeting rooms, distance attenuation is gentle and enforces a minimum floor so all participants remain audible across large conference tables:

$$\text{gain} = \text{FLOOR} + (1 - \text{FLOOR}) \times (1 - t)^{\text{EXPONENT}}$$

$$\text{where } t = \text{clamp}_{0,1}\left(\frac{\text{distance} - \text{MEETING\_CLOSE\_RADIUS\_TILES}}{\max(1, \text{span} - \text{MEETING\_CLOSE\_RADIUS\_TILES})}\right)$$

- `MEETING_VOLUME_FLOOR = 0.3` (normalized gain floor: minimum 30% volume).
- `MEETING_CLOSE_RADIUS_TILES = 1.5` tiles.
- `MEETING_DISTANCE_EXPONENT = 1.5` (decay curvature).
- `span = Math.max(room.width, room.height)` tiles.

### 2. Listener-Relative Orientation (`relativeTo`)

The Web Audio API listener frame assumes the listener looks down the $-Z$ axis with $+X$ pointing to the right and $+Y$ pointing up. In the 2D top-down game view, screen $X$ increases to the right and screen $Y$ increases downward.

`relativeTo(dx, dy, dir)` rotates the delta vector $(\Delta x, \Delta y)$ by the player avatar's facing direction:

| Avatar Facing | Calculation | Web Audio Panner Output |
| --- | --- | --- |
| `'up'` | `{ x: dx, z: dy }` | Sound ahead is $-Z$, sound behind is $+Z$ |
| `'down'` | `{ x: -dx, z: -dy }` | Inverts both axes |
| `'left'` | `{ x: -dy, z: dx }` | 90° clockwise rotation |
| `'right'` | `{ x: dy, z: -dx }` | 90° counter-clockwise rotation |

### 3. Web Audio Graph Configuration

```
Remote MediaStream ──► <audio> element (Chromium fix)
       │
       └──► MediaStreamAudioSourceNode ──► PannerNode (HRTF) ──► GainNode (Volume) ──► Master Gain ──► Destination
                     │
                     └──► AnalyserNode (VoiceLevel RMS Meter)
```

- **Panner Node Settings**:
  - `panningModel: 'HRTF'` (convolves sound using head-related impulse response filters).
  - `distanceModel: 'linear'`, `refDistance: 1`, `maxDistance: 10_000`, `rolloffFactor: 0`.
  - Setting `rolloffFactor: 0` disables Web Audio's default distance attenuation, allowing custom mathematical curves (`openGain`, `meetingGain`) to modulate `GainNode.gain` directly.
- **Ramping & Smoothing**:
  - Audio parameter adjustments use exponential smoothing to prevent zipper noise:
    `panner.positionX.setTargetAtTime(x, t, AUDIO_PARAM_RAMP_SMOOTH_SEC)`
    where `AUDIO_PARAM_RAMP_SMOOTH_SEC = 0.08` seconds.
  - Master mute/deafen transitions use:
    `master.gain.setTargetAtTime(target, t, MASTER_GAIN_RAMP_SMOOTH_SEC)`
    where `MASTER_GAIN_RAMP_SMOOTH_SEC = 0.02` seconds.
- **Active Speech Detection (`VoiceLevel`)**:
  - Attached to microphone input and each peer's incoming audio node.
  - `AnalyserNode` configured with `ANALYSER_FFT_SIZE = 512`.
  - Calculates Root Mean Square (RMS):
    $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{i=1}^{N} v_i^2}$$
  - Triggers active speaking when $\text{RMS} > \text{TALKING\_RMS\_THRESHOLD} = 0.02$.
  - Holds active state for `TALKING_HOLD_DURATION_MS = 300` ms to smooth natural pauses between words.

---

## Controls, devices, and audio handling

### Microphone & Transmission Modes
Configured via `apps/web/features/voice/settings.ts` and persisted via `GET / PATCH /api/settings`:
- **Open Mic (`OPEN`)**: Audio transmits continuously whenever the microphone is unmuted.
- **Push to Talk (`PUSH_TO_TALK`)**: The microphone track remains disabled (`track.enabled = false`) until the bound key (default `'KeyV'`, rebindable in settings) is actively depressed.
- **Typing Guard**: When typing in input fields, textareas, or rich editors (`isTyping()`), global push-to-talk hotkeys are ignored so text entry is not interrupted.

### Mute, Deafen, and Headset Behavior
- **Mute**: Disables local microphone tracks (`track.enabled = false`). Emits `voice:state` (`{ muted: true, deafened }`) to update peer badges office-wide.
- **Deafen**: Disables local microphone tracks AND ramps master output gain to 0 (`master.gain.setTargetAtTime(0, ...)`). Emits `voice:state` (`{ muted: true, deafened: true }`).
- **Headset Semantics**: Pressing the mute toggle while deafened immediately un-deafens the user rather than leaving them in a silent state, matching standard VoIP headset ergonomics.

### Microphone, speakers, and the mic test (`devices.ts`, `AudioDevices.tsx`)
**Settings → Voice** has a "Microphone and speakers" card: pick the microphone and (Chrome / Edge, through `AudioContext.setSinkId`) the speakers, run a live mic test with a level meter (the mark is `TALKING_RMS_THRESHOLD`, where others see you talking) and an optional "hear yourself" loopback, and play a test sound on the chosen speakers.
- Choices are stored in `localStorage` (`devpulse.voiceDevices`), not the API: device ids only mean something in one browser on one computer. A saved device is found again by id, else by name (browsers rotate ids when site data is cleared).
- `openMicrophone()` opens the chosen microphone with `deviceId: { exact }`, and falls back to the system default when it is unplugged or refuses. Calls and the mic test use the same processing, so the test shows what others hear:
```ts
{ echoCancellation: true, noiseSuppression: true, autoGainControl: true, deviceId: { exact: id } }
```
- `setupUserAudio()` routes the call's `AudioContext` to the chosen speakers (`routeOutput`). Firefox and Safari keep the system default (the card says so).

### Chromium Web Audio Bug Workaround
In Chromium-based browsers, WebRTC remote `MediaStream` tracks attached to a Web Audio `MediaStreamAudioSourceNode` can remain silent unless bound to an active DOM media element. `PeerAudio.attach()` creates a hidden, muted `HTMLAudioElement`:
```ts
this.audio = new Audio();
this.audio.muted = true;
this.audio.srcObject = stream;
void this.audio.play().catch(() => {});
```
This primes the audio pipeline without generating double-audio echoes.

---

## Failure modes & recovery

| Failure Mode | Trigger / Condition | Handling & Recovery |
| --- | --- | --- |
| **Microphone Permission Denied** | User blocks permission prompt; `DOMException.name === 'NotAllowedError'` or `'SecurityError'`. | `setupUserAudio()` returns `{ ok: false, status: 'denied' }`. UI surfaces toast: *"Microphone blocked. Allow it in your browser’s site settings to talk."* |
| **No Microphone Device** | No audio capture hardware detected; `DOMException.name === 'NotFoundError'`. | `setupUserAudio()` returns `{ ok: false, status: 'no-mic' }`. UI surfaces toast: *"No microphone found. Plug one in and try again."* |
| **Microphone Busy** | The device exists but cannot be opened (another app holds it, OS privacy block); `NotReadableError` / `AbortError`. | `{ ok: false, status: 'busy' }`. Toast: *"Your microphone is in use by another app, or blocked by your system…"* |
| **Microphone Unplugged Mid-Call** | The mic track fires `ended`. | `VoiceManager.recoverMic()` opens another microphone and swaps it into every call with `RTCRtpSender.replaceTrack` (no renegotiation, no hang-up), with a toast naming the new device. No microphone left: leaves voice with a toast. |
| **Audio Suspended by the Browser** | `AudioContext` goes `suspended` / `interrupted` (device taken, iOS interruption). | `onstatechange` resumes it at once, or on the next click / key press when the browser wants a gesture. |
| **Unsupported Browser** | Missing `navigator.mediaDevices.getUserMedia` or `RTCPeerConnection`. | Returns `{ ok: false, status: 'unsupported' }`. UI surfaces toast: *"Voice isn’t supported in this browser."* |
| **Early ICE Candidates** | Remote ICE candidates arrive over WebSocket before the SDP offer description. | `VoiceManager` buffers candidates in `early` map (`EARLY_CANDIDATES_TTL_MS = 2_000` ms). Flushes buffered candidates immediately after `setRemoteDescription` completes. |
| **Stuck / Dropped Peer Connection** | Handshake never completes within `CONNECTION_TIMEOUT_MS = 12_000` ms, a connected call stays `disconnected` longer than `DISCONNECTED_GRACE_MS = 8_000` ms (shorter Wi-Fi blips recover on their own), or `connectionState === 'failed' \| 'closed'`. | `peer.stuck(now)` evaluates to `true`. Manager invokes `hangUp(id)`, schedules retry backoff (`CALL_RETRY_DELAY_MS = 5_000` ms), and recreates the peer on subsequent ticks. |
| **Signalling Refusal** | Peers walk out of range or meeting room reservation expires during call negotiation. | Gateway emits `rtc:refused`. Client tears down connection and applies a 5-second backoff. |
| **Call Glare** | Both peers initiate calls concurrently. | W3C Perfect Negotiation resolves collision: polite peer yields and processes incoming offer; impolite peer ignores collision offer. |

---

## Why it's built this way

- **Full Mesh WebRTC vs. Central SFU (Selective Forwarding Unit)**:
  Virtual office conversations typically involve small clusters of 2–4 colleagues in proximity. Mesh P2P eliminates costly media server infrastructure, avoids central relay latency, and protects audio privacy.
- **Custom Gain Curves + HRTF vs. Web Audio Distance Models**:
  Web Audio's built-in `PannerNode` distance models (`inverse`, `exponential`, `linear`) cut off abruptly or decay awkwardly for retro 2D pixel grids. By setting `rolloffFactor: 0`, the panner handles purely binaural HRTF angle positioning while our custom `openGain` cosine curve guarantees completely smooth, pop-free transitions.
- **Lexicographical Dialing (`myId < otherId`)**:
  Rather than both clients firing simultaneous WebRTC offers over the WebSocket gateway when stepping into range, deterministic ID comparison ensures only one client initiates dialing, cutting signalling traffic in half.
- **Hysteresis Boundary Gap (3 Tiles vs. 4 Tiles)**:
  Without hysteresis, avatars standing exactly on a boundary line trigger continuous dial/hangup loops on every minor physics position update. Requiring 3 tiles to dial and 4 tiles to drop ensures stable, uninterrupted conversation.
- **Shared `/office` Socket Namespace**:
  Reusing the office WebSocket connection for voice signalling avoids opening separate socket transports, shares handshake JWT authentication, and eliminates cross-connection synchronization lag.

---

## How to change it safely

### Adjusting Auditory Earshot Radius
1. In `apps/web/game/systems/Proximity.ts`, update `NEAR_RADIUS` (currently `3`).
2. In `apps/web/features/voice/VoiceManager.ts`, update `ANSWER_RADIUS_TILES = NEAR + 1` (currently `4`).
3. In `apps/api/src/voice/voice.rules.ts`, update `SERVER_EARSHOT_TILES` (currently `4`) to match `ANSWER_RADIUS_TILES`.
4. In `apps/api/src/voice/voice.rules.spec.ts`, update test assertions to reflect the modified distance.

### Switching the Microphone During a Call
The device choice applies when voice is joined (Settings → Voice is another page). To switch live, reuse the unplug path: open the new stream with `openMicrophone(choice)`, then `VoicePeer.replaceMic(track)` on every peer and rebuild `micLevel`, as `VoiceManager.recoverMic()` does.

---

## Tests

- **Unit Tests**:
  - `apps/api/src/voice/voice.rules.spec.ts`:
    - Validates open office conversation within earshot (`<= 128 px`).
    - Verifies distance rejection beyond earshot threshold.
    - Confirms that avatars in meeting rooms can talk regardless of distance.
    - Enforces acoustic wall isolation (different rooms never talk, even when adjacent).
    - Verifies room booking authorization permissions (`bookingAllows`).
- **Test Commands**:
  - Run voice unit tests:
    ```bash
    pnpm --filter api test apps/api/src/voice/voice.rules.spec.ts
    ```
