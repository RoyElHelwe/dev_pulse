# SSL Certificate Setup for Development

## Overview

The web service supports both HTTPS (with SSL certificates) and HTTP (fallback when certificates are missing). This ensures the application works on any machine without manual certificate setup.

## How It Works

### Automatic Fallback
The `apps/web/server.js` checks for SSL certificates at startup:
- **If certificates exist**: Uses HTTPS on `https://localhost:3000`
- **If certificates missing**: Falls back to HTTP on `http://localhost:3000`

### Certificate Location
Certificates are stored in the `certs/` directory at the project root:
```
certs/
  ├── cert.pem    # SSL certificate
  └── key.pem     # Private key
```

## Setup Methods

### Method 1: Docker Auto-Generation (Recommended)
When you run `docker-compose up`, the web container automatically generates SSL certificates if they don't exist.

```bash
docker-compose up -d --build
```

### Method 2: Manual Generation (Local Development)
Generate certificates before starting Docker:

```bash
# Using npm/pnpm script
pnpm run generate:certs

# Or directly with the script
bash scripts/generate-ssl-cert.sh
```

### Method 3: Using OpenSSL Directly
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"
```

## Browser Security Warning

Since these are self-signed certificates, browsers will show a security warning. This is normal for local development.

**How to proceed:**
1. Chrome/Edge: Click "Advanced" → "Proceed to localhost (unsafe)"
2. Firefox: Click "Advanced" → "Accept the Risk and Continue"
3. Safari: Click "Show Details" → "visit this website"

## Deployment to Another Machine

The certificates are in `.gitignore`, so they won't be committed to Git. When you deploy to another machine:

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd dev_pulse
   ```

2. **Start Docker Compose**
   ```bash
   docker-compose up -d --build
   ```
   
   The web container will automatically:
   - Detect missing certificates
   - Generate new self-signed certificates
   - Start the server with HTTPS

3. **Access the application**
   - Visit https://localhost:3000
   - Accept the browser security warning
   - Application is ready to use!

## Alternative: Use HTTP Only

If you don't want to deal with SSL certificates and browser warnings during development:

1. **Remove existing certificates**
   ```bash
   rm -rf certs/*.pem
   ```

2. **Restart the web container**
   ```bash
   docker-compose restart web
   ```

3. **Access via HTTP**
   - Visit http://localhost:3000 (no security warning)

## Troubleshooting

### Web container keeps restarting
**Symptom**: `docker-compose ps` shows web container constantly restarting

**Solution**: Check if certificates are corrupted
```bash
# Remove certificates
rm -rf certs/*.pem

# Regenerate
pnpm run generate:certs

# Restart container
docker-compose restart web
```

### "Certificate has expired" warning
**Symptom**: Browser shows certificate expired warning

**Solution**: Regenerate certificates (default validity is 365 days)
```bash
rm -rf certs/*.pem
pnpm run generate:certs
docker-compose restart web
```

### Mixed content warnings
**Symptom**: Some resources fail to load due to HTTPS/HTTP mixed content

**Solution**: Ensure all API calls use relative URLs or match the frontend protocol

## Production Deployment

⚠️ **Important**: Self-signed certificates are for **development only**.

### Option A (Recommended): Reverse proxy with SSL termination (Let's Encrypt)

In production you should terminate TLS in a reverse proxy (nginx, Caddy, Cloudflare, Cloud Run, etc.) and keep the Next.js container serving **plain HTTP**.

This repo includes an nginx production service in `docker-compose.prod.yml`:
- `nginx` listens on **80/443**
- TLS certs are read from `/etc/letsencrypt/live/dev-pulse/*` inside the container
- Requests are proxied to `web:3000`
- The `web` service is forced to HTTP via `DISABLE_TLS=true`

**What you must do:**
1. Obtain valid certificates from a CA (e.g. Let's Encrypt) on the host
2. Ensure your host cert path matches the volume mount in `docker-compose.prod.yml`:
   - `/etc/letsencrypt:/etc/letsencrypt:ro`
3. Ensure the domain folder name matches nginx config in `docker/nginx/conf.d/dev_pulse.conf`:
   - `/etc/letsencrypt/live/dev-pulse/fullchain.pem`
   - `/etc/letsencrypt/live/dev-pulse/privkey.pem`

> Note: If you use a different domain name, update `docker/nginx/conf.d/dev_pulse.conf`.

### Option B: Provide production certs directly to `apps/web/server.js`

If you **do not** use a reverse proxy, you can run HTTPS directly in the Node custom server by passing certs via env vars:

- `SSL_CERT_PATH` and `SSL_KEY_PATH` (recommended)
  - Paths inside the container to a mounted certificate + key
- Or `SSL_CERT` and `SSL_KEY`
  - Inline PEM values (not recommended for large secrets)

If you want to force HTTP (reverse proxy termination), set:
- `DISABLE_TLS=true`

### Option C: Remove custom server

If you deploy Next.js behind a reverse proxy, you can also remove `apps/web/server.js` and run `next start` (or the standalone server) directly.
This is a larger change and depends on whether you need custom behaviors from the current server.

## Files Modified

- `apps/web/server.js` - Added production TLS support via env and reverse-proxy-friendly `DISABLE_TLS`
- `docker-compose.prod.yml` - Added `nginx` reverse proxy service (SSL termination)
- `docker/nginx/*` - Nginx reverse proxy configuration for production
- `docker/Dockerfile` - Added certificate generation in web-dev stage
- `package.json` - Added `generate:certs` script
- `README.md` - Added SSL certificate documentation

## Related Scripts

- `scripts/generate-ssl-cert.sh` - Certificate generation script
- `package.json` → `generate:certs` - npm/pnpm script alias
