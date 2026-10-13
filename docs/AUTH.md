# Authentication

**Owners:** Roy, Zakaria · **Implementation details:** see [docs/code/auth.md](code/auth.md)

Rebuilt on our NestJS API with secure access tokens and rotating refresh tokens, featuring password reset, social sign-in (Google, GitHub, 42), two-factor authentication (2FA) for all sign-in methods, full validation, rate limits, HTTPS, and single-device session enforcement.

---

## 1. Features

| Feature | Where |
| ------- | ----- |
| Sign up / sign in / sign out with email + password | `/register`, `/login` |
| Form validation on frontend and backend | `/register`, `/login`, settings |
| Email confirmation + "send again" | `/verify-email` |
| Forgot / reset password (1-hour link), change or set a password | `/forgot-password`, `/reset-password`, settings |
| Sign in with **Google, GitHub, 42** | buttons appear when configured |
| **2FA**: authenticator app (TOTP), 10 single-use backup codes, "trust this browser for 30 days" | `/two-factor`, settings |
| 2FA prompt after Google / GitHub / 42 sign-in | `/two-factor` |
| Active devices: list, sign out one, sign out everywhere | `/settings/security` |
| **One device at a time**: second device blocked if active; emailed link closes all sessions | `/close-sessions` |
| Signed-out devices leave **at once** in real time, even in the middle of the office | office view |
| Rate limits, CSRF protection, uniform error messages preventing account enumeration | all auth views |
| Privacy Policy, Terms of Service | `/privacy`, `/terms` |

---

## 2. User Experience & Flows

### Standard Sign-In
1. The user signs in at `/login` with email and password.
2. If credentials match, the session is established and the user is redirected to `/office`.
3. The session remains active automatically as long as the user has Dev Pulse open in their browser.
4. If an account does not exist or credentials fail, a generic error message ("Wrong email or password") is displayed to prevent email enumeration.

### Two-Factor Authentication (2FA)
- Once enabled in `/settings/security`, sign-in requires a 6-digit verification code from an authenticator app (Google Authenticator, 1Password, etc.) or a recovery backup code.
- 2FA also applies to social logins (Google, GitHub, 42).
- Users can check **"Trust this browser for 30 days"** to bypass 2FA prompts on recognized computers.
- If the authenticator is lost, any of the 10 backup codes generated during setup can be used. Each backup code works only once.
- Entering 5 incorrect 2FA codes locks verification attempts for 5 minutes.

### One Device at a Time
To ensure presence integrity in the virtual office, each account can only be actively used on one device at a time:
- **Active Session**: A device is considered active if it has been used within the last 20 minutes. Idle or sleeping computers do not block new sign-ins; they are replaced automatically.
- **Second Device Blocked**: If you sign in on Device B while Device A is actively in use, Device B is notified that the account is currently open elsewhere (showing Device A's browser and operating system).
- **Session Takeover via Email**:
  1. Device B can request a "Close all sessions" email link.
  2. The link is sent directly to the account's registered email address, expiring after 15 minutes.
  3. Clicking the link immediately closes all open sessions. Device A is notified in real time and evicted from the virtual office to `/login`.
  4. Device B can then sign in normally.
  5. If the link is opened in a different browser than the one that requested it, the account password must be provided to confirm ownership.

---

## 3. Security Guarantees

- **Browser Storage Security**: All authentication credentials and session tokens are stored in secure, `httpOnly` cookies. Client-side JavaScript cannot read them, preventing token theft via Cross-Site Scripting (XSS).
- **Protection Against Token Replay**: Device sessions use single-use rotating tokens. If an expired or copied session token is detected, that device session is immediately revoked across all tabs.
- **Instant Revocation**: When you sign out, change your password, or close sessions from another device, your browser is disconnected immediately over a real-time channel rather than waiting for an expiration timer.
- **Brute-Force & Flood Protection**: All authentication endpoints enforce strict rate limits (e.g. 5 registrations/min, 10 logins/min, 10 2FA attempts/min).
- **Encrypted Secrets**: Passwords are salted and hashed using memory-hard scrypt algorithms. 2FA secrets are encrypted at rest with authenticated AES-256-GCM.

---

## 4. Configuration (`.env`)

No external services are required for local development: startup scripts generate a secure secret, and without SMTP configured, email links are printed directly to the server logs.

| Variable | Description |
| -------- | ----------- |
| `JWT_SECRET` | Secret key (minimum 32 characters) used to sign authentication tokens. |
| `REQUIRE_EMAIL_VERIFICATION` | Set to `true` to block login until the email confirmation link has been clicked. |
| `SMTP_*`, `EMAIL_FROM` | Outgoing SMTP mail credentials (e.g. Resend, SendGrid, or local SMTP). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials. |
| `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET` | 42 Intra OAuth app credentials. |

Social sign-in buttons appear automatically on `/login` and `/register` only when their respective client credentials are configured.

OAuth callback URLs to configure with identity providers (adjust host and port as needed):
- `https://localhost:8443/api/auth/oauth/google/callback`
- `https://localhost:8443/api/auth/oauth/github/callback`
- `https://localhost:8443/api/auth/oauth/42/callback`

**Google on a LAN IP** (`SERVER_NAME=10.x.x.x`): Google rejects IP addresses in redirect URIs. Publish [tools/oauth-relay/index.html](../tools/oauth-relay/index.html) on any public HTTPS host (e.g. GitHub Pages) with its `APP_URL` set to `https://SERVER_NAME:HTTPS_PORT`, register that page's URL in Google, and set `GOOGLE_REDIRECT_URI` to it. Google sends the browser to the relay page, which forwards it to the app.

---

## 5. Dev Identity Switcher (`DEV_LOGIN`)

When running locally or in staging environments, setting `DEV_LOGIN=true` in `.env` turns on a developer identity switcher (**strictly disabled in production**):

- `/login` and `/register` display an identity switcher listing existing users. Clicking any user signs in immediately without requiring passwords or 2FA.
- You can create disposable test users with random names and avatars, optionally placing them in an existing office.
- A "Switch user (dev)" item appears in the top navigation user menu.
- Standard sign-in forms remain accessible via a "Use real sign-in" toggle.

---

## 6. Implementation & Code Architecture

For technical architecture, data flows, database schemas, cryptographic details, and guides for extending authentication (such as adding OAuth providers), see:

👉 **[docs/code/auth.md](code/auth.md)**
