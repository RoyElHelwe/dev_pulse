# Office, onboarding and invitations

**Owners:** Roy (office, onboarding, editor, zones) · Mira (invitations, members)
**Code:** `apps/api/src/{office,workspace,invitations,games}`, `apps/web/game`, `apps/web/features/{office,onboarding,team,workspace,games}`

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
| Move the office to another template, delete it | ✔ | | |
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
Five templates in `apps/api/src/office/templates`:

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

Loft only. When a team outgrows the initial 8 desks, owners and admins can expand the office by adding generated wings (`POST /api/workspace/wings`).

- **Rules**: Caller must be `OWNER` or `ADMIN`. The side must be `LEFT`, `RIGHT`, or `BOTTOM`.
- **Generation**: The new wing attaches to the current outer edge of the office, adding ~8 desks plus a generated meeting room or lounge from a seed. A door is automatically cut in the shared wall.
- **Transformations**:
  - `LEFT`: Translates existing office content and furniture so IDs stay; previously recorded wing x/y coordinates shift accordingly.
  - `BOTTOM`: Moves spawn/entrance to the new outer wall.
- **Validation & State**: The resulting layout is validated (`validateLayout`). Bumps `layoutVersion` and emits live `office:layout` and `office:desks` socket events.
- **Storage**: Recorded in the `OfficeWing` table (`workspaceId`, `side`, `seed`, `x`, `y`, `w`, `h`, `deskCount`). Switching template deletes wings.
- **Chill room wing** (`POST /api/workspace/wings/chill`): Any office template can add a dedicated chill room wing (`side: 'LEFT' | 'RIGHT' | 'BOTTOM'`). Unlike regular wings, it adds a dedicated games room with 0 desks. Allowed once per office (refused with `CHILL_EXISTS` if a chill room already exists). `GET /api/workspace` returns `canAddChill: true` when caller is OWNER/ADMIN and the office has no chill room yet. Team page shows a persistent "Chill room added" status (data-testid `chill-added`) after adding a chill room.
- **Code**: Lives in `apps/api/src/office/layout/wings.ts`. Web mirrors nothing, layout is data.

### Live presence without lag

- The `/office` socket joins your office on connect (cookie auth, live session and
  membership checked) and sends who is there.
- While walking, positions go out ~20 times a second as tiny arrays `[x, y, dir, moving]`,
  sent **volatile** (a late position is dropped, never queued) and never back to your own
  tabs. The server clamps positions to the office, drops floods (> 40/s) and ignores jumps
  faster than walking (1.6 × walking speed + 1 tile of slack; the first position after a
  connect and the entrance, within 3 tiles of the spawn, are always accepted). Walls aren't
  checked by the server: its positions are the client's, speed-limited so nobody can jump
  into a room; booked rooms are protected by the attendee check.
- Other people are drawn 100 ms in the past and interpolated between positions, so they
  move smoothly even when packets arrive unevenly; a big jump (reconnect) teleports.
- The move packet is `[x, y, dir, moving, seated]` (the 4-item form is still accepted); the
  server relays `office:moved` as `[id, x, y, dir, moving, seated]`. `seated` is just relayed.
- Depth: furniture, people and desk plates are y-sorted together by their bottom edge/feet
  (`DEPTH.sorted` in `OfficeScene`), so people hide behind what they stand behind. Seated
  people draw just above their chair.
- Sitting: stand on a free chair/stool (or against an armchair) for ~0.5 s and you snap to the
  seat, facing the way the chair faces (stool: keep facing); hold a movement key ~0.5 s to
  stand up and step off. A seat with someone seated on it is not free. `controller.snapshot()`
  gives `dir` and `seated` for you and for everyone else.
- Locally ~1 ms per move through the server.
- Sockets connect straight over WebSocket (no HTTP long-polling first). If the connection
  drops, a "Reconnecting…" banner shows and everything resyncs when it's back.

### One office tab at a time

The `/office` handshake sends auth `{ tabId, takeover }` (`tabId` is random per page load).
The server (`OfficeGateway` + `claimOffice` in `office/rules.ts`) refuses a connection while
the same user has another tab's socket live with `connect_error` `ALREADY_OPEN` (also `office:busy`
event if two race). `takeover: true` (set only by the "Use here" button) emits `office:replaced`
to the old tabs and disconnects them without the avatar leaving; same tabId reconnecting
(network loss) silently replaces its stale socket. A replaced tab doesn't auto-reconnect;
takeover flag is reset after each connect so a tab that was offline can't steal the office back.
Web: `features/office/connection.ts`, `tabLockStore.ts` (store), `tabLockStore.tsx` (overlay rendered in
`OfficeView`). Works across browsers/devices of the same account.

## 5. Life in the office

| What | How it works | Code |
| --- | --- | --- |
| **Nearby** | Another person within 3 tiles **in the same room** (walls, even glass, separate people) → `player:near`, then `player:distance` up to 5×/s, `player:far` past 3.5 tiles. The people list tags them "Nearby". | `game/systems/Proximity.ts` |
| **Your desk** | Each member gets a free desk on joining (joining order), with their name on it (yours in green). Desks follow the office: after an edit people keep their desk if it still exists. Owners and admins move people from the Team page (swaps with whoever sat there). | `workspace/desks.service.ts`, `game/objects/DeskPlates.ts` |
| **Moving desks** | Any member can move to another free desk (`PUT /api/workspace/me/desk`). Desk art follows the owner. Refused if taken (`DESK_TAKEN`). Emits `office:desks`. | `workspace/desks.service.ts` |
| **E to use** | At a desk, screen, task board, or games piece (Baby foot, card table, Lego wall), a hint appears ("Your desk", "Play Baby foot", "Play Uno", "Build with Lego"); **E** (or tapping the hint) emits `object:interact`. | `game/systems/Interactions.ts` |
| **Who is where** | The game reports its zone; the server shares it (`office:zone`), for display only (access uses positions). The people list shows "Atlas · Meeting room", "At Mira’s desk"; meeting rooms with people inside show "In use · 2". | `office.gateway.ts`, `game/objects/RoomBadges.ts` |
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
- **Paper stacks**: `OfficeView` feeds `useOpenTaskCounts()` to `controller.setTaskCounts(Map<userId, n>)`; the
  scene maps it to desk ids (`setDeskPapers`) and redraws changed desks (`drawDesk` option `papers`: one sheet per
  task up to 8, a clip beyond; none at 0). The texture key includes the count (capped at 9).

### Characters and desks are generated (`apps/web/game/art/`)

A character is a **recipe**: 18 choices (build, height, skin, hairstyle and colour, beard,
glasses, top, colours, pattern, bottom, shoes, hat, desk vibe). `WorkspaceMember.character`
holds one of the 8 named presets (`maya`, `sam`…) or the recipe as a 19-character code
(`1` + one base-36 digit per choice). The pickers offer the presets plus freshly generated
characters ("New faces"); the API checks codes with `IsCharacter()`
(`apps/api/src/workspace/characters.ts`, keep `DNA_SIZES` in sync with `recipe.ts`).

**Character studio** (`features/workspace/CharacterStudio.tsx`, controlled: `value` / `onChange(code)`):
4-direction preview, desk preview, Random / "Change a little", the 8 presets, and part pickers
(Body, Hair & face, Outfit, Extras). It saves the 19-character code and is used in onboarding,
the invitation page and the office "You" chip (Edit → Customise character, a dialog with Save).
Onboarding has no headcount question: Loft is preselected ("grows with your team"); the generated
office offers Small (~8) / Medium (~24) / Large (~48).

| File | What |
| --- | --- |
| `color.ts`, `palette.ts` | Every colour, as OKLCH ramps (shadows cooler, highlights warmer) |
| `recipe.ts` | Choices, codes, presets, random characters with contrast rules, mutate / breed |
| `character.ts` | Draws a character in layers, 4 directions, moods, headset, mug |
| `desk.ts` | A desk decorated for its owner: anchor slots, props by vibe, their colours; free desks stay bare |
| `pen.ts` | One drawing interface for Phaser, canvas and SVG (the React previews use the same code) |
| `lab/` | The art lab page: a simulated day at the office, a character studio, a lineup |

- The status sets the face: "Focusing" → focused, "On break ☕" → smiling with a mug.
- `Avatar.setInCall(inCall, talking)` puts the headset on (Z3/Z4: call it when a call starts and ends).
- Each avatar frame is drawn once into a texture shared by everyone with the same recipe
  (Phaser redraws Graphics shapes every frame). Desks are re-drawn when their owner changes.

### Chat

**Code:** `apps/api/src/chat`, `apps/web/features/chat`

A chat button bottom left (above your chip) with an unread count opens the panel. Two tabs:
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

### Task board and the Esc key (`features/tasks/`, `lib/escape.ts`)
- **Board**: Jira-style global Kanban (columns To do / In progress / In review / Done, cards with key, type,
  priority, assignee face, due date). Filters: search, assignee avatars (multi-select, "Unassigned"), "Only my
  issues". Cards drag between/within columns (native HTML5 DnD, rank = midpoint of the neighbours, optimistic
  with rollback; no touch drag: change the status in the card dialog). Click a card = edit dialog (delete only
  for the reporter or OWNER/ADMIN, same rule as the API). Live through `task:*` on `/office`.
- **Opening**: E at a wall `board` (furniture kind, `Interactions` target type `kanban`), E at *your* desk
  (opens filtered to you), or the HUD "Board" button (offices without a wall board). It is a normal-flow block
  at the top of `OfficeView` (flex column): it drops down and the office + HUD sit below it (the canvas resizes).
  While focus is inside an element with `data-captures-keys`, `isTyping()` is true so the game ignores keys.
- **Store**: `features/tasks/store.ts`: `useTaskSync(socket)` (mounted once in OfficeView), `useTasks()`,
  `useOpenTaskCounts()` / `countOpenTasks(tasks)` (open = status != DONE, per assignee) and `taskActions`.
- **Esc**: `useEscape(active, handler)` (`lib/escape.ts`) keeps a stack of open layers; Escape closes only the
  top-most one (dialog over board, popover over panel); with none open the key is untouched. Chat, Rooms,
  user menu (+ its character and keybinds modals), people list, board and task dialogs register. New menus must register too.

### User menu and keybinds (`features/auth/UserMenu.tsx`, `features/settings/keybinds.ts`)
- **User menu** (top right) is portaled to `document.body` (z-60, modals z-70) so it sits above the HUD, board and
  panels. It is the one place for **Character** (modal with the full `CharacterStudio`), **Status** (presets, custom
  text, clear) and **Keybinds**; Character/Status only appear inside the office (they need the office profile).
  The old bottom-left "You" chip is gone. Shared `components/ui/Modal.tsx` (portal, Esc layer, `data-captures-keys`).
- **Keybinds**: actions interact E, mute M, deafen H, push-to-talk V, chat C, board B, rooms T, people P. Stored per
  user in `UserSettings.keybinds` (Json, only non-default entries; `pushToTalkKey` stays the column for PTT and is
  overlaid as `keybinds.pushToTalk`). `GET/PATCH /api/settings` return/accept `keybinds`; the API refuses unknown
  actions, bad codes, reserved keys (WASD, arrows, Esc, Enter, Tab) and duplicates (`settings/keybinds.ts`).
  Web: one store (`useKeybinds`, `getKeybinds`, `useKeybind(action, fn, enabled)`, `rebind`, `resetKeybinds`); every
  listener reads it (VoiceControls, OfficeScene E, chat/board/rooms/people toggles). /settings/voice rebinds PTT
  through the same store. New shortcuts: add the action in both `keybinds.ts` files (legacy Baby foot actions `foosKick` and `foosSwitch` were removed; stored values are ignored and `PATCH /settings` silently drops them).

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
2. **On save** the API checks everything again (`office/layout/validate.ts`) and also walks
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

- `cd apps/api && pnpm test`: every template is valid (inside, no overlaps, everything
  reachable, enough desks), and the validator refuses each kind of broken layout.
- **Browser tests** in `e2e/` (Playwright), run by CI on every push: one story with an
  organiser, a teammate and a phone: create an office, invite, pick a character, "Nearby",
  status, walk to your desk and press E, meeting room presence, desk swap, editor (overlap
  refused, multi-select, save reaches the others), concurrent saves, template switch,
  joystick, removal, and a clean console throughout. The players really walk: a path is
  planned on the layout and followed with the arrow keys.

```bash
# with the API on :4100 and the web app on :3000 (any way you like)
cd e2e && pnpm install && pnpm exec playwright install chromium
pnpm serve &        # same-origin proxy on :8080, like nginx
pnpm test
# or against Docker: E2E_BASE_URL=https://localhost:8443 pnpm test (after `make`)
```

## 9. Meeting rooms

**Code:** `apps/api/src/meetings`, `apps/web/features/meetings`

**Rooms** (top right) opens a day timetable: one column per meeting room, 08:00–20:00 in
30-minute rows, today with previous / next day, in your own time zone. Bookings show their
title, time and people (yours in green). Click a free slot, or drag over several, to book:
title, room, start / end (15-minute steps) and who is invited. Click a booking for its
details; its creator, or an owner / admin, can cancel it.

| Rule (checked by the API) | |
| --- | --- |
| Room | a meeting room of the current layout |
| Time | start before end, 15-minute steps, 4 hours at most, not in the past (the slot running now is fine), up to 30 days ahead |
| People | members of the office, 30 at most; the creator is always one of them |
| No double booking | refused with "Atlas is booked 14:00–15:00 by Mira". Race-free: each booking takes a Postgres advisory lock for its room (`pg_advisory_xact_lock`) inside the transaction that checks and inserts |

**During a meeting only its people get in.**

- The game makes the room solid for everyone else (a collider over the whole room closes
  its doors). Someone already inside when it starts is sent back to the entrance with
  "Atlas is booked until 15:00". The badge over the door says "Booked · until 15:00".
- The server can't move people, so audio and chat check too: they ask
  `MeetingsService.activeBooking(workspaceId, roomId)` (cached a few seconds per room, cleared
  when a booking is made or cancelled) and refuse non-attendees.
- Once two people are connected, audio is peer to peer: the server only gates who may start
  a call (`rtc:signal` reaches only the tab that joined voice), and each client hangs up when
  the other leaves range or a booking excludes them.
- **Spatial sound** (`features/voice/spatial.ts`, applied by `VoiceManager.tick` every 150 ms; the
  server's `talk-rule` is unchanged: meeting room = whole room, elsewhere earshot). Each call has
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
Rules and their tests: `meetings/booking-rules.ts`.

## 10. Chill room and games

**Code:** `apps/api/src/games`, `apps/web/features/games`

Interactive games and break room framework for casual multiplayer activities.

### Room kind and furniture

- **Room kind `chill`**: Defined in `RoomKind` (`'open' | 'meeting' | 'lounge' | 'chill'`). Voice talk-rule (`withinEarshot`) treats `chill` rooms like lounges (earshot radius, not whole room).
- **Furniture**:
  - `foosball`: Baby foot table (3 × 1.6 tiles, solid obstacle).
  - `cardTable`: Round card table for Uno (2.2 × 2.2 tiles, solid obstacle). Surrounded by 6 sittable chairs.
  - `legoBoard`: Wall-mounted Lego building surface (3 × 0.5 tiles, solid obstacle). Wall-mounted on a tall wall face like `board` (validated with `NOT_ON_WALL`).
- **Loft chill room**: Loft template includes a default 11 × 12 chill room (`id: 'chill'`, name "Chill room", terrazzo floor) equipped with 1 Baby foot table, 1 cardTable surrounded by 6 chairs, 1 legoBoard on the north wall (flush on its south face, off to the right beside the room name), rug, and plant.
- **Chill room wing** (`POST /api/workspace/wings/chill`):
  - Owner or admin can add a chill room wing (`side: 'LEFT' | 'RIGHT' | 'BOTTOM'`) to **any** template (unlike regular desk wings which are Loft only).
  - Reuses wings machinery (shared wall door cut, layout validation), adding a chill room with `deskCount: 0`.
  - Maximum one chill room per office: rejected with error `CHILL_EXISTS` if any room already has kind `chill`.
  - `GET /api/workspace` returns `canAddChill: true` when caller is OWNER/ADMIN and the office has no chill room yet.
  - Team page shows a persistent "Chill room added" status (data-testid `chill-added`) after adding a chill room.

### Interaction types and flow

1. **Approach**: Walking near a games piece displays a contextual interaction hint:
   - Baby foot: "Play Baby foot" (default dialog name "Baby foot table")
   - Card table: "Play Uno"
   - Lego wall: "Build with Lego"
2. **Interact (E)**: Pressing **E** (or tapping hint) causes `Interactions.ts` to emit `object:interact` on `officeEvents`:
   - Payload: `{ type: 'foosball' | 'uno' | 'lego', id: string, name: string }` (where `id` is the furniture ID).
3. **GameHost full-screen overlay**:
   - Games open FULL SCREEN, not a centered modal: `GameHost` (mounted in `OfficeView.tsx`) catches the event and opens a fixed `inset-0 z-[70]` opaque overlay (`role="dialog"`, `aria-label` = game name, `data-captures-keys=""`, `onKeyDown`/`onKeyUp` `stopPropagation` so walking keys do not move the avatar).
   - Slim top bar: game name, "N playing"/"N watching" pills fed by `useGameChromeInfo({players, spectators})` from `features/games/GameChrome.tsx` (panels call it every render), a Leaderboard toggle (floating card, `data-testid="game-leaderboard-toggle"`), a Leave button (`data-testid="game-leave"`) and the X (`aria-label="Close game"`).
   - Both Leave and X emit `game:leave` and close; Esc closes through `useEscape`. No backdrop click-to-close.
   - On open it requests the browser Fullscreen API (`document.documentElement.requestFullscreen`, ignored if refused; exits on close); the in-page full-viewport layout works without it.
   - Panels fill `h-full w-full min-h-0` of the content area inside a `<Suspense>` boundary; Baby foot letterboxes the 7:4 table, Uno cards and the Lego grid scale with the area.
   - Office HUD is covered underneath, the office keeps running (voice continues).
   - *Note for tests*: browser fullscreen blocks `page.setViewportSize`, call `document.exitFullscreen()` first.
4. **Close**: Clicking Leave (`data-testid="game-leave"`), close X (`aria-label="Close game"`), pressing Escape, or calling `onClose` emits `game:leave { id }`, exits fullscreen, and unmounts the overlay. No backdrop click-to-close.

### API framework

- **Modules** (`apps/api/src/games`):
  - `GamesCoreModule` (`games-core.module.ts`): provides and exports `GamesRegistry` and `GameResultsService`. Imports `PrismaModule`.
  - Game modules: `FoosballModule`, `UnoModule`, `LegoModule`. Each imports `GamesCoreModule` and in `onModuleInit()` registers its `GameDefinition` in `GamesRegistry`.
  - `GamesModule` (`games.module.ts`): imports `GamesCoreModule`, `FoosballModule`, `UnoModule`, `LegoModule`, and `OfficeModule`. Provides `GamesGateway` and `GamesSessionManager`. Controller: `GamesController`. Imported into `AppModule`.
- **Core signatures** (`game.types.ts`):
  ```ts
  export type GameKind = 'foosball' | 'uno' | 'lego';
  export interface GamePlayerRef { userId: string; name: string; character: string; }

  export interface GameContext {
    readonly workspaceId: string;
    readonly objectId: string;
    readonly kind: GameKind;
    participants(): GamePlayerRef[];
    emitState(): void;
    emitEvent(event: string, data?: unknown, only?: string[]): void;
    record(r: { winners: string[]; losers: string[] }): Promise<void>;
    close(): void;
  }

  export interface GameInstance {
    onJoin(p: GamePlayerRef, intent: unknown): void;
    onLeave(userId: string, reason: 'left' | 'far' | 'disconnected'): void;
    onAction(userId: string, action: unknown): void;
    view(userId: string): unknown;
    dispose(): void;
  }

  export interface GameDefinition {
    kind: GameKind;
    furnitureKind: FurnitureKind;
    create(ctx: GameContext): GameInstance;
  }

  export class GameError extends Error {
    constructor(public readonly code: string, message: string) { super(message); }
  }
  ```
- **Session lifecycle**:
  - `GamesSessionManager` maintains sessions in memory keyed by `${workspaceId}:${objectId}`, lazily creating on first join and disposing when empty or when `ctx.close()` is called.
  - Participants join socket room `game:${workspaceId}:${objectId}`.
  - **One active game per user**: joining another game automatically leaves the previous session (`reason: 'left'`).
  - **Disconnect**: socket disconnect calls `sessionManager.handleDisconnect(userId)` (`reason: 'disconnected'`).
  - **Rate limiting**: `Budget(60)` per socket (~60 msgs/s); excess messages receive `game:error` with code `RATE_LIMIT`.
  - **Proximity rules** (`apps/api/src/games/proximity.ts`):
    - On `game:join`: player must be within 4 tiles (`JOIN_PROXIMITY_TILES = 4`) of furniture center via `OfficeGateway.locate`. Error `NOT_NEAR` if too far.
    - Periodic sweep: `GamesSessionManager.sweepProximity()` runs every 1 second (`setInterval`). If participant's distance exceeds 7 tiles (`LEAVE_PROXIMITY_TILES = 7`) or player left office, auto-evicts with `leave(..., 'far')` and emits `game:left { id, reason: 'far' }`.
- **Game results and leaderboard**:
  - `GameResultsService.record({ workspaceId, game, winners, losers })`: inserts a record into Prisma `GameResult` table (`id`, `workspaceId`, `game`, `winners: String[]`, `losers: String[]`, `createdAt`, cascade delete with Workspace, indexed by `[workspaceId, game, createdAt]`).
  - Aggregation (`aggregateLeaderboard`): pure function aggregating match rows over a `days` window. 1 win & 1 game per unique winner, 1 loss & 1 game per unique loser. Sorted by `wins desc`, `losses asc`, `games desc`. Top 10 entries returned.
  - Endpoint `GET /api/workspace/games/leaderboard?game=foosball|uno|lego&days=7`: member-only, query parameters `game` and `days` (integer 1–90, default 7). Returns `{ game, days, entries: [{ userId, name, character, wins, losses, games }] }`.

### Socket protocol (`/office` namespace)

| Event | Direction | Payload | Description |
| --- | --- | --- | --- |
| `game:join` | Client → Server | `{ game: GameKind, id: string, intent?: unknown }` | Joins session. Validates object existence, matching furniture kind, budget, and proximity (≤ 4 tiles). Auto-joins socket room. |
| `game:leave` | Client → Server | `{ id: string }` | Leaves session (`reason: 'left'`). Leaves socket room. |
| `game:action` | Client → Server | `{ id: string, action: unknown }` | Sends game action. Rate-limited. Game validates and executes; throws `GameError` on bad move. |
| `game:state` | Server → Client | `{ id: string, game: GameKind, state: unknown }` | Viewer-specific state (`instance.view(userId)`). Sent on join and whenever `ctx.emitState()` is called. |
| `game:event` | Server → Client | `{ id: string, event: string, data?: unknown }` | Transient game event (e.g. goal scored, cards dealt). Sent to all session participants or specified `only` user IDs. |
| `game:left` | Server → Client | `{ id: string, reason: 'left' \| 'far' \| 'closed' }` | Emitted to leaving user (or all participants on close). |
| `game:ended` | Server → Client | `{ id: string, result?: unknown }` | Sent when match concludes or session closes (`{ reason: 'closed' }`). Triggers leaderboard refresh in client. |
| `game:error` | Server → Client | `{ id?: string, code: string, message: string }` | Emitted to sender on failure. Error codes: `BAD_REQUEST`, `NOT_FOUND`, `WRONG_GAME`, `NOT_NEAR`, `RATE_LIMIT`, `INTERNAL_ERROR`, or custom `GameError` code. |

### Web framework (`apps/web/features/games`)

- **Types & Props** (`types.ts`):
  ```ts
  export interface GamePanelProps {
    objectId: string;
    name: string;
    socket: Socket;
    me: { id: string; name: string; character: string };
    onClose: () => void;
  }
  ```
- **`useGameSession` API** (`useGameSession.ts`):
  ```ts
  const { state, status, error, send, join, leave, onEvent } = useGameSession<GameState>(
    socket,
    gameKind,
    objectId,
    intent?,
  );
  ```
  - `status`: `'joining' | 'joined' | 'left' | 'error'`.
  - `error`: `{ code: string; message: string } | null`.
  - Automatically emits `game:join` on mount and `game:leave` on unmount.
  - Exposes `send(action)` for player actions and `onEvent((event, data) => void)` for transient events (e.g. sounds, goals).
- **Registry** (`registry.ts`):
  - `GAME_PANELS: Record<GameKind, ComponentType<GamePanelProps>>` uses `next/dynamic` to lazily load `./foosball/FoosballPanel`, `./uno/UnoPanel`, and `./lego/LegoPanel`.
- **`GameHost`** (`GameHost.tsx`):
  - Mounted once in `OfficeView.tsx`.
  - Manages active game full-screen overlay: fixed `inset-0 z-[70]` opaque overlay (`role="dialog"`, `aria-label` = game name, `data-captures-keys=""`, `onKeyDown`/`onKeyUp` `stopPropagation`).
  - Top bar with game name, "N playing"/"N watching" pills (`useGameChromeInfo`), Leaderboard toggle (`data-testid="game-leaderboard-toggle"`), Leave button (`data-testid="game-leave"`), and close X (`aria-label="Close game"`).
  - Requests browser Fullscreen API on open (`requestFullscreen`), exits on close. Esc layer handled via `useEscape`. Panels fill `h-full w-full min-h-0`.
- **`Leaderboard`** (`Leaderboard.tsx`):
  - Floating card toggled from top bar (`data-testid="game-leaderboard-toggle"`), rendering top players this week with rank, `CharacterFace`, player name, and `W / L` statistics (e.g. Baby foot leaderboard).
  - Automatically re-fetches leaderboard on `game:ended` socket event.

### Keybind actions for games

Rebindable key actions for games must be declared on both sides (Baby foot no longer has any key actions as its controls are mouse-only; legacy actions `foosKick` and `foosSwitch` were removed, stored values are ignored, and `PATCH /settings` silently drops them):
- **Web** (`apps/web/features/settings/keybinds.ts`): add action to `KEYBIND_ACTIONS`, default key to `DEFAULT_KEYBINDS`, and description to `KEYBIND_LABELS`. Access in components via `useKeybind('<action>')` or `matchesKey(e, '<action>')`.
- **API** (`apps/api/src/settings/keybinds.ts`): add action to `ACTIONS`, default key to `DEFAULT_KEYBINDS`, and label to `ACTION_LABELS`.
- Reserved keys (`WASD`, arrow keys, `Escape`, `Enter`, `Tab`) cannot be rebound.

### How to add a game (checklist for steps 12–14: Baby foot, Uno, Lego)

1. **Replace API stub module** (`apps/api/src/games/<game>/<game>.module.ts`):
   - Implement game state, turn flow, timers (`setInterval`), and rules inside a class or factory returning `GameInstance`.
   - Clean up any timers/listeners in `dispose()`.
   - Register the definition in `onModuleInit()`: `this.registry.register({ kind, furnitureKind, create: (ctx) => ... })`.
2. **Replace Web panel stub** (`apps/web/features/games/<game>/<Game>Panel.tsx`):
   - Replace stub component with interactive game UI (keep default export for dynamic import).
   - Use `useGameSession<State>(socket, '<game>', objectId)` to sync state and dispatch moves via `send(action)`.
3. **Record match results**:
   - On game completion, invoke `await ctx.record({ winners: [userId, ...], losers: [userId, ...] })`.
   - Broadcast completion with `ctx.emitEvent('ended', result)` or close session with `ctx.close()`.
4. **Write unit tests**:
   - Add tests in `apps/api/src/games/<game>/<game>.spec.ts` testing player join/leave, turns, action validation (`GameError`), forfeit handling, and results recording.
   - Run tests: `docker exec dev_pulse-api-1 pnpm vitest run src/games/<game>`.

### Lego wall (persistent art board, step 14)

**Code:** `apps/api/src/games/lego`, `apps/web/features/games/lego`, `apps/web/game/render/legoArt.ts`

Unlike Baby foot/Uno the Lego wall is not a match: no GameResult, nothing is recorded or ended. It reuses the games framework only for join/leave, proximity and per-viewer game:state; the art itself outlives sessions.

- **Board**: 48 × 32 studs per legoBoard furniture id. A brick is a tuple [x, y, w, h, c] (top-left stud, footprint after rotation, palette index 0–15). Footprints: 1×1, 1×2, 2×1, 2×2, 1×4, 4×1, 2×4, 4×2. Bricks never overlap and stay inside the board.
- **Storage**: table LegoBoard { workspaceId, objectId, bricks Json, updatedAt }, unique on (workspaceId, objectId), cascade with the workspace. One JSON row per board (not a row per brick): a board has at most 1536 bricks (~25 KB), is always read and written whole, and is never queried per brick, so one read on first use and one debounced (400 ms) upsert per burst of edits beats thousands of tiny rows. parseBricks drops anything invalid/overlapping when loading. LegoService keeps the loaded boards in memory (single API process) and flushes on shutdown.
- **Actions** (game:action): {type:'place',x,y,w,h,c}, {type:'remove',x,y} (removes the brick covering that stud), {type:'clear'} (OWNER/ADMIN only, else FORBIDDEN). Errors: INVALID_BRICK, LOADING, RATE_LIMIT (15 actions/s per user, on top of the gateway budget), BAD_REQUEST. View: { ready, w, h, bricks, canClear, players, version }.
- **Live miniature**: /office broadcast lego:art { id, bricks } to the whole workspace (throttled, trailing 300 ms). GET /api/workspace/lego (member) returns { boards: [{ id, bricks }] } for the initial load; LegoSync (mounted in OfficeView) fetches it on connect and applies lego:art to the legoArt store. The wall object's texture key includes the art version, so OfficeScene swaps the texture on change (the footprint is 3 × 0.5 tiles, with the 48 × 32 art drawn on the 3:2 panel on the wall face above it). Until the first fetch lands the old decorative placeholder is shown.

### Baby foot (step 12)

**Code:** `apps/api/src/games/foosball/{foosball.physics,foosball.game}.ts`, `apps/web/features/games/foosball/*`.

- Server-authoritative, 30 Hz tick (4 physics substeps), field 120 x 64 units, 4 rods per side (goalkeeper, defense, midfield, attack). First to 5 wins. Table letterboxes to 7:4 aspect ratio.
- Phases: `lobby` -> `countdown` -> `playing` <-> `goal` -> `ended` (rematch back to lobby). Join as spectator, then `sit`/`stand`; start needs equal teams (1v1 or 2v2).
- Rods: 1v1 owner controls all 4, 2v2 each controls 2. A teammate's absence hands their rods to the partner.
- Leaving/disconnect during a match: if a side is fully absent for 10 s (`GRACE_MS`) it forfeits; result recorded once via `ctx.record`.
- **Controls (MOUSE only)**:
  - The canvas is the pointer surface. Cursor `y` over the table maps to the active rod's position (top edge = rod fully up, bottom edge = fully down, scaled to that rod's travel limit).
  - Pointer lock is requested on the first click while playing (virtual cursor from relative movement), falling back to the plain in-table cursor position when lock is unavailable.
  - Rod selection: clicking within 6 field units of another of your rods selects it (rod chips under the table also select).
  - Kicking: a **FLICK** (vertical cursor speed ≥ 3.5 table-heights/s over ~50 ms) kicks with strength from speed (0.35..1). A **CLICK** that does not select a rod kicks with strength `max(0.6, speed strength)`. Kick cooldown is 0.35 s.
  - Client sends `aim` at most every 33 ms.
  - Keyboard actions `foosKick` and `foosSwitch` were REMOVED from both keybind lists (stored values are ignored; `PATCH /settings` silently drops those legacy names).
- **Server protocol**:
  - Action `{ type: 'aim', rod, y }`: target pattern offset in field units. Server clamps to the rod's travel limit, ignores outside the playing phase; rod follows at ≤ `ROD_AIM_SPEED = 140` units/s. Validated with `NOT_YOUR_ROD` / `BAD_ACTION` like `move`.
  - Action `{ type: 'kick', rod, strength? }`: strength 0..1 (default 1, clamped to ≥ 0.25; ball speed = `KICK_BALL_SPEED * (0.4 + 0.6 * strength)`).
  - `move { rod, dir }` still exists and cancels an aim target.
  - Rate limiting is the gateway's 60 msgs/s budget plus the capped rod speed.
- Tests: `foosball.physics.spec.ts`, `foosball.game.spec.ts`.

## 11. 2.5D view and wall-mounted items

- **Walls**: Solid thickness 10px, glass 6px; collider = footprint only (`apps/web/game/render/walls.ts` `wallCollider`, `apps/api/src/office/layout/geometry.ts` `wallRect`). Visible face is 80px (2.5 tiles) rising above the wall's base line (`y * 32 + thickness / 2`) with a dark cap on top; `face: false` on a horizontal wall makes it a low wall (cap only, used for the building's south wall). Vertical walls: long cap lifted by 80px + the south end face.
- **Rendering**: `game/render/wallFaces.ts` bakes each wall into textures at scene start (8-tile pieces), one depth-sorted image per piece (`depth = DEPTH.sorted + base / 100000`), so people walk in front/behind. Tall solid faces are cut into 1-tile columns; a column fades to 0.35 alpha (soft, ~1.8 tiles wide, eased ~110ms) when a person stands behind it (feet between the face top and the base line); columns that hide furniture right behind them stay at 0.5. Glass faces are translucent and never fade. No per-frame redraws, only alpha changes. Room names hang on the wall face above their room (beside any hung board/tv), floor fallback near the room's top when no wall fits.
- **Camera**: Bounds extend 140px above and 40px below the office (`VIEW_MARGIN_TOP` / `VIEW_MARGIN_BOTTOM` in `OfficeScene`) so the top rooms' faces, names, bubbles are fully visible; min zoom accounts for it.
- **Wall-mounted kinds `tv`, `board`, `legoBoard`**: (`game/layout/mount.ts` == `api office/layout/mount.ts`): Flush against the south face of a solid horizontal wall with a face, rotation 0, inside one wall segment (not across a door gap); data box is a thin strip in front of the wall (top edge = base line, canonical `y = wall.y + 5/32 + h/2`; tolerance: top edge within 0.5 tile below the base line), art drawn on the face (`legoBoard` 3:2 panel max 64px tall, `board` `w * 32` × ≤60, `tv` 16:9 ≤60px tall; art bottom 8px above the base line; fades with the face behind it). API validation code `NOT_ON_WALL` (and `OVERLAP` between two wall-mounted items). Editor: snaps to the nearest face within 4 tiles, refuses elsewhere ("Hang it flush on a tall wall."), no rotating. Defaults: `legoBoard` 3 × 0.5, `board` 3 × 0.5, `tv` 3 × 0.3.
- **Saved layouts**: Migrated once at API startup (`apps/api/src/workspace/layout-migration.service.ts` using `office/layout/migrate.ts`): each wall-mounted item that isn't valid is snapped to the nearest face wall within 8 tiles (same id, so Lego/board state survives) or dropped; persisted with `layoutVersion + 1`, idempotent.
