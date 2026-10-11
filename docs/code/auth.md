# Authentication & Session Architecture

## Purpose

The authentication subsystem provides secure identity management, credential verification, cryptographic session tracking, and single-device enforcement across the Dev Pulse virtual office platform. It supports password-based accounts, OAuth 2.0 social logins (Google, GitHub, 42) with PKCE, Time-based One-Time Password (TOTP) two-factor authentication with single-use backup recovery codes, 30-day device trust, proactive token refresh rotation with replay theft detection, email verification and password recovery, and instant multi-tab session eviction via real-time WebSockets.

---

## Where it lives

### Backend (`apps/api/src/`)

| File | One-line job |
| --- | --- |
| `apps/api/src/auth/auth.module.ts` | Root authentication module registering controllers, services, JWT cryptographic config, and global `AuthGuard`. |
| `apps/api/src/auth/auth.controller.ts` | HTTP controller exposing endpoints for registration, credentials login, 2FA, password reset, sessions, and token rotation. |
| `apps/api/src/auth/auth.service.ts` | Core domain service orchestrating credential verification, timing-safe defenses, 2FA challenges, and active session gating. |
| `apps/api/src/auth/tokens.service.ts` | Issues and verifies JWT access/purpose tokens, executes atomic refresh token rotation, and tracks active device session families. |
| `apps/api/src/auth/session-takeover.service.ts` | Manages single-device takeover requests, issuing emailed links bound to the requesting browser via cryptographic cookies. |
| `apps/api/src/auth/two-factor.service.ts` | Manages TOTP provisioning, encrypted secret storage at rest, RFC 6238 verification, backup codes, and trusted device tokens. |
| `apps/api/src/auth/password.service.ts` | Manages forgot-password link dispatch, token redemption, password updates, and concurrent session revocations. |
| `apps/api/src/auth/verification.service.ts` | Dispatches email verification links and confirms account email ownership. |
| `apps/api/src/auth/email-tokens.service.ts` | Generates, hashes (SHA-256), and atomically consumes single-use action tokens (`AuthToken`) for email flows. |
| `apps/api/src/auth/session.gateway.ts` | WebSocket gateway on the `/session` namespace pushing immediate `session:ended` eviction events to connected browser tabs. |
| `apps/api/src/auth/session-events.ts` | In-process RxJS `Subject` event bus notifying gateways when session families are terminated. |
| `apps/api/src/auth/cookies.ts` | Defines cookie names (`COOKIES`), security parameters (`COOKIE_OPTIONS`), and cookie lifecycle helpers. |
| `apps/api/src/auth/client-info.ts` | Extracts client IP, user-agent, and existing refresh token cookies from incoming Express requests. |
| `apps/api/src/auth/user-agent.ts` | Parses user-agent strings into human-friendly device descriptions (e.g. "Chrome on macOS"). |
| `apps/api/src/auth/public-user.ts` | Sanitizes internal Prisma `User` records into client-safe `PublicUser` profiles omitting sensitive secrets. |
| `apps/api/src/auth/crypto/password.ts` | Computes memory-hard scrypt password hashes with random salts and executes constant-time comparisons. |
| `apps/api/src/auth/crypto/totp.ts` | Implements RFC 6238 TOTP computation, Base32 encoding/decoding, clock drift tolerance (+/-1 step), and `otpauth://` URIs. |
| `apps/api/src/auth/crypto/secrets.ts` | HKDF key derivation, AES-256-GCM authenticated encryption, random token generation, and backup recovery codes. |
| `apps/api/src/auth/crypto/redirect.ts` | Validates relative redirect URLs to prevent open-redirect vulnerabilities. |
| `apps/api/src/auth/oauth/oauth.controller.ts` | HTTP controller routing OAuth provider redirects and processing provider callback exchanges. |
| `apps/api/src/auth/oauth/oauth.service.ts` | Handles OAuth state cookies, PKCE code verifiers, token exchange, and account linking logic. |
| `apps/api/src/auth/oauth/providers.ts` | Provider registry (`PROVIDERS`) defining endpoints, scopes, PKCE settings, and profile normalization for Google, GitHub, and 42. |
| `apps/api/src/auth/dto/register.dto.ts` | Validates user registration payloads (`displayName`, `email`, `password`). |
| `apps/api/src/auth/dto/login.dto.ts` | Validates credentials login payloads (`email`, `password`). |
| `apps/api/src/auth/dto/two-factor.dto.ts` | Validates 2FA setup, enable, verify, and backup code request payloads. |
| `apps/api/src/auth/dto/password.dto.ts` | Validates password change and reset request payloads. |
| `apps/api/src/auth/dto/email.dto.ts` | Validates email token confirmation and resend payloads. |
| `apps/api/src/auth/dto/close-sessions.dto.ts` | Validates session takeover confirmation payloads (`token`, optional `password`). |
| `apps/api/src/auth/dto/validation.ts` | Shared `class-validator` decorator factories (`IsEmailField`, `IsNewPassword`, `IsDisplayName`). |
| `apps/api/src/common/auth/auth.guard.ts` | Global HTTP guard validating JWT access token signatures and database session liveness. |
| `apps/api/src/common/auth/auth-user.ts` | Type definition for authenticated request context (`{ id: string, sessionId: string }`). |
| `apps/api/src/common/auth/current-user.decorator.ts` | NestJS parameter decorator resolving `AuthUser` from `request.user`. |
| `apps/api/src/common/auth/public.decorator.ts` | Method/class decorator bypassing `AuthGuard` for public endpoints. |
| `apps/api/src/common/auth/socket-auth.ts` | Verifies JWT tokens from Socket.IO handshake auth objects or cookie headers. |
| `apps/api/src/dev/dev.module.ts` | Conditionally imports dev identity switching controllers and gateways when `DEV_LOGIN=true` outside production. |
| `apps/api/src/dev/dev.controller.ts` | Dev-only endpoints for listing personas (`/api/auth/dev/users`), fast switching, and throwaway user creation. |
| `apps/api/src/dev/dev.service.ts` | Bypasses passwords/2FA for fast testing and creates randomized test accounts. |
| `apps/api/src/dev/dev.gateway.ts` | Dev WebSocket gateway on `/office` handling `dev:teleport` for automated browser testing. |
| `apps/api/src/dev/dev.dto.ts` | Validates dev login (`userId`) and throwaway user creation payloads. |

### Frontend (`apps/web/`)

| File | One-line job |
| --- | --- |
| `apps/web/features/auth/AuthProvider.tsx` | React context provider tracking auth state, scheduling proactive refresh timers, and managing `/session` socket connection. |
| `apps/web/features/auth/types.ts` | Client TypeScript models for user profiles, sign-in responses, active devices, and session termination reasons. |
| `apps/web/features/auth/schemas.ts` | Zod form schemas (`loginSchema`, `registerSchema`, `newPasswordSchema`, `emailField`) mirroring API rules. |
| `apps/web/features/auth/LoginForm.tsx` | Sign-in form coordinating password authentication, 2FA challenges, and session-active takeover alerts. |
| `apps/web/features/auth/RegisterForm.tsx` | Sign-up form with inline client validation and verification email prompts. |
| `apps/web/features/auth/TwoFactorForm.tsx` | Form for entering 6-digit TOTP codes or 10-character backup codes with "Trust this device" support. |
| `apps/web/features/auth/ActiveSessionNotice.tsx` | UI card notifying the user that their account is open elsewhere, with a trigger to send a takeover link. |
| `apps/web/features/auth/CloseSessions.tsx` | Confirmation view for the emailed session closure link. |
| `apps/web/features/auth/ForgotPasswordForm.tsx` | Request form for password recovery email links. |
| `apps/web/features/auth/ResetPasswordForm.tsx` | Form for setting a new password using a recovery token from email. |
| `apps/web/features/auth/VerifyEmail.tsx` | View handling email address confirmation link verification. |
| `apps/web/features/auth/OAuthButtons.tsx` | Renders social sign-in buttons dynamically based on configured providers from `/api/auth/providers`. |
| `apps/web/features/auth/UserMenu.tsx` | Top-bar user profile dropdown with settings links, dev user switcher trigger, and logout actions. |
| `apps/web/features/auth/HeaderActions.tsx` | Top-bar sign-in and sign-up action buttons for unauthenticated visitors. |
| `apps/web/features/auth/AuthShell.tsx` | Layout container providing consistent styling and responsive artwork for auth views. |
| `apps/web/features/auth/OfficeIllustration.tsx` | Pixel art SVG graphic rendered alongside authentication forms. |
| `apps/web/features/dev/DevSwitcher.tsx` | Persona switcher modal shown on `/login` and `/register` when dev login is enabled. |
| `apps/web/features/dev/useDevLogin.ts` | React hook checking `/api/auth/dev` status and querying test personas via api client. |
| `apps/web/features/dev/devHooks.ts` | Exposes `window.__devpulse` automation helpers (teleport, frame cap) for Playwright tests. |
| `apps/web/lib/api.ts` | Central HTTP client managing cookie authentication, Web Locks token refresh, and FormError conversion. |
| `apps/web/proxy.ts` | Next.js Edge middleware inspecting the `signed_in` cookie hint to redirect unauthenticated visits to protected routes. |

---

## How it works

### Credentials Login Flow

```
User (Browser)               Next.js / Nginx              NestJS API (AuthController / AuthService)
     │                             │                                            │
     │── POST /api/auth/login ────►│───────────────────────────────────────────►│
     │   { email, password }       │                                            │
     │                             │                                1. Lookup user in DB
     │                             │                                2. scrypt verifyPassword (or DUMMY_HASH)
     │                             │                                3. Check emailVerified if required
     │                             │                                4. If 2FA enabled & not trusted:
     │                             │                                   issue mfa_token cookie, return
     │                             │                                   { status: 'two-factor-required' }
     │                             │                                5. Check active session (last 20 min):
     │                             │                                   if active elsewhere:
     │                             │                                   issue takeover_token cookie, return
     │                             │                                   { status: 'session-active' }
     │                             │                                6. Otherwise: revoke older sessions,
     │                             │                                   create refresh token family in DB,
     │                             │                                   sign JWT access token
     │                             │                                            │
     │◄── Set-Cookie: access_token (httpOnly, 15 min, path /) ──────────────────│
     │◄── Set-Cookie: refresh_token (httpOnly, 30 days, path /api/auth) ────────│
     │◄── Set-Cookie: signed_in (readable, 30 days, path /) ────────────────────│
     │◄── HTTP 200 { status: 'signed-in', user } ───────────────────────────────│
```

### Proactive Refresh Rotation Flow & Theft Detection

```
Tab A                        Tab B (same browser)              NestJS API (TokensService)
  │                                    │                                    │
  │── ~1 min before expiry             │                                    │
  │── Acquires Web Lock                │                                    │
  │   'dev-pulse-refresh'              │                                    │
  │                                    │── Needs refresh                    │
  │                                    │── Waits for Web Lock               │
  │                                    │                                    │
  │── POST /api/auth/refresh ──────────────────────────────────────────────►│
  │   (sends refresh_token cookie)     │                                    │
  │                                    │                         1. Find token by sha256(token)
  │                                    │                         2. Verify not revoked, not expired
  │                                    │                         3. In Prisma $transaction:
  │                                    │                            a. Atomic update: revokedAt = now
  │                                    │                            b. Create new token in same familyId
  │                                    │                            c. Link replacedById = next.id
  │                                    │                         4. Sign new JWT access token
  │                                    │                                    │
  │◄── Set-Cookie: access_token, refresh_token, signed_in ──────────────────│
  │◄── HTTP 204 ────────────────────────────────────────────────────────────│
  │                                    │                                    │
  │── Releases Web Lock                │                                    │
  │                                    │── Acquires Web Lock                │
  │                                    │── Sees access token is fresh       │
  │                                    │── Skips redundant network call     │
```

#### Replay Theft Detection
If an attacker steals a used `refresh_token` and presents it to `POST /api/auth/refresh`:
1. The database finds `revokedAt !== null` on the token row.
2. If `Date.now() - revokedAt < 30_000` (within `REUSE_GRACE_MS`), it is treated as a harmless network/tab race, throwing `REFRESH_TOKEN_REUSED` without punishing the user.
3. If presented after 30 seconds, `TokensService.revokeSession(row.userId, row.familyId, 'security_alert')` is executed immediately.
4. All tokens sharing that `familyId` are revoked, and `SessionEvents.emit([familyId], 'security_alert')` sends a termination signal to `/session` WebSockets to evict the client immediately.

### One-Device Session Takeover Flow

```
Device B (New device)                    User Inbox                 Device A (Active in office)
       │                                      │                                 │
       │── Signs in (Password + 2FA OK)       │                                 │
       │◄── 200 { status: 'session-active' }  │                                 │
       │    Set-Cookie: takeover_token (10m)  │                                 │
       │                                      │                                 │
       │── POST /api/auth/sessions/close-req  │                                 │
       │   (validates takeover_token)         │                                 │
       │   Generates browser binding token    │                                 │
       │   Stores AuthToken(CLOSE_SESSIONS)   │                                 │
       │◄── Set-Cookie: close_sessions (15m)  │                                 │
       │                                      │                                 │
       │                                      │◄── Receives email with link     │
       │                                      │    (?token=...)                 │
       │                                      │                                 │
  [Case 1: Same Browser Clicks Link]          │                                 │
       │── POST /api/auth/sessions/close      │                                 │
       │   { token } + close_sessions cookie  │                                 │
       │   Binding matches: password bypassed │                                 │
       │                                      │                                 │
  [Case 2: Different Browser Clicks Link]     │                                 │
       │── POST /api/auth/sessions/close      │                                 │
       │   { token, password } (required)     │                                 │
       │                                      │                                 │
       │── Server revokes all sessions ────────────────────────────────────────►│
       │   Emits SessionEvents('sessions_closed')                               │ /session socket receives
       │◄── HTTP 204                          │                                 │ 'session:ended'
       │    Clears all session cookies        │                                 │ Tab redirects to
       │                                      │                                 │ /login?reason=sessions_closed
       │── User signs in cleanly on Device B  │                                 │
```

---

### Token Internals

#### Access Token (JWT)
- **Format**: Signed JSON Web Token (HS256).
- **Signing Key**: Derived via HKDF from `JWT_SECRET` using info string `'jwt'`: `deriveKey(config.jwtSecret, 'jwt')`.
- **Payload**:
  ```json
  {
    "sub": "<userId>",
    "sid": "<familyId>",
    "typ": "access",
    "iat": 1700000000,
    "exp": 1700000900,
    "iss": "dev-pulse"
  }
  ```
- **Lifetime**: 15 minutes (`DEFAULT_ACCESS_TOKEN_TTL_S = 900`).
- **Storage**: `access_token` httpOnly cookie.
- **Verification**: Handled by `TokensService.verifyAccessToken()` and `AuthGuard`. Does not query the database for signature verification, but checks `isSessionAlive(sid)` to support instant revocation.

#### Refresh Token (Opaque Hash)
- **Format**: 32 cryptographically random bytes encoded as URL-safe base64url (`randomToken()`).
- **Database Storage**: The raw token is never persisted. Only its SHA-256 hex digest is stored in `RefreshToken.tokenHash`.
- **Family Grouping**: All tokens in a rotation lineage share a `familyId` (16 bytes random token), representing a single persistent device session.
- **Lifetime**: 30 days (`DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30`).
- **Storage**: `refresh_token` httpOnly cookie restricted to path `/api/auth` with `SameSite=Strict`.

#### Purpose Tokens (Signed JWTs)
Short-lived JWTs signed with the same HKDF-derived secret, constrained by `typ`:
- `mfa` (`typ: 'mfa'`): Holds `{ sub: userId }`. Valid for 5 minutes (`MFA_STEP_SECONDS = 300`). Issued after password check; consumed at `POST /api/auth/2fa/verify`.
- `trust` (`typ: 'trust'`): Holds `{ sub: userId, v: enabledAt.getTime() }`. Valid for 30 days (`TRUSTED_DEVICE_TTL_DAYS = 30`). Stored in `trusted_device` cookie. If 2FA is disabled and re-enabled, timestamp `v` mismatches, invalidating the trust cookie immediately.
- `oauth` (`typ: 'oauth'`): Holds `{ state, verifier, provider, redirect }`. Valid for 10 minutes (`STATE_SECONDS = 600`). Stored in `oauth_state` cookie on path `/api/auth/oauth`.
- `takeover` (`typ: 'takeover'`): Holds `{ sub: userId, ua, ip }`. Valid for 10 minutes (`TAKEOVER_SECONDS = 600`). Stored in `takeover_token` cookie on path `/api/auth/sessions`.

#### Email Action Tokens (`AuthToken`)
- **Format**: 32-byte URL-safe base64url token. Stored as SHA-256 hash in `AuthToken.tokenHash`.
- **Single Active Invariant**: Creating a new token of a given type atomically deletes all pending unused tokens of that type for that user in `EmailTokensService.create()`.
- **Types & Lifetimes**:
  - `VERIFY_EMAIL`: 24 hours (`VERIFY_EMAIL_TTL_MS = 86_400_000`).
  - `RESET_PASSWORD`: 1 hour (`RESET_PASSWORD_TTL_MS = 3_600_000`).
  - `CLOSE_SESSIONS`: 15 minutes (`CLOSE_SESSIONS_TTL_MS = 900_000`), stores `bindingHash = sha256(binding)`.

---

### Two-Factor Authentication (TOTP & Backup Codes)

1. **Secret Generation & Storage**:
   - `TwoFactorService.setup()` generates a 20-byte (160-bit) random secret, encoded as unpadded RFC 4648 Base32 (`generateTotpSecret()`).
   - The secret is encrypted before database persistence using AES-256-GCM with a dedicated key derived via HKDF: `deriveKey(config.jwtSecret, 'totp-secret')`.
   - The payload format stored in `TwoFactor.secret` is `iv.tag.ciphertext` in base64url.
2. **Verification & Clock Drift**:
   - Calculated via HMAC-SHA1 over 8-byte big-endian 30-second counter steps per RFC 6238 (`totpAt()`).
   - `verifyTotp()` checks candidate steps `[step, step - 1, step + 1]` in constant time (`timingSafeEqual`) to tolerate 30 seconds of client clock drift.
   - **Replay Protection**: The successful step counter is persisted to `TwoFactor.lastUsedStep`. Any code submitted for a step `<= lastUsedStep` is rejected.
3. **Backup Codes**:
   - `generateBackupCodes()` produces 10 codes formatted as `xxxxx-xxxxx` using a 30-character lowercase alphanumeric alphabet (`abcdefghjkmnpqrstuvwxyz23456789`) that excludes ambiguous characters (`0`, `o`, `1`, `l`, `i`).
   - Codes are normalized (stripping hyphens and spaces) and stored as SHA-256 hashes in `TwoFactor.backupCodes`.
   - When verified, the matching hash is permanently removed from the array (`burn`).
4. **Lockout Protection**:
   - Up to 5 consecutive failed attempts (`MAX_TWO_FACTOR_ATTEMPTS`).
   - Exceeding 5 attempts sets `lockedUntil = Date.now() + 5 minutes` (`TWO_FACTOR_LOCKOUT_MS = 300_000`), locking verification until expiry.
5. **Session Invalidation on Enable**:
   - Enabling 2FA calls `TokensService.revokeAllSessions(userId, sessionId, 'security_alert')`, revoking all other signed-in sessions established prior to 2FA activation.

---

### OAuth 2.0 Integration

- **Supported Providers**: Google, GitHub, 42. Configured in `apps/api/src/auth/oauth/providers.ts`.
- **Dynamic Availability**: `GET /api/auth/providers` only exposes providers whose client credentials (`CLIENT_ID` and `CLIENT_SECRET`) are present in environment variables.
- **PKCE Support**: Enabled for Google (`pkce: true`). Uses 32-byte verifier, SHA-256 `code_challenge`, and `code_challenge_method: 'S256'`.
- **State Validation**: `start()` creates a 24-byte random state and signs an `oauth_state` purpose token cookie. `finish()` verifies that callback state matches the signed cookie.
- **Account Linking & Pre-hijacking Defense**:
  - Checks existing `OAuthAccount` record (`provider` + `providerUserId`).
  - If no link exists, requires a verified email (`emailVerified === true`). If third-party email is unverified, throws `OAuthError('oauth_email_unverified')`.
  - Links to existing user with matching email, or creates a new user without a password.
- **Post-Login Handling**:
  - If user has 2FA enabled, issues `mfa_token` cookie and redirects browser to `/two-factor?redirect=...`.
  - If an active session exists on another device, issues `takeover_token` cookie and redirects to `/login?error=session_active`.

---

### Cookies Configuration

All sensitive authentication cookies enforce `Secure` and appropriate `SameSite` policies:

| Cookie | Contents | Max-Age | Path | SameSite | HttpOnly | JS Readable |
| --- | --- | --- | --- | --- | --- | --- |
| `access_token` | JWT access token | 15 min | `/` | Lax | Yes | No |
| `refresh_token` | Opaque random token | 30 days | `/api/auth` | Strict | Yes | No |
| `signed_in` | Expiration timestamp (ms) | 30 days | `/` | Lax | **No** | **Yes** |
| `mfa_token` | Signed JWT purpose token | 5 min | `/api/auth` | Lax | Yes | No |
| `trusted_device` | Signed JWT purpose token | 30 days | `/api/auth` | Lax | Yes | No |
| `oauth_state` | Signed JWT purpose token | 10 min | `/api/auth/oauth` | Lax | Yes | No |
| `takeover_token` | Signed JWT purpose token | 10 min | `/api/auth/sessions` | Strict | Yes | No |
| `close_sessions` | Opaque random binding token | 15 min | `/api/auth/sessions` | Strict | Yes | No |

---

### Rate Limiting

Endpoints are throttled using NestJS `@nestjs/throttler` with a 60-second window (`THROTTLE_WINDOW_MS = 60_000`):

| Endpoint | Limit (requests / min) |
| --- | --- |
| `POST /api/auth/register` | 5 |
| `POST /api/auth/login` | 10 |
| `POST /api/auth/2fa/verify` | 10 |
| `POST /api/auth/email/resend` | 5 |
| `POST /api/auth/password/forgot` | 5 |
| `POST /api/auth/password/reset` | 10 |
| `POST /api/auth/sessions/close-request` | 3 |
| `POST /api/auth/sessions/close` | 5 |
| `POST /api/auth/refresh` | 60 |

In addition, session takeover requests enforce a per-user 60-second cooldown (`SESSION_TAKEOVER_COOLDOWN_MS = 60_000`) in `SessionTakeoverService`.

---

### Dev Identity Switcher (`DEV_LOGIN`)

- **Configuration**: Activated via `DEV_LOGIN=true` in `.env`.
- **Environment Gate**: Enforced by `isDevLoginEnabled(env)` (`apps/api/src/config/app-config.ts`):
  `env.DEV_LOGIN === 'true' && env.NODE_ENV !== 'production'`.
  Strictly inactive in production regardless of flag value.
- **Always-Mounted Status Route**: `GET /api/auth/dev` in `AuthController` returns `{ enabled: boolean }`. Always returns HTTP 200 to prevent browser console 404 errors on `/login`.
- **Dynamic Module Import**: `DevModule` is conditionally imported into NestJS root application module via `devImports(process.env)`. If disabled, dev controllers and gateways are not registered in the DI container.
- **Endpoints (`DevController` on `/api/auth/dev`)**:
  - `GET /users`: Lists up to 200 users with office names and roles.
  - `POST /login` (`{ userId }`): Calls `authService.devSignIn(userId, client)`, bypassing password and 2FA, immediately terminating prior sessions with reason `'signed_in_elsewhere'`.
  - `POST /users` (`{ name?, joinUserId? }`): Generates a verified throwaway user, optionally joining a workspace with a random character and free desk.
- **Testing Socket**: `DevGateway` listens on the `/office` namespace for `dev:teleport` events from Playwright E2E runners.

---

## Rules & invariants

1. **Secure by Default**: All routes require an authenticated `AuthUser` unless explicitly annotated with `@Public()`. Handled globally by `AuthGuard`.
2. **Single-Device Policy**: An account can only have one active session family at a time. A session is considered active if refreshed within the last 20 minutes (`ACTIVE_SESSION_WINDOW_MS = 1_200_000`). Logging in elsewhere when active is blocked unless confirmed via takeover email.
3. **Constant-Time Cryptography**: Password verification always runs `timingSafeEqual`. When an email is unrecognized, `AuthService.login()` runs verification against `DUMMY_HASH` to ensure execution timing matches real password evaluations.
4. **No Plaintext Action Tokens**: Email links and refresh tokens are stored in the database exclusively as SHA-256 digests (`tokenHash`).
5. **Atomic Refresh Token Rotation**: Refresh token exchanges run inside a Prisma transaction (`$transaction`). Old tokens are revoked with `revokedAt = now` guarded by `where: { revokedAt: null }`. Double-spending is rejected.
6. **Clean Browser Console (HTTP 200 Form Errors)**: Predictable validation mistakes (incorrect password, expired link, taken email, invalid 2FA code) return HTTP 200 with `{ error: { code, message, field? } }` via `FormError`. HTTP 4xx status codes are strictly reserved for actual protocol/network errors (401 unauthorized, 429 rate limit, 400 malformed JSON).
7. **Cross-Tab Web Lock Coordination**: Refresh calls from the browser utilize the Web Locks API (`navigator.locks.request('dev-pulse-refresh')`) to eliminate concurrent refresh race conditions between tabs.
8. **Origin Check & CSRF**: All sensitive cookies use `SameSite=Lax` or `SameSite=Strict`. Requests run on the same origin through Nginx reverse proxy.

---

## Why it's built this way

- **JWT Access + Database Refresh Tokens vs. Full DB Sessions**:
  Access tokens verify instantly in memory via HMAC-SHA256 without database queries on every route. Fast session revocation is preserved by checking a single indexed boolean (`isSessionAlive`) during requests, maintaining microsecond response times while preventing stale session retention.
- **httpOnly Cookies vs. LocalStorage**:
  Tokens are stored exclusively in httpOnly cookies, rendering them inaccessible to client-side JavaScript. This completely eliminates token theft risks via Cross-Site Scripting (XSS).
- **Token Family Rotation vs. Static Refresh Tokens**:
  Rotating refresh tokens on every single use bounds token lifetime. If an in-transit token is compromised, the first reuse triggers immediate token family revocation across the compromised device.
- **Real-Time `/session` Socket vs. Polling Revocation**:
  When a session is revoked (takeover, password change, sign out), `SessionGateway` pushes a `session:ended` WebSocket event to the client within seconds. The client disconnects live office sockets, WebRTC microphone streams, and redirects to `/login` immediately.
- **Browser-Bound Takeover Links vs. Open Email Links**:
  The takeover email contains a token tied to a random `close_sessions` cookie placed on the requesting browser. If an attacker intercepts the email and opens it on an external machine, the system demands the account password, preventing unauthorized takeover via email interception alone.
- **HTTP 200 Form Errors vs. HTTP 400/401**:
  Modern browsers (Chrome, Edge) log every 4xx HTTP response as a conspicuous red error in the developer console. To keep client consoles clean during ordinary user mistakes, form-level rejections return 200 with an explicit `{ error }` body translated by the frontend `api()` wrapper into `ApiError`.

---

## How to change it safely

### Walk-Through: Add a New OAuth 2.0 Provider (e.g. Discord)

1. **Update Configuration Types**:
   - In `apps/api/src/config/app-config.ts`:
     - Add provider name to `OAuthProvider` type union:
       ```ts
       export type OAuthProvider = 'google' | 'github' | '42' | 'discord';
       ```
     - In `AppConfig` constructor, map environment variables:
       ```ts
       this.oauth = {
         // ...
         discord: client(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET),
       };
       ```
2. **Define Provider Specification**:
   - In `apps/api/src/auth/oauth/providers.ts`:
     - Add `'discord'` to `PROVIDER_ORDER`:
       ```ts
       export const PROVIDER_ORDER: OAuthProvider[] = ['google', 'github', '42', 'discord'];
       ```
     - Implement provider specification in `PROVIDERS`:
       ```ts
       discord: {
         label: 'Discord',
         authorizeUrl: 'https://discord.com/api/oauth2/authorize',
         tokenUrl: 'https://discord.com/api/oauth2/token',
         scope: 'identify email',
         pkce: true,
         async fetchProfile(token) {
           const user = await getJson<{ id: string; email?: string; verified?: boolean; username: string; avatar?: string }>(
             'https://discord.com/api/users/@me',
             token,
           );
           return {
             id: user.id,
             email: user.email ?? null,
             emailVerified: user.verified === true,
             name: user.username,
             avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
           };
         },
       },
       ```
3. **Configure Frontend Branding**:
   - In `apps/web/features/auth/OAuthButtons.tsx`:
     - Add provider icon/styling to the button rendering map.
4. **Register External OAuth Application**:
   - Register the application in Discord Developer Portal.
   - Set callback URL: `https://<DOMAIN>/api/auth/oauth/discord/callback`.
5. **Set Environment Variables**:
   - Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to `.env`.

---

## Tests

- **Unit Tests**:
  - `apps/api/src/auth/crypto/crypto.spec.ts`:
    - RFC 6238 TOTP test vectors verification.
    - Base32 encoding and decoding round-trips.
    - `otpauth://` URI construction.
    - scrypt password hashing, salting, and constant-time equality.
    - AES-256-GCM authenticated encryption, decryption, and tamper detection.
    - `safeRedirect` open-redirect prevention.
  - `apps/api/src/dev/dev.spec.ts`:
    - `DEV_LOGIN` environment variable parsing and production suppression.
    - `DevModule` registration gating via `devImports`.
    - `DevGateway` delegation to `OfficeGateway.teleport`.
- **Test Commands**:
  - Run API unit tests:
    ```bash
    pnpm --filter api test
    ```
