*This project has been created as part of the 42 curriculum by <login1>, <login2>, <login3>.*

# Dev Pulse

A collaborative workspace inside a **2D virtual office**: walk around with your teammates,
talk by proximity voice, meet in meeting rooms, take a break in the chill room and manage
tasks from your desk.

> 🚧 In progress. The team plan (who builds what, and in which order) is in
> **[docs/PLAN.md](docs/PLAN.md)**. Done so far: infrastructure, authentication
> ([docs/AUTH.md](docs/AUTH.md)): email + password, Google / GitHub / 42, 2FA, JWT access +
> refresh tokens, one device at a time; and the office ([docs/OFFICE.md](docs/OFFICE.md)):
> onboarding with office templates, email invitations, roles, live multiplayer and the
> organiser's office editor.

## Architecture

```
Browser ──HTTPS──► proxy (nginx) ──► web  (Next.js)  pages + Phaser game
                                 └─► api  (NestJS)   REST /api/* + Socket.IO /socket.io/*
                                          └─► db (PostgreSQL)
```

| Service | Tech                          | Role                                                       |
| ------- | ----------------------------- | ---------------------------------------------------------- |
| `web`   | Next.js 16, React 19, Tailwind 4 | UI and the 2D office                                    |
| `api`   | NestJS 11, Prisma 6, Socket.IO | One backend app, one module per feature                   |
| `db`    | PostgreSQL 16                 | Data                                                       |
| `proxy` | nginx                         | HTTPS for everything, a single origin for the app          |

## Instructions

**Prerequisites:** Docker with Docker Compose v2, and `make`.

```bash
git clone <repo-url> dev_pulse && cd dev_pulse
make            # creates .env from .env.example, builds and starts everything
```

Open **https://localhost:8443**. The certificate is self-signed, so accept the browser warning
once. `/status` checks the API, database and WebSocket.

### Commands

| Command       | What it does                                                         |
| ------------- | -------------------------------------------------------------------- |
| `make`        | Production build, runs in the background (what evaluators run)       |
| `make dev`    | Hot reload: edit code in `apps/` and see changes without rebuilding  |
| `make db`     | After editing `apps/api/prisma/schema.prisma`: push it to the DB     |
| `make studio` | Prisma Studio at http://localhost:5555 (while `make dev` is running) |
| `make logs`   | Follow logs (`make logs s=api` for one service)                      |
| `make down`   | Stop (data is kept)                                                  |
| `make clean`  | Stop and **delete** the database and certificate                     |

Added a dependency? `cd apps/web && pnpm add <pkg>` (commits the lockfile), then rerun
`make dev`; it rebuilds the image.

### Optional settings

`make` creates `.env` with random secrets; the app works without changing anything. Emails
(confirmation, password reset) are printed in `make logs s=api` until you set `SMTP_*`.
Google / GitHub / 42 sign-in buttons appear when their keys are set. See
[docs/AUTH.md §5](docs/AUTH.md#5-configuration-env).

### Access from other machines (LAN)

Set `SERVER_NAME` in `.env` to your machine's IP (e.g. `10.12.1.5`), then run `make` again.
The certificate is regenerated for that IP. Teammates open `https://10.12.1.5:8443`.
HTTPS is required for the microphone (voice chat).

### Project layout

```
apps/
  api/            NestJS backend
    prisma/       schema.prisma (single DB schema, one section per person)
    src/          one folder per feature module
  web/            Next.js frontend
nginx/            HTTPS reverse proxy (self-signed cert generated on first start)
docs/PLAN.md      team plan
```

## Team Information

<!-- Role(s) and responsibilities for each member — see docs/PLAN.md §7 -->

## Project Management

<!-- How work was organized, tools (GitHub Projects), communication channels -->

## Technical Stack

<!-- Frontend, backend, database and justification of the main choices -->

## Database Schema

<!-- Diagram / description of tables and relations -->

## Features List

<!-- Feature — who built it — what it does -->

## Modules

<!-- Module — Major/Minor — points — justification — how — who -->

## Individual Contributions

<!-- Per member: what they built, challenges and how they were solved -->

## Resources

<!-- Documentation, tutorials, and how AI was used (which tasks, which parts) -->
