#!/bin/sh
# Creates a self-signed certificate on first start (stored in the "certs"
# volume), and again whenever SERVER_NAME changes.
set -e

CERT_DIR=/etc/nginx/certs
NAME="${SERVER_NAME:-localhost}"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/cert.pem" ] && [ "$(cat "$CERT_DIR/.server_name" 2>/dev/null)" = "$NAME" ]; then
  exit 0
fi

case "$NAME" in
  localhost) SAN="DNS:localhost,IP:127.0.0.1" ;;
  *[!0-9.]*) SAN="DNS:$NAME,DNS:localhost,IP:127.0.0.1" ;;
  *)         SAN="IP:$NAME,DNS:localhost,IP:127.0.0.1" ;;
esac

echo "Generating self-signed certificate for $NAME"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
  -subj "/CN=$NAME" -addext "subjectAltName=$SAN" 2>/dev/null
echo "$NAME" > "$CERT_DIR/.server_name"
