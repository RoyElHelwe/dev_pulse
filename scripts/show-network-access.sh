#!/bin/bash

# Get the local network IP address
echo "======================================"
echo "   Network Access Information"
echo "======================================"
echo ""

# Try to get the local IP address (works on Linux)
IP=$(hostname -I | awk '{print $1}')

if [ -z "$IP" ]; then
    # Fallback method
    IP=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+')
fi

if [ -z "$IP" ]; then
    echo "⚠️  Could not detect network IP address automatically"
    echo "You can find it manually with: ip addr show"
    echo ""
else
    echo "📱 Your local network IP: $IP"
    echo ""
    echo "🌐 Access URLs from any device on your network:"
    echo "   Web App:        https://$IP:3000"
    echo "   API Gateway:    https://$IP:4000"
    echo "   API Docs:       https://$IP:4000/api/docs"
    echo "   Auth Service:   https://$IP:3001"
    echo "   Workspace Svc:  https://$IP:3002"
    echo "   Task Service:   http://$IP:3003"
    echo ""
fi

echo "💡 Tips:"
echo "   - Make sure your firewall allows connections on these ports"
echo "   - Both devices must be on the same local network (WiFi/LAN)"
echo "   - On mobile devices, simply open the browser and enter the URL"
echo "   - ⚠️  You'll see a security warning (self-signed certificate)"
echo "   - Click 'Advanced' and 'Accept the Risk' to proceed"
echo ""
echo "======================================"
