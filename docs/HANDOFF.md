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
| Office (R1), multiplayer (R2), onboarding (R3), templates + editor (R5) | ✅ | OFFICE.md |
| Zones, proximity, desks, E to use, who is where (R4) | ✅ | OFFICE.md §5 |
| Polish: reconnect banner, statuses, map, phone joystick, character on joining (R6) | ✅ | OFFICE.md §5 |
| Invitations (M4), members and roles (M5) | ✅ | OFFICE.md |
| Privacy Policy, Terms of Service (F1) | ✅ | |
| Browser tests in CI (`e2e/`) | ✅ | OFFICE.md §8 |
| Generated offices sized to the team, characters and desks from recipes | ✅ | OFFICE.md §4–5 |
| Proximity voice (3D audio, meeting rooms keep their sound in), mute, deafen, push to talk | ✅ | OFFICE.md |
| Meeting room bookings (timetable, enforced), office and room chat | ✅ | OFFICE.md §9 |
| Tasks: backend and Kanban (Zakaria Z1, Z2, Z5) | not started, **unblocked** | §5 |
| Profile, friends (Mira M3, M7), chill room extras (H1) | not started | PLAN.md |

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
`apps/api`, and no errors in the Chrome console. CI also runs the browser tests (`e2e/`,
about 10 minutes); run them locally before a big change (OFFICE.md §8).

## 3. Roy: what's left

R1–R6 are done, and so are the extras: multi-select and reset in the editor, moving an
office to another template, a 100-desk template, browser tests in CI. What remains is
support for the others and the final polish:

- **Help Zakaria plug in** (Z3/Z4/Z5): the hooks are in OFFICE.md §5. Likely asks: the
  current task in the status bubble, a "join the call" button when entering a meeting room.
- **Avatars from Mira's profile** (M3): show them in the people list and on desk plates once
  `avatarUrl` exists.
- **Before the evaluation**: run the browser tests against Docker
  (`E2E_BASE_URL=https://localhost:8443`, not tried yet), check Chrome's console on every
  page, and the final README sections (PLAN.md §8).
- Ideas if there's time: sounds (footsteps, a "pop" when someone comes near), emotes, a
  "follow" button in the people list, walls and doors in the editor.

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
- Keyboard shortcuts in the game use a `window` keydown listener, not Phaser's key queue:
  Phaser's queue delivered some presses twice (undo ran twice).
- Desks, statuses and zones survive a layout reload because the controller keeps them
  outside the scene (`createGame.ts`), like the people.

## 4. Mira: what's next

- **M3 Profile**: display name, avatar upload (default avatar), `/u/[id]`. The office shows
  `displayName`, so a rename should push it live: add `name` to the existing
  `office:updated` event (it carries `character` and `role` today).
- **Transfer ownership** (missing today): the owner can't leave; let them hand the office
  to an admin (one transaction: old owner → ADMIN, new → OWNER).
- **M7 Friends + online status**, then **H1/H2** chill room and chat (week 5).

## 5. Zakaria: what's next

- **Z1 Task backend is built** (`TasksModule`, `apps/api/src/tasks`): `GET/POST /api/workspace/tasks`,
  `PATCH/DELETE /api/workspace/tasks/:id`. Task = per-workspace `number` (key `<PREFIX>-<n>`),
  type TASK|BUG|STORY, status TODO|IN_PROGRESS|IN_REVIEW|DONE, priority, assignee (a member),
  reporter, dueDate, `rank` (float order in a column; move = PATCH `{status, rank}`). Everyone in
  the office can browse/create/edit/move/assign; delete = OWNER/ADMIN or the reporter. Live events
  on `/office`: `task:created|updated` (full task) and `task:deleted` (`{id}`). A removed member's
  tasks become unassigned.
- **Z2 Kanban** UI over the office (next) uses those events.
- **Z3/Z4 voice and meeting rooms are built** (`features/voice`, `apps/api/src/voice`): peer to
  peer audio placed around you, meeting rooms as one call, bookings in `features/meetings`.
  Without a TURN server, people behind strict NATs can't connect (add one in the ICE servers
  of `VoiceManager.ts` for production).
- **Z5 Desk ↔ tasks**: `object:interact` with `type: 'desk'` and `ownerId === me` opens my
  tasks. Today it shows a placeholder message (in `OfficeView.tsx`, remove it then). The
  current task can go in the status bubble: `PATCH /api/workspace/me { status }`.
- Room names come from the layout and can be renamed by the organiser: key meeting calls
  by room `id`, not by name.

## 6. Known gaps

- The browser tests have run against the local build, not yet against the Docker stack.
- The final README sections required by the subject (Team, Modules with points, Individual
  contributions...) are still to write (PLAN.md §8).
