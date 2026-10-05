# Handoff

Where the project stands on `simple-infra` (the future `main`) and what each person picks up
next. Details live in **[PLAN.md](PLAN.md)** (who does what), **[AUTH.md](AUTH.md)** and
**[OFFICE.md](OFFICE.md)**.

---

## 1. State today

| Area | State | Doc |
| --- | --- | --- |
| Infrastructure: web + api + db + nginx (HTTPS), `make` / `make dev` | ✅ | README |
| Auth: email/password, Google/GitHub/42, 2FA, JWT access + rotating refresh, one device at a time | ✅ | AUTH.md |
| Office rendering (R1), multiplayer (R2), onboarding (R3), templates + office editor (R5) | ✅ | OFFICE.md |
| Invitations (M4), members and roles (M5) | ✅ | OFFICE.md |
| Privacy Policy, Terms of Service (F1) | ✅ | |
| Zones / proximity / interactions (R4) | **next for Roy**, blocks Zakaria | §3 |
| Tasks, voice, meeting room (Zakaria) | not started | PLAN.md |
| Profile, friends (Mira M3, M7), chat + chill room (H1, H2) | not started | PLAN.md |

## 2. Run it

```bash
make            # production build at https://localhost:8443 (accept the self-signed cert)
make dev        # hot reload
make db         # after editing apps/api/prisma/schema.prisma
make logs s=api # emails (invitations, password reset...) are printed here without SMTP
```

Try the whole journey: sign up → create an office → **Invite** (top right) → copy the link →
open it in a private window → sign up → join. Both windows see each other walk. As the
organiser, **Edit office** rearranges it live for everyone.

Checks before every push: `pnpm typecheck` in `apps/web` and `apps/api`, `pnpm test` in
`apps/api`, and no errors in the Chrome console.

## 3. Roy: what's next

In order. **R4 first**: it's on the critical path (R4 → Z3 proximity voice → Z4 meeting room).

### R4 — Zones, proximity and interactions (week 3)

The contract is already typed in `apps/web/features/office/events.ts`; only `zone:enter` /
`zone:leave` are emitted today.

1. **Proximity** in `OfficeScene.update()`: for each `RemotePlayer`, distance to the local
   player (in tiles).
   - `player:near { userId, distance }` when it drops under `NEAR_RADIUS` (~3 tiles).
   - `player:distance` while near, at most 5×/s (Zakaria sets the voice volume from it).
   - `player:far` when it goes over `NEAR_RADIUS + 0.5` (hysteresis, so it doesn't flicker).
   - Not across walls: two people on each side of a glass wall shouldn't talk. Simplest rule:
     near only if both are in the same room (rooms are in the layout) or both in the open
     space.
   - Emit `player:far` for everyone when the layout reloads or someone leaves.
   - `OfficeController` needs the user ids: keep the map `id → RemotePlayer` (already there).
2. **Desk per member**: add `deskId String?` on `WorkspaceMember`, give a free desk on join
   (`numberedDesks()` in `office/layout/geometry.ts`), free it on leave. Show the owner's
   name on the desk (small label baked like room labels). After an editor save, keep desks
   that still exist and reassign the others. Organiser can change it from the Team page.
3. **Interact with E**: when the player stands at a desk seat (`seatPoint()`) or next to a
   board/TV, show a hint bubble "Press E" and emit `object:interact { type, id }`.
   `isTyping()` already blocks keys while typing in an input.
4. **`presence:zone` on the server**: the client sends its zone on enter/leave
   (`zone` event on `/office`), the gateway keeps it per player and includes it in
   `office:state` / broadcasts `office:zone { id, zone }`. Used for the meeting room
   "occupied" badge (Z4) and "on break" (H1).
5. Show it: the presence list shows where each person is ("Atlas · meeting").

Done when: two browsers walk next to each other → both get `player:near`, walk away →
`player:far`; E at your desk logs `object:interact desk`; a meeting room shows who's inside.

### R6 — Polish (week 5)

- **Reconnect**: socket.io reconnects by itself and `office:state` resyncs, but nothing tells
  the user. Add a small "Reconnecting…" banner on `disconnect`, gone on `connect`.
- **Status bubble** above avatars (Zakaria's current task, "on break" from H1): add a
  `status` field to the player state and the `office:updated` event.
- **Minimap** (corner, click to focus): reuse `LayoutPreview` with dots for people.
- **Phones/tablets**: there's no touch control. Add a virtual joystick (or tap to walk with
  the existing obstacle list). The editor stays desktop-only (hidden under `lg`), fine.
- **Character step for invited people**: they join with a random character and can change it
  in the office; PLAN.md says they pick one on joining. Add the `CharacterPreview` picker to
  `InvitationView` before "Join".

### Nice to have (only if time)

- Editor: select several pieces (shift-click, drag a box), "reset to template", change the
  template of an existing office (would need moving desks/people; keep it simple: only
  when alone in the office).
- Offices bigger than 48 desks (a 4th template or a generator).
- Move the Playwright scripts used for testing into the repo (`apps/web/e2e`), run them in
  CI: onboarding, invitation journey, multiplayer, editor.

### Things to know before touching the office code

- Static scenery (floors, walls, room labels) is baked once into textures: fast, but
  changing it means re-baking (`bakeStaticScenery`). Furniture is one image per piece, so
  it can move (the editor relies on it).
- Depth: furniture `3 + y/100000`, people `10 + y/100000` (things lower on screen are in
  front).
- A layout change restarts the scene (`controller.setLayout`); people are kept outside the
  scene (`createGame.ts`) so nobody blinks.
- Same placement rules on both sides: `apps/web/game/editor/rules.ts` and
  `apps/api/src/office/layout/validate.ts`. Change both together.
- Positions on the wire are pixels; layout is tiles (`TILE = 32`).

## 4. Mira: what's next

- **M3 Profile**: display name, avatar upload (default avatar), `/u/[id]`. The office shows
  `displayName`, so a rename should push it live: add `name` to the existing
  `office:updated` event (it carries `character` and `role` today).
- **Transfer ownership** (missing today): the owner can't leave; let them hand the office
  to an admin (one transaction: old owner → ADMIN, new → OWNER).
- **M7 Friends + online status**, then **H1/H2** chill room and chat (week 5).

## 5. Zakaria: what's next

- Start now, nothing blocks it: **Z1 Task backend** (`TasksModule` in `apps/api/src/tasks`,
  use `MembershipService.require(user.id)` to get the workspace, never a workspace id from
  the client) and **Z2 Kanban** panel over the office with live updates on `/tasks`.
- **Z3 Voice**: build the WebRTC part with a test "call user X" button first; plug it into
  `player:near` / `player:far` / `player:distance` when Roy's R4 lands.
- Room names come from the layout and can be renamed by the organiser: key meeting calls
  by room `id`, not by name.

## 6. Known gaps

- No automated end-to-end tests in the repo yet (only API unit tests).
- The final README sections required by the subject (Team, Modules with points, Individual
  contributions...) are still to write (PLAN.md §8).
