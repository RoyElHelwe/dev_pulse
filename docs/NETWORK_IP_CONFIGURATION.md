# Network IP Configuration Guide

This guide explains how to configure your application to work on different network IP addresses.

## Quick Start

### Option 1: Use the Helper Script (Easiest)

```bash
# Change to a new IP address
./scripts/change-network-ip.sh 192.168.1.100
```

This script will:
1. Update `HOST_IP` in `.env`
2. Regenerate SSL certificates for the new IP
3. Restart Docker services
4. Show you the new access URLs

### Option 2: Manual Configuration

1. **Edit the `.env` file** and change the `HOST_IP` variable:

```bash
# In .env file
HOST_IP=192.168.1.100  # Change this to your desired IP
```

2. **Regenerate SSL certificates** (required for HTTPS):

```bash
./scripts/generate-ssl-cert.sh
```

3. **Restart Docker services**:

```bash
docker compose down
docker compose up -d
```

## What Gets Configured

When you change `HOST_IP`, the following URLs are automatically updated:

- **Frontend**: `https://${HOST_IP}:3000`
- **API Gateway**: `https://${HOST_IP}:4000`
- **WebSocket**: `wss://${HOST_IP}:4000`
- **CORS Origins**: All cross-origin requests from the new IP
- **Cookie Domain**: Cookies will work with the new IP

## Finding Your Network IP

### On Linux:
```bash
hostname -I | awk '{print $1}'
# or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### On macOS:
```bash
ipconfig getifaddr en0
```

### On Windows:
```cmd
ipconfig
```

## Using Localhost Only

If you only want to access the app from your local machine:

```bash
# In .env file
HOST_IP=localhost
```

Then regenerate certificates and restart services.

## Important Notes

- ✅ All hardcoded IPs have been removed from the codebase
- ✅ Only the `.env` file needs to be updated to change IPs
- ✅ SSL certificates must be regenerated when changing IPs
- ✅ All devices on your network can access the app when using a network IP
- ⚠️ You'll need to accept the self-signed SSL certificate warning in your browser

## Environment Variables Used

The following variables are automatically set based on `HOST_IP`:

- `COOKIE_DOMAIN` - Domain for session cookies
- `FRONTEND_URL` - Frontend URL for backend services
- `APP_URL` - Application URL for workspace service
- `NEXT_PUBLIC_API_URL` - API endpoint for frontend
- `NEXT_PUBLIC_WS_URL` - WebSocket endpoint for frontend
- `CORS_ORIGINS` - Allowed origins for CORS
- `CORS_ORIGINS_DOCKER` - Allowed origins for Docker services

## Troubleshooting

### Issue: "Invalid SSL Certificate" in browser
**Solution**: Click "Advanced" → "Accept Risk and Continue" (or similar) in your browser.

### Issue: Can't access from other devices on network
**Solution**: 
1. Make sure `HOST_IP` is set to your network IP (not localhost)
2. Check firewall settings allow ports 3000 and 4000
3. Verify devices are on the same network

### Issue: Login not working after IP change
**Solution**: 
1. Clear browser cookies
2. Make sure you regenerated SSL certificates
3. Restart Docker services
4. Clear browser cache and reload

## Example Workflow

```bash
# 1. Find your network IP
hostname -I | awk '{print $1}'
# Output: 192.168.1.100

# 2. Change to the new IP (this does everything automatically)
./scripts/change-network-ip.sh 192.168.1.100

# 3. Access your app
# Open browser: https://192.168.1.100:3000

# 4. If needed, manually verify .env
cat .env | grep HOST_IP
# Should show: HOST_IP=192.168.1.100
```
