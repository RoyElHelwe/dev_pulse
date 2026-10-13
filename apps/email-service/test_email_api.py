import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

API_URL = os.getenv("EMAIL_API_URL", f"http://127.0.0.1:{os.getenv('EMAIL_API_PORT', '8025')}").rstrip("/")
API_KEY = os.getenv("EMAIL_API_KEY")
TEST_TO = os.getenv("TEST_TO")

if not API_KEY or not TEST_TO:
    print("Set EMAIL_API_KEY and TEST_TO (and optionally EMAIL_API_URL).")
    sys.exit(1)


def call(method, path, body=None, api_key=API_KEY):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key
    req = urllib.request.Request(f"{API_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


print("Health:", call("GET", "/health"))
print("Bad key (expect 401):", call("POST", "/send", {"to": [TEST_TO], "subject": "x", "text": "x"}, api_key="wrong")[0])
print("No body (expect 422):", call("POST", "/send", {"to": [TEST_TO], "subject": "x"})[0])

status, result = call("POST", "/send", {
    "to": [TEST_TO],
    "subject": "Test from email-service",
    "text": "Hello from my server (plain text).",
    "html": "<p>Hello from <b>my server</b> (HTML).</p>",
})
print("Send:", status, result)
sys.exit(0 if status == 200 else 1)
