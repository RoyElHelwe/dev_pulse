#!/bin/bash

# Script to change network IP configuration
# Usage: ./scripts/change-network-ip.sh <NEW_IP>

NEW_IP=$1

if [ -z "$NEW_IP" ]; then
  echo "❌ Error: IP address required"
  echo "Usage: ./scripts/change-network-ip.sh <IP_ADDRESS>"
  echo "Example: ./scripts/change-network-ip.sh 192.168.1.100"
  exit 1
fi

echo "🔄 Updating network IP configuration to: $NEW_IP"
echo ""

# Update HOST_IP in .env file
if [ -f .env ]; then
  if grep -q "^HOST_IP=" .env; then
    # Update existing HOST_IP
    sed -i "s/^HOST_IP=.*/HOST_IP=$NEW_IP/" .env
    echo "✅ Updated HOST_IP in .env"
  else
    echo "❌ HOST_IP not found in .env"
    exit 1
  fi
else
  echo "❌ .env file not found"
  exit 1
fi

echo ""
echo "🔐 Regenerating SSL certificates for new IP..."
./scripts/generate-ssl-cert.sh

echo ""
echo "🐳 Restarting Docker services..."
docker compose down
docker compose up -d

echo ""
echo "✅ Configuration updated successfully!"
echo ""
echo "📡 Access your application at:"
echo "   Web: https://$NEW_IP:3000"
echo "   API: https://$NEW_IP:4000"
echo ""
echo "⚠️  Remember to accept the new SSL certificate in your browser."
