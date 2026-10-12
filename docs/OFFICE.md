# Office, onboarding and invitations

**Internals:** see [docs/code/README.md](code/README.md)  
**Owners:** Roy (office, onboarding, editor) · Zakaria (games, tasks, wings, testing) · Roy (invitations, members)  
**Code:** `apps/api/src/{office,workspace,invitations,games,tasks,voice,meetings,chat,settings,dev}`, `apps/web/game`, `apps/web/features/{office,onboarding,team,workspace,games,tasks,voice,meetings,chat,settings,dev}`, `e2e`

Same idea as the first version on `main`, without AI: the organiser picks a ready-made office
that fits the team size and arranges it by hand in a live editor.

---

## 1. The journey

```
Organiser                                   Staff
─────────                                   ─────
sign up ──► /onboarding                     (email) "Roy invited you to Dev Pulse HQ"
  1. office name                                  │
  2. team size → recommended template             ▼
  3. pick the office (preview)              /invite/<token>
  4. pick a character                         ├─ no account → sign up (email prefilled) ─┐
  ──► /office                                 ├─ signed out → sign in ───────────────────┤
  "Invite" → /team: email + role                └─ signed in ──► pick a character ◄───────┘
  "Edit office" → editor                                   "Join Dev Pulse HQ"
                                                           ──► /office, at their own desk
```

- **Only the organiser creates an office.** Whoever creates it is its `OWNER`. Invited people
  never see the "create" step: they pick a character on the invitation page and land
  straight in the office, with a desk of their own (both can be changed later).
- **One office per person** (`WorkspaceMember.userId` is unique). Someone already in an
  office can't create or join another one until they leave.
- Signed in with no office → `/onboarding`. With an office → `/office`.

## 2. Roles

| | Owner (organiser) | Admin | Member |
| --- | :---: | :---: | :---: |
| Walk, see everyone, change own character and status | ✔ | ✔ | ✔ |
| Invite members, resend / revoke invitations | ✔ | ✔ | |
| Edit the office (furniture, room names), assign desks | ✔ | ✔ | |
| Invite admins, change roles, remove people | ✔ | | |
| Rename the office | ✔ | ✔ | |
| Move the office to another template, delete it | ✔ | ✔ | |
| Expand the office with wings (Loft desks, any template for Chill room) | ✔ | ✔ | |
| Move to another desk | ✔ | ✔ | ✔ |
| Leave the office | (delete it instead) | ✔ | ✔ |

Every rule is checked by the API (`MembershipService.require(userId, roles)`); the buttons
are only hidden for comfort. Removed people and a deleted office are pushed live: they
leave the office at once with a message.

## 3. Invitations

- Organiser/admin enters an email and a role → an invitation with a random token (only its
  SHA-256 hash is stored), valid **7 days**, sent by email; the link is also shown to copy.
- The link works **only for that email address** (`WRONG_ACCOUNT` otherwise) and **once**.
- Inviting the same email again replaces the pending invitation. "Resend" makes a new link
  (the old one stops working). At most 50 pending invitations per office.
- The invitation page works signed out: it shows the office, who invited you, and the right
  button (create account / sign in / join). Declining needs no account.

## 4. The office

The layout is JSON on the workspace (`OfficeLayout`: rooms, walls, furniture, spawn).
Five templates in `apps/api/src/office/templates/`:

| Template | Desks | Size (tiles) | For |
| --- | --- | --- | --- |
| Made for your team (`generated`) | team + 25% (at least 4) | 32 × 27 → 88 × 64 | 1–100, recommended |
| Loft | 8 | 32 × 28 | up to 8 people |
| Studio | 24 | 46 × 34 | 6–24 |
| Campus | 48 | 60 × 42 | 20–48 |
| Headquarters | 100 | 76 × 57 | 40–100 |

The generated office (`generated.ts`) is built for the team size in three steps: a north
band of meeting rooms (one per ~10 people, up to 4, one bigger than the others) and a
kitchen + lounge filling the rest (a second chill corner when it's long), an open space
with desk clusters of 4 in a centred grid, and the entrance with waiting areas on the south
wall. The office name is the seed: it picks room names, carpet colours, sofas, plants and
which side the meeting rooms are on, so the wizard's preview is the office you get. The seed
is kept in `layout.generated`, so rebuilding it later keeps its look even after a rename.
`generated.spec.ts` builds every size from 1 to 100 with several seeds and checks
`validateLayout` finds nothing. The API takes `teamSize` (1–100) with `templateId:
'generated'` (`POST /api/workspace`; `PUT /api/workspace/template`, where it defaults to the
number of members), and `GET /api/office/templates?team=12&seed=<name>` previews it.

The owner can move everyone to another template later (Team page → Office layout), or back
to the original furniture of the current one. It's refused when the team doesn't fit
(more people than desks) or someone saved the office meanwhile.

Zones (desks, meeting rooms, lounges) are derived from the layout, so they follow the
furniture when the office is edited.

### Expanding the office (wings)

When a team outgrows the initial 8 desks, owners and admins can expand the office by adding generated wings (`POST /api/workspace/wings`).

- **Rules**: Caller must be `OWNER` or `ADMIN`. The side must be `LEFT`, `RIGHT`, or `BOTTOM`.
- **Standard wings (Loft only)**: Attaches to the outer edge of the office, adding ~8 desks plus a generated meeting room or lounge from a seed. A door is automatically cut in the shared wall while protecting functional furniture. Recorded in the `OfficeWing` table (`workspaceId`, `side`, `seed`, `x`, `y`, `w`, `h`, `deskCount`); switching templates resets wings.
- **Chill room wing** (`POST /api/workspace/wings/chill`): Any office template can add a dedicated chill room wing (`side: 'LEFT' | 'RIGHT' | 'BOTTOM'`). Adds a dedicated recreation room with 0 desks. Allowed once per office (refused with `CHILL_EXISTS` if a chill room already exists). `GET /api/workspace` returns `canAddChill: true` when caller is OWNER/ADMIN and the office has no chill room yet. The Team page displays a persistent "Chill room added" badge (`data-testid="chill-added"`).
- **Architecture & pipeline**: Procedural wing generation (`planWing`), door scanning, shared wall slicing, coordinate shift translation, and golden snapshot tests are detailed in [docs/code/layout.md](code/layout.md). Code lives in `apps/api/src/office/layout/wings.ts`.

### Live presence without lag

- The `/office` socket joins the office room on connect (cookie auth, live session, and membership verified) and sends current occupant presence (`office:state`).
- While walking, positions go out ~20 times a second as compact arrays `[x, y, dir, moving, seated]`, transmitted as **volatile** packets (dropped on network congestion, never queued) and broadcast via `office:moved`. The server clamps coordinates to office boundaries and enforces walking speed limits to prevent jumping into closed rooms.
- Other people are rendered 100 ms in the past and smoothly interpolated between positions via the `NetSync` system (`apps/web/game/systems/NetSync.ts`).
- **Depth sorting**: Furniture, people, and desk plates are y-sorted dynamically by their bottom edge/feet via the `Depth` system (`apps/web/game/systems/Depth.ts`, `DEPTH.sorted`), so people hide behind what they stand behind. Seated people draw just above their chair.
- **Sitting**: Stand on a free chair, stool, or armchair for ~0.5 s to snap into place via `Seating` (`apps/web/game/systems/Seating.ts`), facing the chair's orientation. Hold a movement key for ~0.5 s to stand up and step off.
- Sockets connect directly over WebSocket without HTTP polling fallback. If the connection drops, a "Reconnecting…" banner shows and state resyncs automatically on reconnect.
- Wire event contracts and telemetry details: see [docs/code/office-protocol.md](code/office-protocol.md) and [docs/code/office-engine.md](code/office-engine.md).

### One office tab at a time

The `/office` handshake sends auth `{ tabId, takeover }` (`tabId` is random per page load).
The server (`OfficeGateway` + `claimOffice` in `apps/api/src/office/office.rules.ts`) refuses a connection while
the same user has another tab's socket live with `connect_error` `ALREADY_OPEN` (also `office:busy`
event if two race). `takeover: true` (set only by the "Use here" button) emits `office:replaced`
to the old tabs and disconnects them without the avatar leaving; same tabId reconnecting
(network loss) silently replaces its stale socket. A replaced tab doesn't auto-reconnect;
takeover flag is reset after each connect so a tab that was offline can't steal the office back.
Web: `apps/web/features/office/connection.ts`, `apps/web/features/office/tabLockStore.ts` (store), and `apps/web/features/office/TabLock.tsx` (overlay rendered in `apps/web/features/office/OfficeView.tsx`). Works across browsers/devices of the same account.

## 5. Life in the office

| What | How it works | Code |
| --- | --- | --- |
| **Nearby** | Another person within 3 tiles **in the same room** (walls, even glass, separate people) → `player:near`, then `player:distance` up to 5×/s, `player:far` past 3.5 tiles. The people list tags them "Nearby". | `game/systems/Proximity.ts` |
| **Your desk** | Each member gets a free desk on joining (joining order), with their name on it (yours in green). Desks follow the office: after an edit people keep their desk if it still exists. Owners and admins move people from the Team page (swaps with whoever sat there). | `workspace/desks.service.ts`, `game/objects/DeskPlates.ts` |
| **Moving desks** | Any member can move to another free desk (`PUT /api/workspace/me/desk`). Desk art follows the owner. Refused if taken (`DESK_TAKEN`). Emits `office:desks`. | `workspace/desks.service.ts` |
| **E to use** | At a desk, screen, task board, or games piece (Baby foot table, Uno card table, Lego wall), a hint appears ("Your desk", "Play Baby foot", "Play Uno", "Build with Lego"); **E** (or tapping the hint) emits `object:interact`. | `game/systems/Interactions.ts` |
| **Who is where** | The game reports its zone; the server shares it (`office:zone`), for display only (access uses positions). The people list shows "Atlas · Meeting room", "At Roy’s desk"; meeting rooms with people inside show "In use · 2". | `office.gateway.ts`, `game/objects/RoomBadges.ts` |
| **Status** | A short status in a bubble over the avatar ("Focusing", "On break ☕" or your own text), set from the user menu (top right → Status), stored on the membership. | `UserMenu.tsx`, `StatusSection.tsx` |
| **Map** | Floor plan in the corner with everyone, and the part of the office on screen. | `Minimap.tsx` |
| **Phones and tablets** | A joystick (bottom right) instead of the keyboard; the hints say "Tap". | `Joystick.tsx` |

### For features inside the office (Zakaria, helper)

Listen to the game, don't touch it: `officeEvents` in `apps/web/features/office/events.ts`.

```ts
officeEvents.on('player:near', ({ userId, distance }) => voice.call(userId));
officeEvents.on('player:distance', ({ userId, distance }) => voice.setVolume(userId, 1 - distance / 3));
officeEvents.on('player:far', ({ userId }) => voice.hangUp(userId));
officeEvents.on('zone:enter', (zone) => zone.type === 'meeting' && meeting.join(zone.id)); // room id, not its name
officeEvents.on('object:interact', (e) => e.type === 'desk' && e.ownerId === me.id && tasks.open());
officeEvents.on('object:interact', (e) => ['foosball', 'uno', 'lego'].includes(e.type) && games.open(e));
```

Every `on` returns its own "off", handy in `useEffect`. The status bubble is
`PATCH /api/workspace/me { status }` (e.g. the current task); it reaches everyone live.

### Moving to another desk

Any member can move to an unoccupied desk (`PUT /api/workspace/me/desk` body `{ deskId }`).
- Refused with `DESK_TAKEN` if another member already sits there (`NO_SUCH_DESK` if not in layout).
- Desk art follows the owner to the new desk.
- Emits the `office:desks` socket event so everyone sees updated desk plates and props live.
- UI: E at a free desk (hint "Move to Desk N") opens `MoveDeskPrompt` ("Move here" / Cancel; E again confirms,
  Esc or walking away cancels). E at an occupied desk only shows a toast with the owner's name.

### Chat bubbles and paper stacks

- **Chat bubbles**: every `chat:message` that `ChatPanel` accepts (office, or the room you're in; panel open or
  not, your own too) calls `controller.showChat(userId, text)` → `Avatar.say()`: a `SpeechBubble` (wrapped, max
  80 chars) above the status bubble, shown 4.5 s + 40 ms per character, then fades. A newer message replaces it.
  It is an Avatar child, so it follows the person and is cleaned up with it.
- **Paper stacks**: `apps/web/features/office/OfficeView.tsx` feeds `useOpenTaskCounts()` to `controller.setTaskCounts(Map<userId, n>)`; the
  scene maps it to desk ids (`setDeskPapers`) and redraws changed desks (`drawDesk` option `papers`: one sheet per
  task up to 8, a clip beyond; none at 0 in `apps/web/game/art/desk.ts`). The texture key includes the count (capped at 9).

### Characters and desks are generated (`apps/web/game/art/`)

A character is a **recipe**: 18 choices (build, height, skin, hairstyle and colour, beard,
glasses, top, colours, pattern, bottom, shoes, hat, desk vibe). `WorkspaceMember.character`
holds one of the 8 named presets (`maya`, `sam`…) or the recipe as a 19-character code
(`1` + one base-36 digit per choice). The pickers offer the presets plus freshly generated
characters ("New faces"); the API checks codes with `IsCharacter()`
(`apps/api/src/workspace/characters.ts`, keep `DNA_SIZES` in sync with `recipe.ts`).

**Character studio** (`apps/web/features/workspace/CharacterStudio.tsx`, controlled: `value` / `onChange(code)`):
4-direction preview, desk preview, Random / "Change a little", the 8 presets, and part pickers
(Body, Hair & face, Outfit, Extras). It saves the 19-character code and is used in onboarding,
the invitation page, and the user menu in the office (top right → Character, opening `CharacterModal.tsx`).
Onboarding has no headcount question: Loft is preselected ("grows with your team"); the generated
office offers Small (~8) / Medium (~24) / Large (~48).

| File | What |
| --- | --- |
| `color.ts`, `palette.ts` | Every colour, as OKLCH ramps (shadows cooler, highlights warmer) |
| `recipe.ts` | Choices, codes, presets, random characters with contrast rules, mutate / breed |
| `character.ts` | Draws a character in layers, 4 directions, moods, headset, mug |
| `desk.ts` | A desk decorated for its owner: anchor slots, props by vibe, their colours; free desks stay bare |
| `pen.ts` | One drawing interface for Phaser, canvas and SVG (the React previews use the same code) |
| `tools/art-lab/` | Standalone art lab: simulated day at the office, character studio, lineup; see [tools/art-lab/README.md](../tools/art-lab/README.md) |

- The status sets the face: "Focusing" → focused, "On break ☕" → smiling with a mug.
- `Avatar.setInCall(inCall, talking)` puts the headset on (Z3/Z4: call it when a call starts and ends).
- Each avatar frame is drawn once into a texture shared by everyone with the same recipe
  (Phaser redraws Graphics shapes every frame). Desks are re-drawn when their owner changes.

### Chat

**Code:** `apps/api/src/chat`, `apps/web/features/chat`

A chat button bottom left with an unread count opens the panel. Two tabs:
**Office** (everyone in the office) and, while you stand in a meeting room or lounge, that
room (only the people in it right now). Leaving the room closes its tab; entering one loads
its history again. Enter sends, Shift+Enter is a new line, Esc gives the keys back to the
game (walking keys are ignored while you type).

| Rule (checked by the server) | |
| --- | --- |
| Text | trimmed, 1–500 characters |
| Rate | 5 messages per 5 seconds per person (`TOO_FAST`) |
| Room channel | the room the server places you in (`OfficeGateway.locate`): its copy of the positions clients report, speed-limited so nobody can jump into a room (`NOT_IN_ROOM`) |
| Booked room | while a booking runs, only its attendees read and write (`NOT_ATTENDEE`); a meeting's messages stay with it (not shown before or after, nor its earlier chatter during it) |

- Socket `/office`: the client sends `chat:send { channel, text }` and gets an ack
  `{ ok: true, message }` or `{ ok: false, error: { code, message } }` (shown under the input;
  `SERVER_ERROR` when the database fails, so the ack always comes).
  Everyone allowed receives `chat:message { id, channel, userId, name, text, createdAt }`:
  the office channel goes to the whole office, a room channel only to the people in that room.
- `GET /api/workspace/chat?channel=office|<room id>&before=<createdAt>&beforeId=<id>` →
  `{ messages, more }`, the last 50, oldest first; same room and booking rules. To load older
  ones, send the oldest shown message's `createdAt` and `id` (the id keeps messages of the same
  millisecond from being skipped).
- Messages are stored in `ChatMessage` (channel `office` or a layout room id), with the
  booking running in the room when sent (`bookingId`); a room shows only those of the
  booking running now (or of no booking when it's free).

### Task board and the Esc key

**Code:** `apps/web/features/tasks/`, `apps/api/src/tasks/` · **Internals:** [docs/code/tasks.md](code/tasks.md), [docs/code/frontend.md](code/frontend.md)

- **Right-side board drawer**: The global Kanban board is hosted in a slide-out drawer on the right side of the screen (`apps/web/features/tasks/BoardDrawer.tsx`). Opening the drawer pushes the office layer (canvas and HUD) smoothly to the left, while the camera shifts (`setViewShift` in `apps/web/features/office/useOfficeBoard.ts`) so the avatar remains visible in the active on-screen portion of the office. Once the drawer settles, Phaser rendering is throttled to conserve client resources.
- **Drawer handle & gestures**: An edge handle button (`apps/web/features/tasks/BoardDrawerHandle.tsx`) allows toggling or dragging the drawer. The drawer supports touch and pointer drag/flick gestures with velocity thresholds (0.5 px/ms flick, 0.35 snap ratio). Responsive layout: full width minus padding on mobile screens (< 768px), and up to 70% viewport width (maximum 960px) on desktop.
- **Opening the board**:
  - Pressing the **B** key (configurable shortcut via `useKeybind('board', ...)`).
  - Clicking the HUD "Board" button.
  - Pressing **E** at a wall-mounted whiteboard (`board` furniture kind, interaction target `kanban`).
  - Pressing **E** at your own desk (`desk` interaction with `ownerId === me.id`), which opens the drawer pre-filtered to your assigned issues.
- **Kanban columns & filtering**: 4 columns (To do, In progress, In review, Done) with status counters and drop placeholders. Header filters (`apps/web/features/tasks/BoardFilters.tsx`) support text query search, quick filter buttons, and an assignee avatar cluster (`apps/web/features/tasks/BoardFilterFaces.tsx`: multi-select, "Unassigned", "Only my issues").
- **Cards & Drag and Drop**: Cards (`apps/web/features/tasks/TaskCard.tsx`) display Jira-style ticket keys (e.g. `DP-42`), type icon (`TASK`, `BUG`, `STORY`), priority badge (`HIGHEST` through `LOWEST`), title, assignee avatar, and due date. Drag-and-drop (`apps/web/features/tasks/useBoardDrag.ts`) uses HTML5 DnD with fractional midpoint ranking (`rankBetween`) within and between columns, applying optimistic local state with rollback on API errors.
- **Task dialogs**: Clicking a card opens `apps/web/features/tasks/EditTaskDialog.tsx` for editing markdown descriptions, assignees, dates, and metadata (task deletion is restricted to the ticket reporter or workspace `OWNER`/`ADMIN`). New tasks are created via `apps/web/features/tasks/CreateTaskDialog.tsx`.
- **Store & synchronization**: Reactive state is managed by `apps/web/features/tasks/taskStore.ts` (`useSyncExternalStore`), mounted via `useTaskSync(socket)` in `OfficeView.tsx`. Subscribes to live WebSocket events on `/office` (`task:created`, `task:updated`, `task:deleted`). Exports `useTasks()`, `useOpenTaskCounts()`, and `taskActions`.
- **Esc key handling**: `useEscape(active, handler)` (`apps/web/lib/escape.ts`) manages a stack of open layers; Escape closes only the topmost layer (dialogs over the board drawer, drawer over the office). While focus is inside input elements with `data-captures-keys`, walking keys are ignored.

### User menu and keybinds

**Code:** `apps/web/features/auth/UserMenu.tsx`, `apps/web/features/settings/`, `apps/api/src/settings/keybinds.ts`

- **User menu** (top right): Triggered by clicking the user avatar in the top right of the screen. Portaled to `document.body` (`z-[60]`, modals at `z-[70]`), the dropdown provides access to:
  - User identity header (display name, email, active status badge).
  - Office profile items (available inside the office):
    - **Character**: opens `apps/web/features/office/CharacterModal.tsx` hosting the full `CharacterStudio`.
    - **Status**: expandable `apps/web/features/office/StatusSection.tsx` offering preset status chips ("Focusing", "On break ☕", etc.), custom text input, and status clearing.
  - **Keybinds**: opens `apps/web/features/settings/KeybindsModal.tsx` to customize keyboard shortcuts.
  - **Team**: direct link to `/team` workspace member management.
  - **Security settings**: direct link to `/settings/security` (password, 2FA, active sessions).
  - **Switch user (dev)**: quick test persona switcher (visible only when dev login is enabled).
  - **Sign out**: signs out of the active account.
- **Keybind actions & defaults**: 8 bindable actions defined in `apps/web/features/settings/keybinds.ts` and `apps/api/src/settings/keybinds.ts`:
  - `interact` (default `KeyE`): Use / interact (sit, access desk, trigger games)
  - `mute` (default `KeyM`): Mute microphone in voice
  - `deafen` (default `KeyH`): Deafen voice audio
  - `pushToTalk` (default `KeyV`): Push-to-talk voice activation
  - `chat` (default `KeyC`): Toggle text chat panel
  - `board` (default `KeyB`): Toggle task board drawer
  - `rooms` (default `KeyT`): Toggle meeting rooms timetable
  - `people` (default `KeyP`): Toggle office occupant roster
- **Reserved keys**: Navigation and walking keys can never be rebound (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Escape`, `Enter`, `Tab`).
- **Storage & validation**: Stored per user in PostgreSQL in `UserSettings.keybinds` (JSON object holding only non-default overrides; `pushToTalkKey` column remains in sync for PTT). Managed through `GET /api/settings` and `PATCH /api/settings`, which validate key code patterns (`/^[A-Za-z0-9]{1,24}$/`), reject reserved keys, and prevent duplicate collisions.
- **Frontend architecture**: Split into pure definitions/validation (`apps/web/features/settings/keybinds.ts`) and reactive state management (`apps/web/features/settings/keybindStore.ts`). All listeners (`VoiceControls`, `Interactions` system, HUD toggles) read through `keybindStore`.
- Minigames use direct pointer controls (Baby foot is mouse-only; legacy keyboard actions `foosKick` and `foosSwitch` were removed).

## 6. The office editor

Owners and admins: **Edit office** (top right). Editing happens in the real office, so what
you see is exactly what everyone gets.

- **Add**: pick a piece in the left panel, click where it goes (a ghost follows the mouse,
  green when it fits, red when it doesn't).
- **Move**: drag it. Snaps to ¼ tile. **Arrows** nudge (Shift = 1 tile).
- **Selected piece** (right panel): rotate, colour (sofas, armchairs, beanbags, rugs),
  duplicate, remove. Keys: `R` rotate, `Ctrl+D` duplicate, `Del` remove, `Esc` deselect.
- **Several pieces**: `Shift`-click to add or remove one, `Shift`-drag a box on the floor,
  `Ctrl+A` for everything. Dragging, nudging, rotating, duplicating and removing then work on
  the whole group (all or nothing: if one piece doesn't fit, nothing moves).
- **Rooms**: rename them (nothing selected → right panel).
- **Reset to the original furniture** (right panel): puts the template back, as one undoable
  step, saved like any other change.
- `Ctrl+Z` / `Ctrl+Y` undo / redo. Drag the floor to look around, scroll to zoom.
- **Save for everyone** → everyone in the office gets the new layout at once, staying where
  they stand (or back at the entrance if furniture now covers their spot).

### It can't break the office

1. **While editing** (same rules as the server, `game/editor/rules.ts`): a piece can't leave
   the building, stand on a wall or in a doorway, or overlap another one. A bad drop snaps
   back with a message.
2. **On save** the API checks everything again (`apps/api/src/office/layout/validate.ts`) and also walks
   the office with the real player size: the entrance must be free, and **every desk and
   every room must still be reachable**. Otherwise nothing is saved and the editor
   highlights the pieces in the way.
3. Walls, doors and room shapes can't be changed, only furniture and room names, so the
   look of the building stays intact.
4. **Two organisers at once**: each save carries the layout version it started from. If
   someone saved in between, the second save is refused ("Load the latest") instead of
   silently overwriting their work.

### Whiteboard (`board`)

Wall-mounted Kanban whiteboard (3 × 0.5 tiles, solid obstacle).
- Wall-mounted: hangs flush against the south face of a solid horizontal wall (validated with `NOT_ON_WALL`).
- Exactly one `board` is included in every office template.
- Existing offices created before this furniture kind was added will not have one until a template reset or added via the editor.

### Games furniture (`foosball`, `cardTable`, `legoBoard`)

Catalog group "Games" (`apps/web/game/editor/catalog.ts`):
- `foosball`: Baby foot table (3 × 1.6 tiles, solid obstacle).
- `cardTable`: Uno card table (2.2 × 2.2 tiles, round, solid obstacle). Surrounded by 6 sittable chairs.
- `legoBoard`: Wall-mounted Lego board (3 × 0.5 tiles, solid obstacle). Wall-mounted on a tall wall face like `board` and `tv` (validated with `NOT_ON_WALL`).

## 7. API

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/office/templates` | signed in | templates (name, team size, layout for the preview) |
| POST | `/api/workspace` | no office yet | `{ name, templateId, character, teamSize? }` (teamSize for `generated`) → you are the owner |
| GET | `/api/workspace` | member | office, layout, version, your role and character |
| PATCH | `/api/workspace` | owner, admin | `{ name }` |
| POST | `/api/workspace/delete` | owner | `{ confirmName }` |
| PATCH | `/api/workspace/me` | member | `{ character?, status? }` (empty status = none) |
| PUT | `/api/workspace/me/desk` | member | `{ deskId }` (move to another free desk; `DESK_TAKEN`, `NO_SUCH_DESK`) |
| PUT | `/api/workspace/layout` | owner, admin | `{ version, furniture, rooms: [{ id, name }] }` |
| PUT | `/api/workspace/template` | owner | `{ templateId, version, teamSize? }` (generated: defaults to the member count) |
| POST | `/api/workspace/wings` | owner, admin | `{ side, version }` (Loft only: 'LEFT' \| 'RIGHT' \| 'BOTTOM'; adds wing) |
| POST | `/api/workspace/wings/chill` | owner, admin | `{ side, version }` (any template: adds chill room wing, deskCount 0; `CHILL_EXISTS`) |
| GET | `/api/workspace/games/leaderboard` | member | `?game=foosball\|uno\|lego&days=7` (top 10 by wins desc, losses asc) |
| GET | `/api/workspace/members` | member | with their `deskId` |
| PATCH / DELETE | `/api/workspace/members/:userId` | owner (or yourself to leave) | `{ role }` |
| PUT | `/api/workspace/members/:userId/desk` | owner, admin | `{ deskId }` (null = no desk) |
| POST / GET | `/api/workspace/invitations` | owner, admin | `{ email, role }` |
| POST | `/api/workspace/invitations/:id/resend` | owner, admin | new link |
| DELETE | `/api/workspace/invitations/:id` | owner, admin | revoke |
| GET | `/api/invitations/:token` | public | what the invitation page shows |
| POST | `/api/invitations/:token/accept` | signed in, invited email | `{ character? }` → join |
| POST | `/api/invitations/:token/decline` | public | |

`GET /api/workspace` also returns `status`, `deskId`, `desks` (who sits where), `wings`, `canExpand` and `canAddChill`.

Socket `/office`: `office:state`, `office:joined`, `office:moved`, `office:left`,
`office:layout`, `office:updated` (character / role / status), `office:zone [id, zone]`,
`office:desks`, `office:removed` (`removed` / `deleted`); the client sends `move` and
`zone`. The `/office` socket also manages games: client sends `game:join`, `game:leave`, `game:action`;
server emits `game:state`, `game:event`, `game:left`, `game:ended`, `game:error`.

## 8. Tests

**Code:** `e2e/`, `apps/api/` · **Internals:** [docs/code/testing.md](code/testing.md)

- `cd apps/api && pnpm test`: pure rules unit tests run instantaneously via Vitest (`*.rules.spec.ts`), validating template geometry, rank math, and collision boundaries without database dependencies.
- **Browser tests** in `e2e/` (Playwright), run by CI on every push: 7 spec files:
  - 1 independent test suite (`office.spec.ts`) utilizing the isolated two-user `team` fixture (`e2e/tests/support/fixtures.ts`).
  - 6 serial story suites (`board.spec.ts`, `chill.spec.ts`, `foosball.spec.ts`, `lego.spec.ts`, `office-live.spec.ts`, `uno.spec.ts`).
  - The suite runs across **3 parallel workers** (`E2E_WORKERS`, default 3; config in `e2e/playwright.config.ts`) and completes in **~1 minute** (down from 42).

**Performance & verification design:**

- **Setup through API**: with `DEV_LOGIN=true`, specs provision test accounts in milliseconds via `devOwner` and `devUser` (`e2e/tests/support/users.ts`, `POST /api/auth/dev/users` + `POST /api/workspace`); only specs explicitly testing onboarding and sign-up use UI registration forms (`register`).
- **Teleportation**: `jumpTo(page, tx, ty)` (`e2e/tests/support/walker.ts`) calls `window.__devpulse.teleport` (installed by `apps/web/features/dev/devHooks.ts`), which dispatches `dev:teleport` to `apps/api/src/dev/dev.gateway.ts`. The API honours it only when dev login is enabled (never in production). Movement specs (`walkTo`) exercise real A* pathfinding and arrow keys.
- **Headless rendering optimizations**: Headless Chromium disables GPU/3D APIs, forcing Phaser to its canvas 2D fallback (~10x faster than software WebGL; `E2E_WEBGL=1` tests WebGL); canvas frame rate is capped at 15 fps (`window.__devpulseFps`); foosball canvas renders at half resolution (`window.__devpulseLowRes`); `e2e/tests/support/browser.ts` injects styles removing `backdrop-filter` blur overhead; global setup (`e2e/global-setup.ts`) pre-warms routes to prime Next.js compilation caches.
- **CI reverse proxy**: `e2e/serve.mjs` runs a same-origin proxy on `:8080` routing `/api` and `/socket.io` to `:4100` and web routes to `:3000`.

```bash
# fast default (3 workers):    pnpm test        (E2E_WORKERS=1 pnpm test for one at a time)
# full, explicit:              pnpm test:full
```

```bash
# with the API on :4100 and the web app on :3000
cd e2e && pnpm install && pnpm exec playwright install chromium
node e2e/serve.mjs &        # same-origin proxy on :8080, like nginx
pnpm test
# or against Docker: E2E_BASE_URL=https://localhost:8443 pnpm test (after `make`)
```

## 9. Meeting rooms

**Code:** `apps/api/src/meetings`, `apps/web/features/meetings` · **Internals:** [docs/code/voice.md](code/voice.md)

**Rooms** (top right) opens a day timetable: one column per meeting room, the whole day
(00:00–24:00) in 30-minute rows, today with previous / next day, in your own time zone. It opens
scrolled to the current time (today) or to 08:00 (other days); past slots are grey and striped
and cannot be picked. Bookings show their
title, time and people (yours in green). Click a free slot, or drag over several, to book:
title, room, start / end (15-minute steps) and who is invited. Click a booking for its
details; its creator, or an owner / admin, can cancel it.

| Rule (checked by the API) | |
| --- | --- |
| Room | a meeting room of the current layout |
| Time | start before end, 15-minute steps, 4 hours at most, not in the past (the slot running now is fine), up to 30 days ahead |
| People | members of the office, 30 at most; the creator is always one of them |
| No double booking | refused with "Atlas is booked 14:00–15:00 by Roy". Race-free: each booking takes a Postgres advisory lock for its room (`pg_advisory_xact_lock`) inside the transaction that checks and inserts |

**The kitchen café**: press E at the kitchen's fridge or counter to buy water, Pepsi or dinner with PulseCoin (a token on the office blockchain), earned by closing tasks, winning games, a daily allowance or admin grants. What you buy stays in your avatar's hand for 3 minutes. Details: [docs/code/kitchen.md](code/kitchen.md).

**In a meeting room**, a bar under the office name offers **Share screen** (one presenter per room; everyone in the room watches, on any device; presenting needs a desktop browser) and **Whiteboard** (a shared Excalidraw canvas, live for everyone in the room and kept for the next meeting). Details: [docs/code/meeting-room.md](code/meeting-room.md).

**During a meeting only its people get in.**

- The game makes the room solid for everyone else: `RoomLocks` (`apps/web/game/systems/RoomLocks.ts`) closes room colliders. Someone already inside when it starts is sent back to the entrance with "Atlas is booked until 15:00". The badge over the door says "Booked · until 15:00".
- The server can't move people, so audio and chat check too: they ask
  `MeetingsService.activeBooking(workspaceId, roomId)` (cached a few seconds per room, cleared
  when a booking is made or cancelled) and refuse non-attendees.
- Once two people are connected, audio is peer to peer: the server only gates who may start
  a call (`rtc:signal` reaches only the tab that joined voice), and each client hangs up when
  the other leaves range or a booking excludes them.
- **Spatial sound** (`apps/web/features/voice/spatial.ts`, applied by `VoiceManager.tick` every 150 ms; the
  server voice rules in `apps/api/src/voice/voice.rules.ts` use `withinEarshot`: meeting room = whole room, elsewhere earshot). Each call has
  a `PannerNode` (HRTF, direction only) and a `GainNode` (loudness, smoothed over ~80 ms):
  - Open space: full volume within 1 tile, cosine fall to silence at 4 tiles (calls start under 3,
    so someone at the start radius is already faint, ~25 %).
  - Meeting room: you hear the whole room, falling from full (within 1.5 tiles) to 30 % at the room's
    longer side (the "far wall"). Same curve for both people, wherever they stand.
  - Direction: the offset to the speaker is rotated by the listener's facing from
    `controller.snapshot().me.dir` (a seated person faces the chair's direction), so sources in front
    pan to the front and the right-hand side of the listener pans right.
- Moving the office to another template deletes running and future bookings of rooms the new
  layout doesn't have.
- People in a meeting get a toast when it starts.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/workspace/bookings?from&to` | member | bookings of every meeting room (default today → +7 days, 62 days at most) |
| POST | `/api/workspace/bookings` | member | `{ roomId, title, startsAt, endsAt, attendeeIds, timeZone? }` (`timeZone` only words the errors) |
| DELETE | `/api/workspace/bookings/:id` | creator, owner, admin | cancel (not once it's over) |

Every change sends `office:bookings` on the `/office` socket; clients reload the list, and
re-check every minute which rooms are closed to them (`controller.setLockedRooms`).
Rules and their tests: `apps/api/src/meetings/meetings.rules.ts`.

## 10. Chill room and games

**Code:** `apps/api/src/games`, `apps/web/features/games` · **Internals:** [docs/code/games.md](code/games.md), [docs/code/office-protocol.md](code/office-protocol.md), [docs/code/frontend.md](code/frontend.md)

Interactive break room framework and multiplayer arcade activities embedded in the virtual office.

### Room kind and furniture

- **Room kind `chill`**: Defined in `RoomKind` (`'open' | 'meeting' | 'lounge' | 'chill'`). Voice rules (`withinEarshot` in `apps/api/src/voice/voice.rules.ts`) treat `chill` rooms like lounges (earshot radius, not whole room).
- **Furniture**:
  - `foosball`: Baby foot table (3 × 1.6 tiles, solid obstacle).
  - `cardTable`: Round card table for Uno (2.2 × 2.2 tiles, solid obstacle). Surrounded by 6 sittable chairs.
  - `legoBoard`: Wall-mounted Lego building surface (3 × 0.5 tiles, solid obstacle). Wall-mounted on a tall wall face like `board` (validated with `NOT_ON_WALL`).
- **Loft chill room**: Loft template includes a default 11 × 12 chill room (`id: 'chill'`, name "Chill room", terrazzo floor) equipped with 1 Baby foot table, 1 cardTable surrounded by 6 chairs, 1 legoBoard on the north wall, rug, and plant.
- **Chill room wing** (`POST /api/workspace/wings/chill`):
  - Owner or admin can add a chill room wing (`side: 'LEFT' | 'RIGHT' | 'BOTTOM'`) to **any** template.
  - Adds a dedicated recreation room with `deskCount: 0`.
  - Maximum one chill room per office: rejected with error `CHILL_EXISTS` if any room already has kind `chill`.
  - `GET /api/workspace` returns `canAddChill: true` when caller is OWNER/ADMIN and the office has no chill room yet.
  - Team page shows a persistent "Chill room added" status (`data-testid="chill-added"`).

### Interaction and full-screen overlay

1. **Approach**: Walking near a games piece displays a contextual interaction hint:
   - Baby foot: "Play Baby foot"
   - Card table: "Play Uno"
   - Lego wall: "Build with Lego"
2. **Interact (E)**: Pressing **E** (or tapping hint) triggers `Interactions` (`apps/web/game/systems/Interactions.ts`) to emit `object:interact` on `officeEvents` (`{ type: 'foosball' | 'uno' | 'lego', id, name }`).
3. **GameHost overlay**:
   - Games open in a fixed full-screen overlay (`apps/web/features/games/GameHost.tsx`, `inset-0 z-[70]`), capturing keyboard focus so walking keys do not move the avatar.
   - Header bar (`apps/web/features/games/GameChrome.tsx`) displays game title, live player/spectator counts, Leaderboard toggle (`data-testid="game-leaderboard-toggle"`), Leave button (`data-testid="game-leave"`), and close button (`aria-label="Close game"`).
   - Requests browser Fullscreen API on open (exits on close).
   - Both Leave and Close buttons emit `game:leave` and unmount the overlay; Esc closes through `useEscape`.
   - The office HUD is hidden underneath while office background simulation and proximity voice continue running.

### Minigames

#### Baby foot (Foosball)

**Code:** `apps/api/src/games/foosball/`, `apps/web/features/games/foosball/`

- **Rules**: Server-authoritative 1v1 or 2v2 table soccer. First to 5 goals wins. Phases: `lobby` → `countdown` → `playing` ↔ `goal` → `ended`. Requires equal team counts to start. If an entire team disconnects or walks away during an active match, a 10-second grace timer triggers a forfeit loss.
- **Controls (MOUSE ONLY)**:
  - Cursor `y` over the table aims the active rod vertically.
  - Clicking on the canvas requests pointer lock and triggers a kick swing (or switches to a rod if clicked near another of your team's rods; rod chips under the table also select).
  - Rapid vertical mouse flick executes a high-velocity flick kick with power derived from cursor speed. Clicking without flicking kicks with standard power. Kick cooldown is 0.35 s.
  - Aim packets are throttled to 33 ms intervals.
  - There are no keyboard controls for Baby foot (legacy actions `foosKick` and `foosSwitch` were removed).
- **Physics**: Pure deterministic 2D simulation running at 30 Hz with 4 substeps per tick (`apps/api/src/games/foosball/foosball.physics.ts`). Field is 120 × 64 units; table letterboxes to 7:4 aspect ratio.

#### Uno

**Code:** `apps/api/src/games/uno/`, `apps/web/features/games/uno/`

- **Rules**: 2 to 6 players. Standard 108-card deck. Players match top card color or number/action. Wild cards open a color picker. Penalty card draw stacking is supported (+2 on +2, wild4 on wild4). 2-player reverse acts as a skip. Leaving mid-game with fewer than 2 players forfeits the match (forfeit: leaver = loser in both games).
- **UNO! & Catch!**: Players with 2 or fewer cards must call "UNO!" before playing down to 1 card. If a player fails to call, opponents can hit "Catch!" to impose a 2-card draw penalty.
- **Controls**: Interactive card selection, draw pile clicking, and action buttons (`Pass`, `UNO!`, `Catch!`).

#### Lego wall

**Code:** `apps/api/src/games/lego/`, `apps/web/features/games/lego/`, `apps/web/game/render/legoArt.ts`

- **Rules**: Persistent, collaborative 48 × 32 stud building surface. 16 palette colors and 8 standard brick footprints (`1×1`, `1×2`, `2×1`, `2×2`, `1×4`, `4×1`, `2×4`, `4×2`). Bricks never overlap and stay within board bounds. Board clearing is restricted to workspace `OWNER` or `ADMIN`.
- **Controls**: Click baseplate to place, right-click (or Shift + click) to erase, **R** key to toggle brick rotation, toolbar palette to pick shapes and colors.
- **Live miniature**: Miniature preview rendered directly on the physical office wall face above the board. Updates broadcast live to all workspace occupants via `lego:art` socket events and fetched via `GET /api/workspace/lego`.

### Leaderboards and match results

- Completed competitive matches (Foosball, Uno) persist match results to the `GameResult` table via `GameResultsService`. Lego is freeplay and does not record match results.
- **Weekly leaderboard**: `GET /api/workspace/games/leaderboard?game=foosball|uno|lego&days=7` returns top 10 members sorted by wins descending and losses ascending.
- The floating leaderboard drawer in `GameHost` displays ranks and W/L statistics, reloaded each time the drawer is opened.

### Framework and wire protocol

Multiplayer minigames share the unified `/office` WebSocket namespace (`game:join`, `game:leave`, `game:action`, `game:state`, `game:event`, `game:left`, `game:ended`, `game:error`). Proximity checks enforce distance limits (join within 4 tiles, auto-evict past 7 tiles). For implementation contracts, per-viewer state projection, and adding new games, see [docs/code/games.md](code/games.md), [docs/code/office-protocol.md](code/office-protocol.md), and [docs/code/frontend.md](code/frontend.md).

## 11. 2.5D view and wall-mounted items

**Code:** `apps/web/game/render/`, `apps/api/src/office/layout/` · **Internals:** [docs/code/office-engine.md](code/office-engine.md), [docs/code/layout.md](code/layout.md)

- **Walls & Perspective**: Solid thickness 10px, glass 6px (`apps/web/game/render/walls.ts`, `apps/api/src/office/layout/geometry.ts`). Visible wall faces rise 80px (2.5 tiles) above the wall base line with a dark cap. Low walls (`face: false`) are used for southern exterior boundaries. Tall solid walls are divided into 1-tile columns that fade to 0.35 alpha when an avatar walks behind them.
- **Rendering & Depth**: Walls are baked into textures at scene start (`apps/web/game/render/scenery.ts`, `apps/web/game/render/wallFaces.ts`) and depth-sorted dynamically (`apps/web/game/systems/Depth.ts`). Room names hang directly on wall faces above each room.
- **Camera Bounds**: Bounds extend 140px above and 40px below the office canvas (`VIEW_MARGIN_TOP_PX` and `VIEW_MARGIN_BOTTOM_PX` in `apps/web/game/constants.ts`, managed by `apps/web/game/systems/ViewControl.ts`) so upper room faces and badges remain fully visible.
- **Wall-Mounted Items (`tv`, `board`, `legoBoard`)**: Hang flush against the south face of solid horizontal walls (`apps/api/src/office/layout/mount.ts`, `apps/web/game/layout/mount.ts`), validated with `NOT_ON_WALL`. Existing layouts are automatically migrated on API startup (`apps/api/src/workspace/layout-migration.service.ts`).

## 12. Development switcher (dev only)

**Code:** `apps/web/features/dev/`, `apps/api/src/dev/` · **Internals:** [docs/code/testing.md](code/testing.md), [docs/code/auth.md](code/auth.md)

The development switcher provides rapid 1-click test identity switching and test persona creation on `/login` and `/register` (`apps/web/features/dev/DevSwitcher.tsx`). It allows developers and automated test suites to mint sessions, switch between workspace members, or join offices without manual credential entry or 2FA verification.

- **Production gating**: The dev switcher is strictly disabled in production. Enabled only when `isDevLoginEnabled` is true (`DEV_LOGIN === 'true'` and `NODE_ENV !== 'production'` in `apps/api/src/config/app-config.ts`). In production, `DevModule` is never imported—endpoints under `/api/auth/dev/*` and the `apps/api/src/dev/dev.gateway.ts` socket gateway do not exist. `GET /auth/dev` returns `{ enabled: false }`.
- **UI integration**: `DevSwitcherGate` wraps auth pages and renders the switcher only when dev mode is active (with a "Use the real sign-in" link to test standard forms). Inside the office, `UserMenu` provides a "Switch user (dev)" option.
- **Test hooks**: `useDevHooks` (`apps/web/features/dev/devHooks.ts`) installs `window.__devpulse` test utilities (instant teleportation via `dev:teleport` socket event in `apps/api/src/dev/dev.gateway.ts`, player coordinates) and applies performance caps for headless testing (`__devpulseFps`, `__devpulseLowRes`). In production, `window.__devpulse` is undefined.
