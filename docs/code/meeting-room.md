# Meeting Room Tools (`meeting-room`)

## Purpose

Inside a meeting room, a bar under the office name offers two shared tools:

- **Share screen**: one presenter per room sends their screen (and the audio of a shared tab) to everyone in the room. Watching works on every device; presenting needs a desktop browser (phones and tablets cannot capture their screen from a browser, and the button says so).
- **Whiteboard**: an [Excalidraw](https://github.com/excalidraw/excalidraw) canvas shared live by everyone in the room, with their named cursors, saved per room for the next meeting.

Both follow the same access rule as room voice and room chat: **stand in the room, and be invited when it is booked**.

---

## Where it lives

### API (`apps/api/src/meeting-room/`)

| File | One-line job |
| --- | --- |
| `meeting-room.module.ts` | Registers the two gateways, the whiteboard service and `RoomAccess`. |
| `room-access.ts` | `RoomAccess.allows(ws, user, room)`: the server's copy of where people stand (`OfficeGateway.locate`) plus the running booking's attendees (fails closed on database errors). `audience()` lists who may see a room. |
| `meeting-room.rules.ts` | `roomOf(body)`: the validated `roomId` of a socket message. |
| `screen.gateway.ts` | Presenter of each room (in memory), `screen:*` events, signalling relay presenter ↔ viewer. |
| `whiteboard.rules.ts` | Pure: element validation (`parseElements`), Excalidraw's merge order (`isNewer`, `mergeElements`), size caps. Unit tested in `whiteboard.rules.spec.ts`. |
| `whiteboard.service.ts` | One board per room, cached in memory, saved to the `Whiteboard` table 1 s after the last edit (and on shutdown). |
| `whiteboard.gateway.ts` | `wb:*` events: open a board, merge and relay edits, relay cursors; drops sockets that lost access. |

### Web (`apps/web/features/meeting-room/`)

| File | One-line job |
| --- | --- |
| `MeetingRoomTools.tsx` | Mounted by `OfficeFeatures`: the room bar, the shared screen and the whiteboard overlay; walking out closes everything. |
| `ScreenShare.ts` | Presenter and viewer sides: `getDisplayMedia`, one send-only `RTCPeerConnection` per viewer, retries. |
| `ScreenStage.tsx` | The shared screen: large or minimised viewer (full screen, "Tap for sound" when autoplay is blocked), or the presenter's own preview with the viewer count. |
| `WhiteboardOverlay.tsx` | Full-screen frame (`data-captures-keys`, so drawing shortcuts never walk the avatar); loads the canvas on demand. |
| `WhiteboardCanvas.tsx` | Excalidraw with live sync: initial load, batched edits (~10/s), `reconcileElements`, collaborator cursors. |
| `scripts/excalidraw-assets.mjs` | Copies Excalidraw's fonts to `public/excalidraw/` before `next dev` / `next build` (served by the app, so the board works on a LAN without internet). |

---

## How it works

### Screen sharing

Screen video does not reuse the voice calls: viewers need no microphone, and the presenter is always the one offering, so there is no glare.

```
Presenter                          API (/office)                         Viewer
   │ getDisplayMedia()                  │                                   │
   │── screen:start {roomId} ─────────► │ access + one presenter per room   │
   │◄── ack {ok} ─────────────────────── │── screen:presenter {roomId, id} ─►│ (everyone allowed in the room)
   │                                    │◄── screen:signal {want} ──────────│
   │◄── screen:signal {want} ────────── │                                   │
   │ new RTCPeerConnection + tracks     │                                   │
   │── screen:signal {offer} ─────────► │── screen:signal {offer} ─────────►│ answer
   │◄──────────────────────── answer, ICE candidates both ways ────────────►│
   │◄═════════════════ video (+ tab audio), peer to peer ═════════════════►│
```

- People entering the room ask `screen:who` (answered only to people allowed in the room).
- The share ends when the presenter clicks Stop, uses the browser's own "Stop sharing" bar (the track ends), walks out, or disconnects. The server also drops a presenter who is no longer allowed in the room the next time anyone asks.
- Signalling is relayed only between the room's presenter and one viewer, both allowed in the room (else `screen:refused`). Messages are capped at 32 KB, 50 per second per socket.

### Whiteboard

- `wb:join` answers with every element of the room's board and adds the socket to `wb:<workspaceId>:<roomId>`.
- The canvas sends the elements whose `version` is ahead of what the others have (`known` map), batched every 100 ms. The server keeps the newer copy of each element by Excalidraw's own rule (higher `version`, then lower `versionNonce`) and relays only accepted elements, so every copy converges whatever the order of arrival.
- Received elements are merged with Excalidraw's `reconcileElements` and applied with `CaptureUpdateAction.NEVER` (others' strokes stay out of your undo history).
- Deletions travel as `isDeleted: true`; deleted elements are not stored, and are purged first when a board reaches 5,000 elements.
- Images are turned off (`UIOptions.tools.image = false`), and so is loading scene files, to keep boards light.
- Before relaying, the gateway re-checks everyone who has the board open; anyone who walked out or lost access to a starting booking is dropped (`wb:closed`).

---

## Events

| Event | Direction | Payload | Notes |
| --- | --- | --- | --- |
| `screen:start` | C → S (ack) | `{ roomId }` → `{ ok }` \| `{ error: 'FORBIDDEN' \| 'BUSY', by? }` | Become the presenter. |
| `screen:stop` | C → S | `{ roomId }` | Only the presenting tab. |
| `screen:who` | C → S (ack) | `{ roomId }` → `userId \| null` | Only answered to people allowed in the room. |
| `screen:presenter` | S → C | `{ roomId, userId \| null }` | To everyone allowed in the room. |
| `screen:signal` | both | `{ roomId, to }` / `{ roomId, from }` + `data: { want?, bye?, description?, candidate? }` | Presenter ↔ viewer only. |
| `screen:refused` | S → C | `{ roomId, to }` | Relay refused (no presenter, or access lost). |
| `wb:join` | C → S (ack) | `{ roomId }` → `{ elements }` \| `{ error }` | Opens the board. |
| `wb:leave` | C → S | `{ roomId }` | |
| `wb:update` | both | `{ roomId, elements }` | Changed elements; ≤ 900 KB per message. |
| `wb:pointer` | both | `{ roomId, x, y, tool, button }` (+ `from` when relayed) | Volatile, ~20/s. |
| `wb:closed` | S → C | `{ roomId }` | You were dropped from the board. |

---

## Limits and known gaps

- **Mesh**: the presenter uploads one copy of the screen per viewer. Fine for a meeting room (a handful of people); an SFU would be needed for large audiences.
- **STUN only** (like voice): peers behind symmetric NATs may not connect without a TURN server.
- **Presenting on phones and tablets** is impossible in browsers (`getDisplayMedia` does not exist there).
- **Whiteboard history**: the board keeps its latest state, not past versions.
