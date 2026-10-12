# Handoff

Where the project stands on branch `zakaria/dev` (the current development branch) and what each
person picks up next. Details live in **[PLAN.md](PLAN.md)** (who does what), **[AUTH.md](AUTH.md)**,
**[OFFICE.md](OFFICE.md)**, and the subsystem architecture guides in `docs/code/`.

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
| Browser tests in CI (`e2e/`, 7 spec files / 38 tests) | ✅ | OFFICE.md §8, `docs/code/testing.md` |
| Generated offices sized to the team, characters and desks from recipes | ✅ | OFFICE.md §4–5 |
| Proximity voice (3D audio, meeting rooms keep their sound in), mute, deafen, push to talk | ✅ | `docs/code/voice.md` |
| Meeting room bookings (timetable, enforced), office and room chat | ✅ | OFFICE.md §9 |
| Tasks: backend and Kanban right drawer (`features/tasks/BoardDrawer.tsx`), live via `task:*` events on `/office`, desk papers, E at board / desk (Z1, Z2, Z5) | ✅ | `docs/code/tasks.md` |
| Chill room + minigames: Baby foot (Foosball), Uno, Lego wall, leaderboards (H1, extra) | ✅ | `docs/code/games.md` |
| Single active office tab enforcement (`TabLock.tsx`, `tabLockStore.ts`) | ✅ | OFFICE.md |
| User menu with character selector, status picker, and rebindable keybinds (`keybindStore.ts`) | ✅ | AUTH.md |
| Dev switcher & accelerated test login (`api/src/dev`, `features/dev/`) (dev/test only) | ✅ | `docs/code/testing.md` |
| Office expansion wings (Loft desks) and dedicated chill room lounge wings | ✅ | OFFICE.md §4, `docs/code/layout.md` |
| 2.5D walls, wall faces, and wall-mounted items (TV, board, Lego wall) | ✅ | `docs/code/layout.md` |
| Readability pass and subsystem architecture documentation (`docs/code/`) | ✅ | `docs/code/` |
| Profile page & avatar upload (Roy M3) | ⬜ not started | PLAN.md |
| Friends & online status (Roy M7) | ⬜ not started | PLAN.md |
| Direct messages (DMs) & typing indicators in chat | ⬜ not started | PLAN.md |
| Notifications system & file upload | ⬜ not started | PLAN.md |
| Transfer of workspace ownership (owner handoff) | ⬜ not started | PLAN.md |
| TURN server for WebRTC voice (production ICE relays) | ⬜ not started | `docs/code/voice.md` |
| Screen sharing in meeting rooms (Z4 extra) | ✅ | `docs/code/meeting-room.md` |
| Shared whiteboard (Excalidraw) in meeting rooms | ✅ | `docs/code/meeting-room.md` |
| Microphone / speaker selection and mic test (Settings → Voice) | ✅ | `docs/code/voice.md` |

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

### Verification gates before every push

See **[docs/code/testing.md](code/testing.md)** for full testing architecture and commands:
- **Typecheck**: `pnpm --filter web typecheck` and `pnpm --filter api typecheck`.
- **Unit tests**: `pnpm --filter api test` (Vitest running pure rules specs in `apps/api/src`).
- **E2E tests**: CI runs `node e2e/serve.mjs & pnpm --dir e2e test` across Chromium (7 specs, 38 tests, ~1-2 min). Run locally against Docker via `E2E_BASE_URL=https://localhost:8443 pnpm --dir e2e test:full`.
- **Clean console**: zero errors or warnings in the browser console.

## 3. Roy: what's left

R1–R6 are done, along with the extras: multi-select and reset in the editor, moving an
office to another template, a 100-desk headquarters template, and browser tests in CI.
Zakaria's tasks and minigames are integrated. What remains is support for remaining gaps and final polish:

- **Avatars from Roy's profile** (M3): display avatar images in the people list and on desk plates once profile avatar upload is built.
- **Before the evaluation**: run the full browser test suite against Docker (`E2E_BASE_URL=https://localhost:8443`), verify clean console on every page, and help finalize team README markers (PLAN.md §8).
- Ideas if there's time: sound effects (footsteps, proximity arrival chimes), player emotes, a "follow" camera button in the people roster.

### Things to know before touching the office code

- Static scenery (floors, walls, room labels) is baked once into textures: fast, but changing it means re-baking (`bakeStaticScenery` in `apps/web/game/render/scenery.ts`). Furniture is dynamic (`FurnitureSprites.ts`), so it can move.
- Depth: centralized in `apps/web/game/systems/Depth.ts` (`DEPTH`, `furnitureDepth`, `peopleDepth`). Lower on screen renders in front.
- Scene lifecycle: a layout change restarts the scene (`controller.setLayout`); remote players and desks are managed outside the scene (`createGame.ts`) so nobody blinks.
- Subsystems architecture: `OfficeScene.ts` delegates to modular systems under `apps/web/game/systems/` (`ViewControl.ts`, `NetSync.ts`, `FurnitureSprites.ts`, `Seating.ts`, `Proximity.ts`, `Interactions.ts`, `RoomLocks.ts`, `rooms.ts`). Details in `docs/code/office-engine.md`.
- Same placement rules on both sides: `apps/web/game/editor/rules.ts` (client drag) and `apps/api/src/office/layout/validate.ts` (server save). See `docs/code/layout.md`.
- Positions on the wire are pixels; layout coordinate space is tiles (`TILE = 32`).
- Keyboard shortcuts: global `window` listeners in `apps/web/features/settings/keybindStore.ts` avoid Phaser duplicate key events.
- Single office tab lock: `apps/web/features/office/TabLock.tsx` and `tabLockStore.ts` ensure each user has only one live office tab.

## 4. Roy: what's next

- **M3 Profile**: display name editing, avatar upload (with default avatar fallback), public profile `/u/[id]`. The office displays `displayName`: broadcast name updates via `office:updated`.
- **Transfer ownership**: owners currently cannot leave the office without deleting it; implement owner transfer to an admin (atomic transaction: old owner → ADMIN, new → OWNER).
- **M7 Friends + online status**: friend relationships (add/remove/list) and online presence tracking.
- **H2 Chat extras**: direct 1-on-1 messaging (DMs) and typing indicators (workspace and meeting room chat are already built).

## 5. Zakaria: what's next

- **Z1/Z2 Tasks & Kanban are built**: `TasksModule` in `apps/api/src/tasks/` (`GET/POST /api/workspace/tasks`, `PATCH/DELETE /api/workspace/tasks/:id`), fractional ranking, live updates via `task:created`, `task:updated`, `task:deleted` on the `/office` socket. Frontend right-side drawer Kanban in `apps/web/features/tasks/BoardDrawer.tsx` backed by reactive `apps/web/features/tasks/taskStore.ts`. Details in `docs/code/tasks.md`.
- **Z3/Z4 Voice & meetings are built**: spatial 3D WebRTC audio, meeting room acoustic boundaries, bookings timetable (`/api/workspace/bookings`), and room chat. Acoustic isolation rules in `apps/api/src/voice/voice.rules.ts`. Details in `docs/code/voice.md` and `docs/code/office-protocol.md`.
- **Z5 Desk ↔ tasks is built**: pressing E at a wall Kanban board opens workspace tasks; pressing E at your own assigned desk opens your tasks (`useDeskInteractions.ts`); task counts render paper stacks on desks (`FurnitureSprites.ts`). The old placeholder message is removed.
- **Minigames framework is built**: Foosball (2D physics simulation), Uno (turn rules engine), Lego wall (shared brick persistence), and weekly workspace leaderboards (`apps/api/src/games/`, `apps/web/features/games/`). Details in `docs/code/games.md`.
- **What remains / next gaps**:
  - **TURN server**: add Coturn / production TURN ICE relay servers in `VoicePeer.ts` so audio connects across restrictive symmetric NATs and mobile networks.

## 6. Known gaps

- **E2E tests against Docker**: E2E tests are verified locally against the production Docker stack (`E2E_BASE_URL=https://localhost:8443 pnpm --dir e2e test:full`); CI currently executes the 38 browser tests against a lightweight Node proxy (`e2e/serve.mjs`) for speed.
- **README sections**: All subject-mandated sections are drafted in `README.md`. Team-specific `<!-- FILL: ... -->` markers (42 logins, GitHub Projects URL, personal AI usage statements) remain to be finalized by the team before submission (PLAN.md §8).
- **Feature gaps**: User profile page / avatar upload (M3), friends and online status (M7), direct messages and typing indicators (H2), notification system, workspace ownership transfer, and WebRTC TURN server.
