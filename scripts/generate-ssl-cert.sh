#!/bin/bash

# Load HOST_IP from .env if available
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep HOST_IP | xargs)
fi

# Use HOST_IP from env or default to localhost
HOST_IP=${HOST_IP:-localhost}

# Create certificates directory
mkdir -p ./certs

# Build the subjectAltName string
# Always include localhost DNS and 127.0.0.1 IP
SAN="DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

# If HOST_IP is set and is a valid IP address (not localhost), add it
if [ "$HOST_IP" != "localhost" ] && [[ "$HOST_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN="${SAN},IP:${HOST_IP}"
  echo "📍 Adding custom IP: ${HOST_IP}"
fi

# Generate self-signed certificate for local development
openssl req -x509 -newkey rsa:4096 -keyout ./certs/key.pem -out ./certs/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" -addext "subjectAltName=${SAN}"

echo "✅ SSL certificates generated in ./certs/"
echo "   - cert.pem (certificate)"
echo "   - key.pem (private key)"
echo "   - Subject Alt Names: ${SAN}"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "   Your browser will show a security warning - you need to accept it."
