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

For production:
1. Use proper SSL certificates from a Certificate Authority (Let's Encrypt, etc.)
2. Configure reverse proxy (nginx, Caddy) with SSL termination
3. Update the `server.js` to use production certificates from environment variables
4. Or remove custom server and let Next.js handle SSL via reverse proxy

## Files Modified

- `apps/web/server.js` - Added SSL certificate detection and HTTP fallback
- `docker/Dockerfile` - Added certificate generation in web-dev stage
- `package.json` - Added `generate:certs` script
- `README.md` - Added SSL certificate documentation

## Related Scripts

- `scripts/generate-ssl-cert.sh` - Certificate generation script
- `package.json` → `generate:certs` - npm/pnpm script alias
