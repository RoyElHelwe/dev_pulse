# Email Service

Dev Pulse service: a small HTTP API that sends email to real inboxes (Gmail, Outlook, ...).

```
app --HTTP--> email-api (FastAPI) --SMTP:587--> postfix (internal only) --587/STARTTLS--> smtp.gmail.com --> recipient
```

No domain, SPF, DKIM or reverse DNS is needed: mail is relayed through a Gmail account, so Gmail signs it and
outbound port 25 is never used.

Both containers (`postfix`, `email-api`) are defined in the root `docker-compose.yml` and start together with
the rest of the app (`make` / `make dev`). Settings live in the root `.env` (section "Email service").
Until a Gmail login is configured, `/send` returns 503 and `/health` reports `degraded`; the rest of the app is unaffected.

## 1. Gmail login: App Password or OAuth2

**Option A: App Password (simplest)**

1. Turn on 2-Step Verification: Google Account > Security > 2-Step Verification.
2. Open <https://myaccount.google.com/apppasswords> and create an app password.
3. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` (16 characters, no spaces) in `.env`.

**Option B: OAuth2**

1. In Google Cloud Console, enable the Gmail API and create an OAuth client of type **Desktop app**
   (for a **Web application** client, add `http://127.0.0.1:8765/` as an authorized redirect URI).
   If the consent screen is in "Testing" mode, add your Gmail address as a test user.
2. Set `GMAIL_USER`, `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` in `.env`.
3. On a machine with a browser, from the repo root (needs `pip install python-dotenv`):
   ```bash
   python apps/email-service/get_gmail_refresh_token.py
   ```
   Sign in with the Gmail account to send from. The script saves `GMAIL_OAUTH_REFRESH_TOKEN` and `GMAIL_USER` in `.env`.
4. Apply it: `make` (or `docker compose up -d --force-recreate postfix email-api`).

OAuth is only used once `GMAIL_OAUTH_REFRESH_TOKEN` is set; until then the App Password is used.
Refresh tokens from a consent screen in "Testing" mode expire after 7 days; publish the app to avoid that.
Postfix stores the token in its volume on first start. To switch to a new refresh token later:
`docker compose exec postfix sh -c 'rm -f /var/spool/postfix/xoauth2-tokens/*'`, then recreate postfix.

## 2. Settings (root `.env`)

| Variable | Purpose |
|----------|---------|
| `GMAIL_USER` | Gmail address: relay login and sender address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (option A) |
| `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` | OAuth2 client (option B) |
| `GMAIL_OAUTH_REFRESH_TOKEN` | OAuth2 refresh token from `get_gmail_refresh_token.py` (option B) |
| `EMAIL_API_KEY` | Secret callers send in the `X-API-Key` header (`openssl rand -hex 32`) |
| `EMAIL_API_FROM_NAME` | Optional display name for the From header |
| `EMAIL_API_PORT` | Host port for the API (default `8025`, bound to 127.0.0.1) |
| `EMAIL_API_RATE_LIMIT_PER_MIN` | `/send` calls per minute per key+IP (default `30`, `0` disables) |

## 3. Run

```bash
make                                      # starts the whole app, including postfix + email-api
make logs s=postfix                       # look for relay=smtp.gmail.com ... status=sent
```

On a fresh server, install Docker first: `curl -fsSL https://get.docker.com | sh` and
`sudo usermod -aG docker $USER` (log out and back in). Works on x86_64 and ARM64.

### Using it from the Dev Pulse api

The api can send its mail (verification links etc.) through the same relay. In `.env`:
`SMTP_HOST=postfix`, `SMTP_PORT=587`, `SMTP_SECURE=false`, empty `SMTP_USER` / `SMTP_PASS`,
and `EMAIL_FROM=Dev Pulse <your GMAIL_USER address>`. Then run `make` again.

## 4. Test

```bash
curl http://127.0.0.1:8025/health

curl -X POST http://127.0.0.1:8025/send \
  -H "X-API-Key: $EMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":["me@example.com"],"subject":"Test","text":"Hello from my server"}'
```

Or: `TEST_TO=me@example.com python apps/email-service/test_email_api.py` (reads `EMAIL_API_KEY` and
`EMAIL_API_PORT` from `.env`; needs `pip install python-dotenv`).

## API

`POST /send` (header `X-API-Key` required)

```json
{"to": ["a@x.com"], "cc": [], "bcc": [], "subject": "...", "text": "...", "html": "...", "reply_to": "..."}
```

- At least one of `text` / `html` is required (both = multipart/alternative).
- Max 50 recipients per request; rate limited per key+IP.
- Responses: `200 {"status":"queued","message_id":"...","recipients":n}`, `401` bad/missing key,
  `422` invalid body, `429` rate limited, `502` SMTP error.

`GET /health` returns `healthy` if Postfix answers an SMTP `NOOP`, else `degraded`.

## Exposure

The API listens on `127.0.0.1` only. To allow outside callers, change its port mapping in `docker-compose.yml`
to `0.0.0.0:...` and open the port in the host firewall and cloud security rules (ideally behind HTTPS).
Postfix never gets a published port; exposing it would create an open relay.

## Limits

- Gmail allows about 500 messages/day (each recipient counts). Over the limit, Gmail temporarily refuses
  and Postfix keeps retrying from its queue (persisted in the `postfix_queue` volume).
- Mail is always sent **from `GMAIL_USER`**; Gmail rewrites any other From address.
  Use `EMAIL_API_FROM_NAME` for a display name and `reply_to` for replies.
- Max message size ~25 MB.
