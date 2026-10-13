"""
Email API Server (FastAPI)
Simple HTTP API for sending email to real inboxes:
- POST /send: queues a message on the local Postfix relay, which forwards it via Gmail SMTP
- GET /health: checks connectivity to the Postfix relay
"""

from collections import defaultdict, deque
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Deque, Dict, List, Optional
import logging
import os
import secrets
import smtplib
import sys
import threading
import time
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("email_api")

SMTP_HOST = os.getenv("SMTP_HOST", "postfix")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_TIMEOUT = float(os.getenv("SMTP_TIMEOUT", "15"))
FROM_ADDRESS = os.getenv("FROM_ADDRESS") or os.getenv("GMAIL_USER", "")
FROM_NAME = os.getenv("FROM_NAME", "")
EMAIL_API_KEY = os.getenv("EMAIL_API_KEY", "")
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "30"))
MAX_RECIPIENTS = 50

if not EMAIL_API_KEY:
    logger.critical("EMAIL_API_KEY is not set. Refusing to start.")
    sys.exit(1)
if not FROM_ADDRESS:
    logger.warning("FROM_ADDRESS (or GMAIL_USER) is not set. /send will return 503 until it is configured.")

app = FastAPI(
    title="Email API",
    description="Send email through a local Postfix relay backed by Gmail SMTP",
    version="1.0.0",
)


class SendRequest(BaseModel):
    to: List[EmailStr] = Field(..., min_length=1, description="Primary recipients")
    cc: List[EmailStr] = Field(default_factory=list)
    bcc: List[EmailStr] = Field(default_factory=list)
    subject: str = Field(..., max_length=998)
    text: Optional[str] = Field(None, description="Plain-text body")
    html: Optional[str] = Field(None, description="HTML body")
    reply_to: Optional[EmailStr] = None

    @field_validator("subject")
    @classmethod
    def no_newlines(cls, v: str) -> str:
        if "\r" in v or "\n" in v:
            raise ValueError("subject must not contain line breaks")
        return v

    @model_validator(mode="after")
    def check_body_and_recipients(self):
        if not self.text and not self.html:
            raise ValueError("at least one of 'text' or 'html' is required")
        if len(self.to) + len(self.cc) + len(self.bcc) > MAX_RECIPIENTS:
            raise ValueError(f"too many recipients (max {MAX_RECIPIENTS} per request)")
        return self


class SendResponse(BaseModel):
    status: str = "queued"
    message_id: str
    recipients: int


# Simple in-memory sliding-window rate limiter (per API key + client IP)
_rate_lock = threading.Lock()
_rate_hits: Dict[str, Deque[float]] = defaultdict(deque)


def check_rate_limit(client_id: str):
    if RATE_LIMIT_PER_MIN <= 0:
        return
    now = time.monotonic()
    with _rate_lock:
        hits = _rate_hits[client_id]
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_PER_MIN:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({RATE_LIMIT_PER_MIN}/min)")
        hits.append(now)


def require_api_key(x_api_key: Optional[str]):
    if not x_api_key or not secrets.compare_digest(x_api_key.encode(), EMAIL_API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def build_message(req: SendRequest) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((FROM_NAME, FROM_ADDRESS)) if FROM_NAME else FROM_ADDRESS
    msg["To"] = ", ".join(str(a) for a in req.to)
    if req.cc:
        msg["Cc"] = ", ".join(str(a) for a in req.cc)
    if req.reply_to:
        msg["Reply-To"] = str(req.reply_to)
    msg["Subject"] = req.subject
    msg["Message-ID"] = make_msgid(domain=Address(addr_spec=FROM_ADDRESS).domain)

    if req.text and req.html:
        msg.set_content(req.text)
        msg.add_alternative(req.html, subtype="html")
    elif req.html:
        msg.set_content(req.html, subtype="html")
    else:
        msg.set_content(req.text)
    return msg


@app.post("/send", response_model=SendResponse)
def send(req: SendRequest, request: Request, x_api_key: Optional[str] = Header(None)):
    require_api_key(x_api_key)
    if not FROM_ADDRESS:
        raise HTTPException(status_code=503, detail="Sender not configured: set GMAIL_USER in .env")
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"{x_api_key}|{client_ip}")

    msg = build_message(req)
    recipients = [str(a) for a in (*req.to, *req.cc, *req.bcc)]
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as smtp:
            smtp.send_message(msg, from_addr=FROM_ADDRESS, to_addrs=recipients)
    except (smtplib.SMTPException, OSError) as e:
        logger.error(f"SMTP error sending to {len(recipients)} recipient(s): {e}")
        raise HTTPException(status_code=502, detail=f"SMTP error: {e}")

    logger.info(f"Queued message {msg['Message-ID']} for {len(recipients)} recipient(s) from {client_ip}")
    return SendResponse(message_id=msg["Message-ID"], recipients=len(recipients))


@app.get("/health")
def health():
    smtp_ok = False
    error = None
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as smtp:
            code, _ = smtp.noop()
            smtp_ok = code == 250
    except (smtplib.SMTPException, OSError) as e:
        error = str(e)
    if not FROM_ADDRESS:
        error = "GMAIL_USER is not set"
    return {
        "status": "healthy" if smtp_ok and FROM_ADDRESS else "degraded",
        "smtp_host": f"{SMTP_HOST}:{SMTP_PORT}",
        "smtp_reachable": smtp_ok,
        "sender_configured": bool(FROM_ADDRESS),
        "error": error,
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8025"))
    uvicorn.run("email_api:app", host="0.0.0.0", port=port, reload=False)
