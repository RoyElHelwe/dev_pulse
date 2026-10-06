# Authentication

**Owner:** Mira · **Code:** `apps/api/src/auth`, `apps/api/src/common/auth`, `apps/web/features/auth`

Based on Mira's first version (Better Auth, database sessions), rebuilt on our NestJS API
with **JWT access tokens + rotating refresh tokens**, and finished: password reset, 42
sign-in, 2FA for every sign-in method, backend validation, rate limits, HTTPS and Docker.

---

## 1. Features

| Feature | Where |
| ------- | ----- |
| Sign up / sign in / sign out with email + password (scrypt, salted) | `/register`, `/login` |
| Validation on the frontend (Zod) **and** the backend (class-validator DTOs), same rules | `features/auth/schemas.ts`, `auth/dto/` |
| Email confirmation + "send again" | `/verify-email` |
| Forgot / reset password (1-hour link), change or set a password | `/forgot-password`, `/reset-password`, settings |
| Sign in with **Google, GitHub, 42** (OAuth 2.0, state + PKCE) | buttons appear when configured |
| **2FA**: authenticator app (TOTP), 10 backup codes, "trust this browser for 30 days" | `/two-factor`, settings |
| 2FA is also asked after Google / GitHub / 42 sign-in | |
| Signed-in devices: list, sign out one, sign out everywhere | `/settings/security` |
| **One device at a time**: a second device is refused; an emailed link closes every session | `/close-sessions` |
| Signed-out devices leave **at once** (live socket), even in the middle of the office | |
| Rate limits, origin check (CSRF), "wrong email or password" never tells which one | |
| Privacy Policy, Terms of Service (mandatory) | `/privacy`, `/terms` |

---

## 2. How sign-in works

```
           POST /api/auth/login (email, password)
Browser ───────────────────────────────────────────► API
        ◄─── Set-Cookie: access_token  (JWT, 15 min, path /)
             Set-Cookie: refresh_token (random, 30 days, path /api/auth only)
             Set-Cookie: signed_in     (readable hint: "access token expires at …")

Every request:  cookie access_token ──► AuthGuard checks the JWT signature
                                        (no database query)

~1 min before expiry:  POST /api/auth/refresh ──► old refresh token revoked,
                                                  new access + refresh token
```

- **Access token**: a JWT (`sub` = user id, `sid` = device id), signed with a key derived
  from `JWT_SECRET`. Short-lived, so a leaked one is useless quickly.
- **Refresh token**: 32 random bytes. The database only stores its SHA-256 hash. Each one
  works **once**: refreshing gives a new one (rotation). All tokens of one sign-in share a
  `familyId` = one device in the "signed-in devices" list.
- **Theft detection**: if an already-used refresh token comes back later, someone copied
  it, so that device is signed out. (A reuse within 30 s is two tabs refreshing at the same
  time, not theft: the frontend also prevents that with a Web Lock.)
- **Sign out** revokes the device's refresh tokens. Every request also checks that its
  device session is still alive (one small indexed query), so a signed-out device stops
  working immediately, not when its access token expires.
- All tokens are in **httpOnly cookies**: JavaScript on the page can't read them, so an XSS
  bug can't steal them. Same site through nginx, so no CORS. `SameSite` + an origin check
  block cross-site requests.

### With 2FA on

```
password ✔ ──► { status: "two-factor-required" } + cookie mfa_token (5 min)
           ──► /two-factor ──► POST /api/auth/2fa/verify { code } ──► session cookies
```

Same after Google / GitHub / 42. The secret is stored AES-256-GCM encrypted, each code
works once, 5 wrong codes lock 2FA for 5 minutes.

### One device at a time

```
PC:A signed in, used in the last 20 min
PC:B: password ✔ (+ 2FA ✔) ──► { status: "session-active", device: "Chrome on macOS" }
                                  + cookie takeover_token (10 min)
PC:B: "Close the other session" ──► email to the account's own address
                                      + cookie close_sessions (ties the link to PC:B)
link opened ──► every session revoked ──► PC:B: /login ("all sessions are closed")
                                       └─► PC:A: told over the /session socket,
                                            leaves the office for /login at once
PC:B: signs in normally
```

- **Active** = used in the last 20 minutes (an open app renews every ~14 minutes). A
  session left open on a sleeping or closed computer doesn't block: it is closed when you
  sign in elsewhere. Signing in again in the same browser is not "another device".
- **Who can close sessions**:
  1. Asking for the email needs the takeover token, which only a **complete** sign-in
     gets (password or Google/GitHub/42, plus 2FA when it's on). Knowing someone's email
     is not enough, and the email always goes to the account's own address.
  2. The link proves access to the inbox. It works **once**, for **15 minutes**, is stored
     only as a hash, and only works in **the browser that asked for it**. Anywhere else the
     account **password** is also required (accounts without a password: same browser only).
  3. Limits: 3 requests per minute per IP, 1 email per minute per account, only the newest
     link works. An email is sent when the link is requested and when sessions are closed,
     with the browser and IP, so the owner notices if it wasn't them.
- Kicked devices see why on the sign-in page (`?reason=sessions_closed`,
  `signed_in_elsewhere`, `password_changed`...).

### Cookies

| Cookie | Content | Lifetime | Path | JS can read |
| ------ | ------- | -------- | ---- | ----------- |
| `access_token` | JWT | 15 min | `/` | no |
| `refresh_token` | random token | 30 days | `/api/auth` | no |
| `signed_in` | access token expiry (ms) | 30 days | `/` | **yes** (not secret) |
| `mfa_token` | signed "password OK" step | 5 min | `/api/auth` | no |
| `trusted_device` | signed "2FA passed here" | 30 days | `/api/auth` | no |
| `oauth_state` | state + PKCE verifier | 10 min | `/api/auth/oauth` | no |
| `takeover_token` | signed "signed in OK, but open elsewhere" | 10 min | `/api/auth/sessions` | no |
| `close_sessions` | secret tying the email link to this browser | 15 min | `/api/auth/sessions` | no |

---

## 3. API

All under `/api/auth`. Bodies are JSON.

| Method | Path | Who | What |
| ------ | ---- | --- | ---- |
| POST | `/register` | public | `{ displayName, email, password }` |
| POST | `/login` | public | `{ email, password }` → `signed-in` / `two-factor-required` |
| POST | `/2fa/verify` | public (mfa cookie) | `{ code, trustDevice? }` |
| POST | `/refresh` | public (refresh cookie) | new tokens |
| POST | `/logout`, `/logout-all` | signed in | this device / every device |
| GET | `/me` | signed in | the user (never secrets) |
| GET / DELETE | `/sessions`, `/sessions/:id` | signed in | devices |
| POST | `/sessions/close-request` | public (takeover cookie) | emails the "close all sessions" link |
| POST | `/sessions/close` | public | `{ token, password? }`: closes every session |
| POST | `/email/verify`, `/email/resend` | public | `{ token }` / `{ email }` |
| POST | `/password/forgot`, `/password/reset` | public | `{ email }` / `{ token, password }` |
| POST | `/password/change` | signed in | `{ currentPassword?, newPassword }` |
| POST | `/2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/backup-codes` | signed in | `{ password }` / `{ code }` |
| GET | `/providers` | public | configured OAuth providers |
| GET | `/oauth/:provider`, `/oauth/:provider/callback` | public | browser redirects |

**Errors.** Expected mistakes (wrong password, email taken, wrong code, expired link) come
back as **HTTP 200** with `{ "error": { "code", "message", "field"? } }`. Chrome prints every
4xx response as a red console error and the subject wants a clean console, so we keep 4xx for
real problems (no/expired token = 401, rate limit = 429, invalid input = 400). The frontend
`api()` helper turns both into an `ApiError`.

---

## 4. Using auth in your code

### Backend

**Every route needs a signed-in user**, unless marked `@Public()`.

```ts
import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';

@Controller('tasks')
export class TasksController {
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.tasks.forUser(user.id); // user = { id, sessionId }
  }

  @Public()
  @Get('stats')
  stats() {}
}
```

Sockets (Socket.IO): the browser sends the same cookie on the handshake. The frontend
already keeps one connection on the `/session` namespace for instant sign-out; feature
gateways use their own namespace.

```ts
@WebSocketGateway({ namespace: '/office' })
export class OfficeGateway implements OnGatewayConnection {
  constructor(private readonly tokens: TokensService) {} // import AuthModule in your module

  handleConnection(socket: Socket) {
    if (!authenticateSocket(socket, this.tokens)) socket.disconnect(true);
  }
  // later: socket.data.user.id
}
```

A wrong value typed by the user → `throw new FormError('CODE', 'Message for the user.', 'field')`.

### Frontend

```tsx
const { status, user, signOut } = useAuth(); // 'loading' | 'signed-in' | 'signed-out'
const tasks = await api<Task[]>('/tasks/mine'); // cookies + token refresh handled
await api('/tasks', { body: { title } });       // POST with JSON
```

Pages under `/office` and `/settings` redirect to `/login` when signed out (`proxy.ts`).
Add new protected sections to the `PROTECTED` list there.

---

## 5. Configuration (`.env`)

Nothing is required to run locally: `make` generates `JWT_SECRET`, and without SMTP the
emails are printed in the API logs (`make logs s=api`), links included.

| Variable | Meaning |
| -------- | ------- |
| `JWT_SECRET` | ≥ 32 random characters. Changing it signs everyone out and resets 2FA secrets. |
| `REQUIRE_EMAIL_VERIFICATION` | `true` = no sign-in before clicking the email link. Turn on once SMTP works. |
| `SMTP_*`, `EMAIL_FROM` | Any SMTP server. Resend: `smtp.resend.com`, port 465, secure, user `resend`, password = API key. |
| `GOOGLE_*`, `GITHUB_*`, `FORTYTWO_*` | OAuth apps. A button shows up only when both id and secret are set. |

Callback URL to register at Google / GitHub / 42 (adapt host and port to `SERVER_NAME` /
`HTTPS_PORT`): `https://localhost:8443/api/auth/oauth/<google|github|42>/callback`.

- **42**: intra → Settings → API → Register a new app.
- **GitHub**: Settings → Developer settings → OAuth Apps.
- **Google**: Cloud console → Google Auth Platform → Clients (add your account as a test user).

---

## 6. Tests

- `cd apps/api && pnpm test`: password hashing, TOTP (RFC 6238 test vectors), encryption,
  backup codes, redirect checks.
- Every flow above was tried end to end through nginx (HTTPS): sign up, sign in, wrong
  password, refresh, sign out, 2FA with app and backup codes, lockout, trusted browser,
  password reset, email confirmation, OAuth redirects and account linking.
- One device at a time, in two browsers: PC:B refused, link emailed, PC:A kicked out of the
  office ~1 s after the link was opened, PC:B signs in; link in a third browser needs the
  password; reused, forged or too-frequent links refused; no takeover without a full sign-in.

## 7. Known limits

- Real Google / GitHub / 42 sign-in needs their credentials in `.env` (not committed).
- Without SMTP, emails only go to the API logs.
- Next for Mira: profile + avatar (M3), invitations (M4), members and roles (M5).

## 8. Dev identity switcher (`DEV_LOGIN`)

Set `DEV_LOGIN=true` in `.env` (default `false`; **never in production**: it is ignored when
`NODE_ENV=production`, and the api logs a loud warning at startup when on), then recreate the api
(`docker compose ... up -d api`).

- `/login` and `/register` show an identity switcher instead of the forms: click a user to sign in as
  them (no password, no 2FA), or create a test user (random name, verified email, optionally joining an
  existing office with a random character). "Use the real sign-in" shows the normal forms.
- The user menu gets "Switch user (dev)" (signs out, then back to the switcher).
- Endpoints, all public and refusing when off (`GET` answers `enabled: false`, the others 404):
  `GET /api/auth/dev` -> `{ enabled, users[] }`, `POST /api/auth/dev/login { userId }`,
  `POST /api/auth/dev/users { name?, joinUserId? }`. They use the normal session code, so the
  one-device rule still applies.
- Code: `apps/api/src/auth/dev-login.*`, `apps/web/features/auth/DevSwitcher.tsx`.
