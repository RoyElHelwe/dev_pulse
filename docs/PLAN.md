# Dev Pulse — Team Plan

**Team:** Roy · Mira · Zakaria
**Goal:** a 2D virtual office where a team walks around, talks by proximity voice, meets in
meeting rooms, relaxes in the chill room and manages tasks from their desks.

> Weeks below are relative (W0 = first days). Stretch or squeeze them to fit your deadline;
> the **order** is what matters.

---

## 1. The new architecture (and why it's simpler)

The old setup had **11 containers** (api-gateway, auth-service, workspace-service,
task-service, NATS, Redis, Mailpit, coturn, prisma-migrate, Postgres, web). The new one has
**2 application services**, plus Postgres and a small nginx front door:

```
Browser ──HTTPS──► proxy (nginx) ──► web  (Next.js)  pages + Phaser game
                                 └─► api  (NestJS)   REST /api/* + Socket.IO /socket.io/*
                                          └─► db (PostgreSQL)
```

| Old                                                       | New                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| api-gateway + auth/workspace/task services + NATS         | **one NestJS app**, one folder (module) per feature                 |
| Redis for presence/sessions                               | in-memory state inside the api (enough for one server) + JWT cookie |
| Mailpit container                                         | invite links are shown/copied in the UI; SMTP optional via `.env`   |
| coturn (TURN server)                                      | public STUN only; voice works on the same network (documented limit)|
| prisma-migrate container                                  | api runs `prisma db push` on start                                  |
| HTTPS configured in every service                         | nginx terminates HTTPS once, so the app has a single origin (no CORS)|

**Trade-off:** we no longer claim the "Backend as microservices" module (2 pts). The points
table in section 6 still reaches 14+ without it.

---

## 2. Who owns what (folders)

Each person mostly works in their own folders, which keeps merge conflicts rare.

| Area             | Backend (`apps/api/src/…`)               | Frontend (`apps/web/…`)                                   | Owner          |
| ---------------- | ---------------------------------------- | --------------------------------------------------------- | -------------- |
| Auth             | `auth/`, `common/auth/`                  | `app/(auth)/login`, `app/(auth)/signup`                   | **Mira**       |
| Profile, friends | `users/`, `friends/`                     | `app/profile/…`, `app/u/[id]`                             | **Mira**       |
| Invitations      | `invitations/`, `members/`               | `app/invite/[token]`, `features/members/`                 | **Mira**       |
| Onboarding       | `workspaces/`                            | `app/onboarding/`                                         | **Roy**        |
| Office / game    | `office/` (Socket.IO `/office`)          | `app/office/[workspaceId]`, `game/` (Phaser), `features/office/` | **Roy**  |
| Task manager     | `tasks/` (Socket.IO `/tasks`)            | `features/tasks/`                                         | **Zakaria**    |
| Voice + meeting  | `rtc/` (Socket.IO `/rtc`), `meetings/`   | `features/voice/`, `features/meeting/`                    | **Zakaria**    |
| Chill room, chat | `chat/` (Socket.IO `/chat`)              | `features/chill/`, `features/chat/`                       | **Helper → Mira** |
| Shared           | `prisma/`, `health/`, `schema.prisma` CORE | `app/layout.tsx`, `components/ui/`                      | everyone, needs review |

**Schema rule:** `apps/api/prisma/schema.prisma` has one section per person. You only edit
your own section. Changes to the **CORE** section get discussed with the whole team first.

---

## 3. Day-1 contracts (do these together, ~2 hours)

These are the points where one person's work plugs into another's. Agree on them first, and
then everyone can work in parallel without waiting.

### C1 — Core schema (`CORE` section of `schema.prisma`)

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?            // null for OAuth-only users
  displayName  String
  avatarUrl    String?
  createdAt    DateTime @default(now())
  memberships  WorkspaceMember[]
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  members   WorkspaceMember[]
}

enum Role { OWNER ADMIN MEMBER }

model WorkspaceMember {
  id          String    @id @default(cuid())
  userId      String
  workspaceId String
  role        Role      @default(MEMBER)
  character   String    @default("default")   // sprite key chosen in onboarding
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([userId, workspaceId])
}
```

### C2 — Auth contract (Mira provides it, everyone uses it)

- Session = **httpOnly cookie** `access_token` (JWT signed with `JWT_SECRET`, `Secure`, `SameSite=Lax`).
- Backend: `@UseGuards(AuthGuard)` and `@CurrentUser() user` from `src/common/auth`.
- Sockets: the same cookie is sent on the Socket.IO handshake (same origin). The helper
  `authenticateSocket(socket)` sets `socket.data.user`.
- Workspace access: `@UseGuards(WorkspaceMemberGuard)` checks the user belongs to `:workspaceId`.
- Frontend: `GET /api/auth/me` → `{ id, email, displayName, avatarUrl }` (401 if logged out),
  wrapped in a `useMe()` hook.

**Interface first:** Mira's first PR (M1) ships these guards and decorators with their *final*
signatures, backed by a fake seeded user. Roy and Zakaria code against them from day 2, and
Mira swaps in the real implementation without anyone else changing code.

### C3 — Game → features event bus (Roy emits, Zakaria and the helper listen)

Roy owns **detecting** who is near and which zone a player is in. Zakaria owns **what
happens** then (voice, meeting call, task panel). This boundary is what takes load off
Zakaria.

`apps/web/features/office/events.ts` exports a typed emitter `officeEvents`:

| Event             | Payload                                                     | Emitted when                                   |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `player:near`     | `{ userId, distance }`                                      | another player comes within `NEAR_RADIUS`      |
| `player:distance` | `{ userId, distance }`                                      | while near, at most 5×/s (for voice volume)    |
| `player:far`      | `{ userId }`                                                | they leave the radius (with a little hysteresis)|
| `zone:enter`      | `{ type: 'meeting' \| 'chill' \| 'desk', id, name }`        | local player enters a zone (**done in R1**)    |
| `zone:leave`      | `{ type, id, name }`                                        | local player leaves a zone (**done in R1**)    |
| `object:interact` | `{ type: 'desk' \| 'board', id }`                           | player presses **E** next to an object         |

Map format: an `OfficeLayout` object (`apps/web/game/layout/types.ts`): plain JSON with
rooms, walls, furniture and `zones` (`type`, `id`, `name`, rectangle in tiles). The office
is drawn in code from that data (no tileset), so the same JSON can be stored in the
database and turned into templates in R5. Example: `game/layout/studio.ts`.

### C4 — Realtime namespaces and REST prefixes

| Namespace  | Owner   | Main events                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| `/office`  | Roy     | `office:join {workspaceId}` → `office:state {players}`, `player:move`, `player:moved`, `player:left`, `presence:zone {userId, zone}` |
| `/tasks`   | Zakaria | `task:created`, `task:updated`, `task:deleted` (room = workspaceId)                           |
| `/rtc`     | Zakaria | `rtc:offer`, `rtc:answer`, `rtc:ice` (relayed to `toUserId`), `rtc:hangup`                     |
| `/chat`    | Helper  | `chat:join {roomId}`, `chat:message`, `chat:typing`                                           |

REST: `/api/auth/*`, `/api/users/*`, `/api/workspaces/*`, `/api/workspaces/:id/invitations`,
`/api/workspaces/:id/members`, `/api/workspaces/:id/tasks`, `/api/workspaces/:id/messages`.

---

## 4. Task order per person

`→` means "unblocks". Tasks with no dependency can start on day 1.

### Mira — authentication, profile, invitations (then Helper track)

| #  | Week  | Task | Depends | Unblocks |
| -- | ----- | ---- | ------- | -------- |
| M1 | W0–W1 | **Auth contract (C2)**: `AuthGuard`, `@CurrentUser()`, `authenticateSocket`, `WorkspaceMemberGuard`, backed by a seeded fake user | C1 | **everyone** |
| M2 | W1    | Sign up / log in / log out with email + password (bcrypt/argon2 hash), JWT cookie, `/auth/me`, validation on front **and** back, login + signup pages, redirect to onboarding if the user has no workspace | M1 | R3 |
| M3 | W2    | Profile: edit display name, avatar upload (default avatar when none), public profile page `/u/[id]` | M2 | R2 (avatars/names in office) |
| M4 | W2–W3 | **Invitations**: owner/admin invites by email → token link `/invite/[token]`; accept while logged in, or sign up then accept → creates `WorkspaceMember`; list and revoke pending invites; optional email via SMTP env | M2, C1 | R3 (join flow) |
| M5 | W3    | Members management: list members, change role, remove member; roles enforced (OWNER/ADMIN/MEMBER) | M4 | everyone (role checks) |
| M6 | W4    | OAuth login (42 or GitHub). Optional: 2FA (TOTP) | M2 | — |
| M7 | W4    | Friends (add/remove, list) + online status (from socket connection) | M3 | H2 |
| H1 | W5    | **Helper → Chill room** (see Zakaria's list) | R4 | — |
| H2 | W5    | **Helper → Chat**: workspace chat + direct messages, history saved in DB, typing indicator | M7 | — |
| F1 | W6    | Privacy Policy + Terms of Service pages, linked in the footer (**mandatory**, real content) | — | — |

### Roy — game engine + onboarding

| #  | Week  | Task | Depends | Unblocks |
| -- | ----- | ---- | ------- | -------- |
| R1 | W1    | ✅ Phaser inside Next.js (client-only dynamic import), office drawn from layout data, character with walk cycle, movement + collisions + camera follow, zone enter/leave | — | R2 |
| R2 | W2    | **Multiplayer movement**: `/office` namespace, join the workspace room, broadcast moves (throttled ~10–15/s), interpolation for other players, join/leave, name labels | R1, M1 | **Z3, Z4** |
| R3 | W2    | **Onboarding wizard**: first login with no workspace → create workspace (name) → pick office template → pick character → enter office. Invited users skip "create" but still pick a character | M1, C1 | M4 (join flow), demo |
| R4 | W3    | **Zones and interactions (C3)**: `zones` layer, desk per member, `officeEvents` (near/far/distance, zone enter/leave, interact with **E**), `presence:zone` on server | R2 | **Z3 proximity, Z4, Z5, H1** |
| R5 | W4    | Office templates / layout builder: 2–3 templates or a simple generator based on team size; saved as JSON on the workspace; owner can edit or delete the workspace | R3 | — |
| R6 | W5    | Polish: status bubble above avatars (data from Z5), minimap, reconnect after network loss, responsive layout | R4 | — |
| F2 | W6    | Tech lead review, fresh-machine test (`git clone && make`), console has no errors | all | — |

### Zakaria — features inside the office

Order chosen so Zakaria is **never blocked**: the task manager needs no game, voice can be
built and tested with two browser tabs before the game has proximity, and only then gets
plugged into Roy's events.

| #  | Week  | Task | Depends | Unblocks |
| -- | ----- | ---- | ------- | -------- |
| Z1 | W1    | **Task backend**: `Task` model (title, description, status TODO / IN_PROGRESS / REVIEW / DONE, priority, assignee, due date), CRUD REST with validation, scoped to a workspace | M1, C1 | Z2 |
| Z2 | W1–W2 | **Kanban UI** (drag & drop) as a panel over the office + live updates via `/tasks` (two browsers see the same board change) | Z1 | Z5 |
| Z3 | W2–W3 | **Voice core**: WebRTC peer-to-peer audio, `/rtc` signaling (offer/answer/ICE relay), mic permission, mute button. **First test with a "call user X" button between 2 tabs**, then plug into `player:near` / `player:far` and set volume from `player:distance` | M1; R4 for the proximity part | Z4 |
| Z4 | W3–W4 | **Meeting room**: `zone:enter meeting:<id>` → join the group call for that room (mesh, everyone in the zone); leave on exit; participant list; "occupied" badge; optional screen share | Z3, R4 | — |
| Z5 | W4–W5 | **Desk ↔ tasks**: `object:interact desk` opens *my* tasks; current task shown in the bubble above the avatar (with R6) | Z2, R4 | R6 |
| H1 | W5    | **Chill room** (Helper, see below): on `zone:enter chill` → room text chat, emotes/reactions, "on break" status on the avatar | R4, H2 | — |

### The helper for Zakaria's track

Zakaria's list is the longest, so **Mira takes the Helper track (H1 chill room, H2 chat) from
W5**, once her own scope is done. That fits well: chat + profile + friends together make one
module ("User interaction", 2 pts) entirely in her hands.

If a 4th teammate joins (the subject asks for 4–5 people), give them H1 + H2 from W2 instead,
and Mira keeps M6/M7 plus the optional 2FA.

---

## 5. Week-by-week timeline

| Week | Mira          | Roy        | Zakaria         | Demo at end of week (everyone shows their part) |
| ---- | ------------- | ---------- | --------------- | ----------------------------------------------- |
| W0   | C1–C4 together, M1 started | C1–C4 together | C1–C4 together | `make dev` works on every laptop, contracts written |
| W1   | M1, M2        | R1         | Z1, Z2 start    | Sign up/log in; walk alone in the office; create tasks via API |
| W2   | M3, M4 start  | R2, R3     | Z2, Z3 start    | Onboarding creates a workspace; 2 browsers see each other move; live Kanban |
| W3   | M4, M5        | R4         | Z3 (proximity)  | Invite a teammate by link; walk close → hear each other |
| W4   | M6, M7        | R5         | Z4              | Group call in the meeting room; roles; OAuth |
| W5   | H1, H2        | R6         | Z5              | Chill room + chat; task bubbles above avatars |
| W6   | F1, README    | F2, README | README          | **Feature freeze**: bug bash, fresh-machine test, README complete |

**Critical path:** M1 → R2 → R4 → Z3 (proximity) → Z4. If anything here slips, the rest of
the team helps on it first.

---

## 6. Modules (target ≥ 14 points)

| Module | Type | Pts | Owner(s) |
| ------ | ---- | --- | -------- |
| Web: frameworks for frontend (Next.js) + backend (NestJS) | Major | 2 | all |
| Web: real-time features with WebSockets | Major | 2 | Roy, Zakaria |
| Web: user interaction (chat + profile + friends) | Major | 2 | Mira |
| User Mgmt: standard user management (profile, avatar, friends + online status) | Major | 2 | Mira |
| User Mgmt: organization system (workspaces, add/remove members) | Major | 2 | Roy + Mira |
| Module of choice: proximity voice + meeting rooms in a 2D office (needs justification in README) | Major | 2 | Zakaria |
| Web: ORM (Prisma) | Minor | 1 | all |
| Web: real-time collaborative features (live shared Kanban / workspace) | Minor | 1 | Zakaria |
| User Mgmt: OAuth 2.0 | Minor | 1 | Mira |
| **Total** | | **15** | |
| *Buffer:* 2FA (minor, Mira), notification system (minor), advanced permissions (major, Mira) | | +1…+4 | |

Aim for the buffer: modules that aren't fully working during evaluation count for 0.

---

## 7. How we work

- **Board:** GitHub Projects, one card per task ID above (`M2`, `R4`…). Columns: Todo / Doing / Review / Done.
- **Branches:** `main` is protected. Work on `<name>/<task-id>-short-name`
  (e.g. `mira/M2-login`), open a small PR, and get **1 review** from someone else before merging.
- **Commits:** clear messages (`feat(tasks): add kanban drag and drop`). The subject checks that
  everyone has commits, so commit your own work yourself.
- **Sync:** 15-min check-in twice a week, plus a demo at the end of each week (table above).
- **Roles (required in the README):** suggestion: **Roy** = Tech Lead (owns the game core and
  the contracts), **Mira** = Project Manager (smallest critical scope, finishes early),
  **Zakaria** = Product Owner (owns most user-facing features). Change it if you prefer;
  all three are also Developers.
- **Definition of done:** works in Chrome through `https://…` with no console errors, inputs
  validated on front and back, reviewed, and merged.

## 8. Final checklist (W6)

- [ ] `git clone … && make` works on a clean machine (single command)
- [ ] Privacy Policy + Terms of Service pages with real content, linked from the footer
- [ ] No warnings or errors in the Chrome console
- [ ] `.env.example` complete, no secrets committed
- [ ] Multiple users at the same time: no conflicts, real-time updates everywhere
- [ ] README sections required by the subject: Description, Instructions, Resources (+ AI usage),
      Team Information, Project Management, Technical Stack, Database Schema, Features List,
      Modules (with points), Individual Contributions
