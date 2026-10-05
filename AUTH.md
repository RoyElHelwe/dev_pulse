# Authentication module — handoff notes

**Owner:** Mira · **Branch:** `auth-setup` · **Status:** working locally, not yet merged into `main`

This document explains what the auth module does, how to run it, and how to use it from your own code.

---

## 1. What's included

| Feature | Status |
|---|---|
| Register / login / logout with email + password (hashed + salted by Better Auth) | ✅ Done |
| Sessions (cookie + `session` table) | ✅ Done |
| Form validation with Zod (frontend) | ✅ Done |
| Email verification + "resend verification email" (Resend) | ✅ Done |
| OAuth 2.0: Google + GitHub (**Minor module**) | ✅ Done |
| 2FA: authenticator app (TOTP) + backup codes (**Minor module**) | ✅ Done, partly tested — see §9 |

Libraries: **Better Auth** (auth logic), **Prisma 7** (ORM), **PostgreSQL** (Docker), **Resend** (emails), **Zod** (validation).

---

## 2. Architecture

```
Browser
  ↓
auth-module   Next.js frontend   http://localhost:3000   pages + authClient
  ↓  (fetch with cookies, CORS allowed)
auth-backend  NestJS backend     http://localhost:4000   Better Auth on /api/auth/*
  ↓
auth-db       PostgreSQL (Docker) localhost:5432         database "auth"
  ↘
   Resend (external) → sends verification emails
   Google / GitHub (external) → OAuth login
```

All secrets live **only in the backend `.env`**. The frontend only knows the backend URL.

---

## 3. How to run it

**1. Start the database** (Docker Desktop must be running)

First time only:
```bash
docker run -d --name auth-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=auth -p 5432:5432 postgres:16
```
Every other time: `docker start auth-db` (or ▶ in Docker Desktop).

**2. Backend**
```bash
cd auth-backend
npm install
# create .env (see §4)
npx prisma migrate dev     # creates all tables
npx prisma generate
npm run start:dev          # NestJS uses start:dev, not dev
```
Check: http://localhost:4000/api/auth/ok → `{"ok":true}`

**3. Frontend**
```bash
cd auth-module
npm install
# create .env (see §4)
npm run dev
```
Open http://localhost:3000/register

---

## 4. Environment variables

**`auth-backend/.env`** (never commit it)

| Variable | Why it exists |
|---|---|
| `DATABASE_URL` | Prisma connection string, e.g. `postgresql://postgres:postgres@localhost:5432/auth` |
| `BETTER_AUTH_SECRET` | Signs/encrypts session cookies and tokens. Long random string: `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Public URL of the **backend** (`http://localhost:4000`). Used to build email-verification links and OAuth callback URLs |
| `RESEND_API_KEY` | Lets the backend send emails through Resend (`re_...`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (Google Cloud → Google Auth Platform → Clients) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App (GitHub → Settings → Developer settings → OAuth Apps) |

**`auth-module/.env`**

| Variable | Why it exists |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Where the frontend sends auth requests (`http://localhost:4000`). Not a secret. Restart `npm run dev` after changing it |

> Ask me for the Google/GitHub/Resend credentials, or create your own. Each OAuth app must have these redirect URLs registered **exactly**:
> - `http://localhost:4000/api/auth/callback/google`
> - `http://localhost:4000/api/auth/callback/github`

---

## 5. Files

### Backend (`auth-backend/src`)

| File | Role |
|---|---|
| `lib/auth.ts` | **The Better Auth config.** Every auth feature is turned on here: email+password, email verification, Google/GitHub, 2FA plugin, trusted origins |
| `lib/email.ts` | `sendEmail(to, subject, html)`. The **only** place that sends emails (via Resend). Reuse it for any future email |
| `lib/prisma.ts` | The single Prisma client used by the whole backend |
| `main.ts` | Loads `dotenv` first, `bodyParser: false` (Better Auth reads requests itself), CORS for `http://localhost:3000` with `credentials: true`, port 4000 |
| `app.module.ts` | Imports `AuthModule` from `@thallesp/nestjs-better-auth`, which mounts all routes under `/api/auth/*` |
| `prisma/schema.prisma` | Tables: `user`, `session`, `account`, `verification`, `twoFactor` |

### Frontend (`auth-module`)

| File | Role |
|---|---|
| `lib/auth-client.ts` | `authClient` pointing to the backend, with the `twoFactorClient()` plugin. **Every page talks to auth through this** |
| `app/register/page.tsx` | Register form (Zod) → "check your email" message. Google/GitHub buttons |
| `app/login/page.tsx` | Login form (Zod). Handles: not verified (403 → resend button), 2FA redirect, OAuth errors (`?error=`) |
| `app/two-factor/page.tsx` | Enter the 6-digit code or a backup code after the password step |
| `app/dashboard/page.tsx` | **Test page**: shows the session, logout. Replace it with the real app pages |
| `app/dashboard/two-factor-settings.tsx` | Turn 2FA on (QR code), turn off, new backup codes |
| `components/oauth-buttons.tsx` | "Continue with Google / GitHub" buttons |

---

## 6. Database tables

| Table | What's in it |
|---|---|
| `user` | name, email, `emailVerified`, `twoFactorEnabled` |
| `account` | How a user logs in. `providerId = "credential"` → hashed password here. `"google"` / `"github"` → OAuth link |
| `session` | One row per logged-in browser. The cookie holds its token |
| `verification` | Short-lived tokens (email links, OAuth state) |
| `twoFactor` | TOTP secret + backup codes per user |

One user can have several `account` rows: if someone registers with email and later uses Google with the same email, Better Auth links both to the same user.

---

## 7. The flows

**Register + email verification**
```
Register form → Zod → authClient.signUp.email(callbackURL=/dashboard)
→ user created (emailVerified=false) + token in verification table
→ auth.ts sendVerificationEmail → email.ts → Resend → inbox
→ user clicks link → backend checks token → emailVerified=true
→ auto sign-in → redirect to /dashboard
```
Login before verifying → **403** → login page shows "Resend verification email".

**Login**
```
Login form → Zod → authClient.signIn.email
→ password checked → session row + cookie → app
```

**OAuth (Google / GitHub)**
```
Button → authClient.signIn.social → backend → Google/GitHub login page
→ back to /api/auth/callback/<provider> → user/account/session created → /dashboard
```

**2FA**
```
Turn on (dashboard): password → QR code + backup codes → scan → first code → 2FA active
Sign in: email+password ✔ → no session yet → /two-factor → code ✔ → session → /dashboard
```

---

## 8. Using auth in your code

### Backend (NestJS)

**Every route is protected by default** (global guard from `AuthModule`). No session → `401`.

```ts
import { Controller, Get } from "@nestjs/common";
import { Session, UserSession, AllowAnonymous } from "@thallesp/nestjs-better-auth";

@Controller("profile")
export class ProfileController {
  @Get("me")
  me(@Session() session: UserSession) {
    return session.user;          // the logged-in user (id, name, email...)
  }

  @Get("public")
  @AllowAnonymous()               // opt out: anyone can call it
  open() {
    return { ok: true };
  }
}
```

- Use `session.user.id` to link your data (games, messages, friends...) to a user.
- Mark public pages/routes (home, Privacy Policy, Terms of Service) with `@AllowAnonymous()`.
- `bodyParser` is turned off for Better Auth. **Check that your own POST routes still receive their body**; if not, tell me.

### Frontend (Next.js)

```ts
import { authClient } from "@/lib/auth-client";

const { data: session, isPending } = authClient.useSession(); // who is logged in?
await authClient.signOut();                                    // logout
```

Requests from the frontend to the backend must send cookies (`credentials: "include"` if you use `fetch` yourself).

---

## 9. Known limitations / TODO

- **Resend test mode:** sender is `onboarding@resend.dev`, so emails only reach **the Resend account owner's email**. A verified domain is needed for the evaluation.
- **2FA is only asked on email+password login.** Google/GitHub logins skip it (Better Auth default). Planned fix: also require the code for OAuth logins when 2FA is on.
- **2FA sign-in with email+password not fully tested yet** (only enabling 2FA was tested).
- **Backend validation:** Better Auth checks email format and password length (min 8), but there is no custom Zod validation on the backend yet. The subject requires both sides.
- **Not done:** forgot/reset password, HTTPS (subject requires it), production URLs (redirect URLs, `trustedOrigins`, `callbackURL` are hardcoded to `localhost`).
- **Docker:** only the database runs in Docker for now. The subject requires the whole project to start with **one command**.
- `@nestjs/observe` was installed with the NestJS project; it logs a harmless `Telemetry rejected (401)` error and can be removed.

---

## 10. Troubleshooting

| Error | Cause / fix |
|---|---|
| `Failed to fetch` in the frontend | Backend not running → `npm run start:dev` in `auth-backend` |
| `500` + `ECONNREFUSED` / Prisma `P1001` | Database stopped → `docker start auth-db` |
| `redirect_uri_mismatch` | The redirect URL in Google/GitHub doesn't exactly match `BETTER_AUTH_URL/api/auth/callback/<provider>` |
| Google: "access blocked" | Add your Gmail under Google Auth Platform → Audience → Test users |
| Login → "verify your email" | Click the link in the email, or use the resend button |
| No verification email | Check spam and Resend's Emails page; in test mode only the Resend owner's email works |