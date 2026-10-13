"""
One-time helper: gets a Gmail OAuth2 refresh token for the Postfix relay and
saves it as GMAIL_OAUTH_REFRESH_TOKEN (and the signed-in address as GMAIL_USER)
in the repo-root .env.

Reads GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET from .env, opens the
Google consent page, and catches the redirect on http://127.0.0.1:<port>/.

Usage (from the repo root): python apps/email-service/get_gmail_refresh_token.py [port]
(default port 8765; needs `pip install python-dotenv`)
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import base64
import json
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

from dotenv import dotenv_values

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "openid email https://mail.google.com/"


def set_env_value(key: str, value: str):
    """Set KEY=value in .env, keeping the file's LF line endings."""
    text = ENV_FILE.read_text(encoding="utf-8")
    line = f"{key}={value}"
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    if pattern.search(text):
        text = pattern.sub(lambda _: line, text, count=1)
    else:
        text = text.rstrip("\n") + f"\n{line}\n"
    with open(ENV_FILE, "w", encoding="utf-8", newline="") as f:
        f.write(text)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
redirect_uri = f"http://127.0.0.1:{port}/"
env = dotenv_values(ENV_FILE)
client_id = env.get("GMAIL_OAUTH_CLIENT_ID")
client_secret = env.get("GMAIL_OAUTH_CLIENT_SECRET")
if not client_id or not client_secret:
    sys.exit(f"Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in {ENV_FILE}")

state = secrets.token_urlsafe(16)
result = {}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
        if params.get("state") != state:
            self.send_response(400)
            self.end_headers()
            return
        result.update(params)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Done. You can close this tab and return to the terminal.")

    def log_message(self, *args):
        pass


url = AUTH_URL + "?" + urllib.parse.urlencode({
    "client_id": client_id,
    "redirect_uri": redirect_uri,
    "response_type": "code",
    "scope": SCOPE,
    "access_type": "offline",
    "prompt": "consent",
    "state": state,
})
print(f"Open this URL and sign in with {env.get('GMAIL_USER') or 'your Gmail account'}:\n\n{url}\n")
webbrowser.open(url)

server = HTTPServer(("127.0.0.1", port), Handler)
while "code" not in result and "error" not in result:
    server.handle_request()
server.server_close()

if "error" in result:
    sys.exit(f"Authorization failed: {result['error']}")

data = urllib.parse.urlencode({
    "code": result["code"],
    "client_id": client_id,
    "client_secret": client_secret,
    "redirect_uri": redirect_uri,
    "grant_type": "authorization_code",
}).encode()
try:
    with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=data), timeout=30) as resp:
        tokens = json.loads(resp.read())
except urllib.error.HTTPError as e:
    sys.exit(f"Token exchange failed: {e.code} {e.read().decode(errors='replace')}")

refresh_token = tokens.get("refresh_token")
if not refresh_token:
    sys.exit("Google did not return a refresh token. Remove the app's access at "
             "https://myaccount.google.com/permissions and run this again.")

set_env_value("GMAIL_OAUTH_REFRESH_TOKEN", refresh_token)
print(f"Saved GMAIL_OAUTH_REFRESH_TOKEN to {ENV_FILE}")

id_token = tokens.get("id_token", "")
if id_token.count(".") == 2:
    payload = id_token.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    if claims.get("email"):
        set_env_value("GMAIL_USER", claims["email"])
        print(f"Saved GMAIL_USER={claims['email']}")

print("Apply it with: make   (or: docker compose up -d --force-recreate postfix email-api)")
