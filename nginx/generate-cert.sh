#!/bin/sh
# Creates a self-signed certificate on first start (stored in the "certs"
# volume), and again whenever SERVER_NAME changes.
# Wires SSL credentials into nginx to provide HTTPS for api and web endpoints.
set -e

# Target directory mounted from the certs docker volume and default hostname.
CERT_DIR=/etc/nginx/certs
NAME="${SERVER_NAME:-localhost}"
mkdir -p "$CERT_DIR"

# Skip generation if a valid certificate already exists for the current SERVER_NAME.
if [ -f "$CERT_DIR/cert.pem" ] && [ "$(cat "$CERT_DIR/.server_name" 2>/dev/null)" = "$NAME" ]; then
  exit 0
fi

# Set Subject Alternative Names (SAN) for localhost, domain names, or IP addresses (LAN access).
case "$NAME" in
  localhost) SAN="DNS:localhost,IP:127.0.0.1" ;;
  *[!0-9.]*) SAN="DNS:$NAME,DNS:localhost,IP:127.0.0.1" ;;
  *)         SAN="IP:$NAME,DNS:localhost,IP:127.0.0.1" ;;
esac

# Generate self-signed RSA 2048-bit certificate valid for 365 days without interactive prompts.
echo "Generating self-signed certificate for $NAME"
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
  -subj "/CN=$NAME" -addext "subjectAltName=$SAN" 2>/dev/null
# Record SERVER_NAME to detect future hostname changes on container restarts.
echo "$NAME" > "$CERT_DIR/.server_name"
