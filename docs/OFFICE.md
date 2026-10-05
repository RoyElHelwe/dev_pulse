# Office, onboarding and invitations

**Owners:** Roy (office, onboarding, editor, zones) · Mira (invitations, members)
**Code:** `apps/api/src/{office,workspace,invitations}`, `apps/web/game`, `apps/web/features/{office,onboarding,team,workspace}`

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
which side the meeting rooms are on, so the wizard's preview is the office you get.
`generated.spec.ts` builds every size from 1 to 100 with several seeds and checks
`validateLayout` finds nothing. The API takes `teamSize` (1–100) with `templateId:
'generated'` (`POST /api/workspace`; `PUT /api/workspace/template`, where it defaults to the
number of members), and `GET /api/office/templates?team=12&seed=<name>` previews it.

The owner can move everyone to another template later (Team page → Office layout), or back
to the original furniture of the current one. It's refused when the team doesn't fit
(more people than desks) or someone saved the office meanwhile.

Zones (desks, meeting rooms, lounges) are derived from the layout, so they follow the
furniture when the office is edited.

### Live presence without lag

- The `/office` socket joins your office on connect (cookie auth, live session and
  membership checked) and sends who is there.
- While walking, positions go out ~20 times a second as tiny arrays `[x, y, dir, moving]`,
  sent **volatile** (a late position is dropped, never queued) and never back to your own
  tabs. The server clamps positions to the office and drops floods (> 40/s).
- Other people are drawn 100 ms in the past and interpolated between positions, so they
  move smoothly even when packets arrive unevenly; a big jump (reconnect) teleports.
- Locally ~1 ms per move through the server.
- Sockets connect straight over WebSocket (no HTTP long-polling first). If the connection
  drops, a "Reconnecting…" banner shows and everything resyncs when it's back.

## 5. Life in the office

| What | How it works | Code |
| --- | --- | --- |
| **Nearby** | Another person within 3 tiles **in the same room** (walls, even glass, separate people) → `player:near`, then `player:distance` up to 5×/s, `player:far` past 3.5 tiles. The people list tags them "Nearby". | `game/systems/Proximity.ts` |
| **Your desk** | Each member gets a free desk on joining (joining order), with their name on it (yours in green). Desks follow the office: after an edit people keep their desk if it still exists. Owners and admins move people from the Team page (swaps with whoever sat there). | `workspace/desks.service.ts`, `game/objects/DeskPlates.ts` |
| **E to use** | At a desk or in front of a screen, a hint appears ("Your desk", "Mira’s desk", "Desk 4 · free"); **E** (or tapping the hint) emits `object:interact`. | `game/systems/Interactions.ts` |
| **Who is where** | The game reports its zone; the server shares it (`office:zone`). The people list shows "Atlas · Meeting room", "At Mira’s desk"; meeting rooms with people inside show "In use · 2". | `office.gateway.ts`, `game/objects/RoomBadges.ts` |
| **Status** | A short status in a bubble over the avatar ("Focusing", "On break ☕" or your own text), set from your chip (bottom left), stored on the membership. | `CharacterSwitcher.tsx` |
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
```

Every `on` returns its own "off", handy in `useEffect`. The status bubble is
`PATCH /api/workspace/me { status }` (e.g. the current task); it reaches everyone live.

### Characters and desks are generated (`apps/web/game/art/`)

A character is a **recipe**: 18 choices (build, height, skin, hairstyle and colour, beard,
glasses, top, colours, pattern, bottom, shoes, hat, desk vibe). `WorkspaceMember.character`
holds one of the 8 named presets (`maya`, `sam`…) or the recipe as a 19-character code
(`1` + one base-36 digit per choice). The pickers offer the presets plus freshly generated
characters ("New faces"); the API checks codes with `IsCharacter()`
(`apps/api/src/workspace/characters.ts`, keep `DNA_SIZES` in sync with `recipe.ts`).

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
| Room channel | the room the server itself places you in (`OfficeGateway.locate`), never what the client says (`NOT_IN_ROOM`) |
| Booked room | while a booking runs, only its attendees read and write (`NOT_ATTENDEE`) |

- Socket `/office`: the client sends `chat:send { channel, text }` and gets an ack
  `{ ok: true, message }` or `{ ok: false, error: { code, message } }` (shown under the input).
  Everyone allowed receives `chat:message { id, channel, userId, name, text, createdAt }`:
  the office channel goes to the whole office, a room channel only to the people in that room.
- `GET /api/workspace/chat?channel=office|<room id>&before=<ISO date>` → `{ messages, more }`,
  the last 50, oldest first; same room and booking rules.
- Messages are stored in `ChatMessage` (channel `office` or a layout room id).

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

## 7. API

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/office/templates` | signed in | templates (name, team size, layout for the preview) |
| POST | `/api/workspace` | no office yet | `{ name, templateId, character, teamSize? }` (teamSize for `generated`) → you are the owner |
| GET | `/api/workspace` | member | office, layout, version, your role and character |
| PATCH | `/api/workspace` | owner, admin | `{ name }` |
| POST | `/api/workspace/delete` | owner | `{ confirmName }` |
| PATCH | `/api/workspace/me` | member | `{ character?, status? }` (empty status = none) |
| PUT | `/api/workspace/layout` | owner, admin | `{ version, furniture, rooms: [{ id, name }] }` |
| PUT | `/api/workspace/template` | owner | `{ templateId, version, teamSize? }` (generated: defaults to the member count) |
| GET | `/api/workspace/members` | member | with their `deskId` |
| PATCH / DELETE | `/api/workspace/members/:userId` | owner (or yourself to leave) | `{ role }` |
| PUT | `/api/workspace/members/:userId/desk` | owner, admin | `{ deskId }` (null = no desk) |
| POST / GET | `/api/workspace/invitations` | owner, admin | `{ email, role }` |
| POST | `/api/workspace/invitations/:id/resend` | owner, admin | new link |
| DELETE | `/api/workspace/invitations/:id` | owner, admin | revoke |
| GET | `/api/invitations/:token` | public | what the invitation page shows |
| POST | `/api/invitations/:token/accept` | signed in, invited email | `{ character? }` → join |
| POST | `/api/invitations/:token/decline` | public | |

`GET /api/workspace` also returns `status`, `deskId` and `desks` (who sits where).

Socket `/office`: `office:state`, `office:joined`, `office:moved`, `office:left`,
`office:layout`, `office:updated` (character / role / status), `office:zone [id, zone]`,
`office:desks`, `office:removed` (`removed` / `deleted`); the client sends `move` and
`zone`.

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
  `MeetingsService.activeBooking(workspaceId, roomId)` and refuse non-attendees.
- People in a meeting get a toast when it starts.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/api/workspace/bookings?from&to` | member | bookings of every meeting room (default today → +7 days, 62 days at most) |
| POST | `/api/workspace/bookings` | member | `{ roomId, title, startsAt, endsAt, attendeeIds, timeZone? }` (`timeZone` only words the errors) |
| DELETE | `/api/workspace/bookings/:id` | creator, owner, admin | cancel (not once it's over) |

Every change sends `office:bookings` on the `/office` socket; clients reload the list, and
re-check every minute which rooms are closed to them (`controller.setLockedRooms`).
Rules and their tests: `meetings/booking-rules.ts`.
