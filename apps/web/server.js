const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Prefer running TLS termination in a reverse proxy in production.
// This server supports:
// - Dev: self-signed certs in ./certs (HTTPS) with HTTP fallback
// - Prod: optional custom certs via env, or plain HTTP behind a reverse proxy
const isProd = process.env.NODE_ENV === 'production';

// In production we should run Next.js in production mode.
// In development, keep dev mode behavior.
const dev = !isProd;

const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app with custom options
const app = next({
  dev,
  hostname,
  port,
  // Tell Next.js to use the custom server
  customServer: true,
});
const handle = app.getRequestHandler();

// --- SSL / TLS configuration -------------------------------------------------
// Dev default certs location (self-signed)
const devCertPath = path.join(__dirname, '../../certs/cert.pem');
const devKeyPath = path.join(__dirname, '../../certs/key.pem');

// Production certs can be injected via environment variables.
// Prefer file paths (official Docker secrets / mounted files), but allow inline PEM too.
const envCertPath = process.env.SSL_CERT_PATH;
const envKeyPath = process.env.SSL_KEY_PATH;
const envCertPem = process.env.SSL_CERT;
const envKeyPem = process.env.SSL_KEY;

// When running behind a reverse proxy (nginx/Caddy/Cloud Run) you typically want HTTP here.
// Set `DISABLE_TLS=true` to force HTTP even if certs are present.
const disableTls = String(process.env.DISABLE_TLS || '').toLowerCase() === 'true';

function canReadFile(p) {
  return !!p && fs.existsSync(p);
}

function readMaybeFileOrPem(filePath, pem) {
  if (pem && pem.trim().length > 0) return pem;
  if (filePath && canReadFile(filePath)) return fs.readFileSync(filePath);
  return null;
}

const cert =
  readMaybeFileOrPem(envCertPath, envCertPem) ||
  (!isProd && canReadFile(devCertPath) ? fs.readFileSync(devCertPath) : null);

const key =
  readMaybeFileOrPem(envKeyPath, envKeyPem) ||
  (!isProd && canReadFile(devKeyPath) ? fs.readFileSync(devKeyPath) : null);

const hasSSL = !disableTls && !!cert && !!key;
// -----------------------------------------------------------------------------

let server;
let protocol = 'http';

// Common request handler for both HTTP and HTTPS
const requestHandler = async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error occurred handling', req.url, err);
    res.statusCode = 500;
    res.end('internal server error');
  }
};

app.prepare().then(() => {
  if (hasSSL) {
    // Use HTTPS if certificates are available and TLS isn't disabled
    const httpsOptions = { key, cert };
    server = createHttpsServer(httpsOptions, requestHandler);
    protocol = 'https';
  } else {
    // Fallback to HTTP (recommended in production behind a reverse proxy)
    if (!isProd) {
      console.warn('⚠️  SSL certificates not found, using HTTP');
      console.warn('   Run: pnpm run generate:certs to create SSL certificates');
    } else if (disableTls) {
      console.log('ℹ️  TLS disabled (DISABLE_TLS=true). Expect SSL termination in a reverse proxy.');
    } else {
      console.log('ℹ️  No TLS configured. Expect SSL termination in a reverse proxy.');
    }
    server = createHttpServer(requestHandler);
  }

  // Handle WebSocket upgrade for HMR - let Next.js handle it
  server.on('upgrade', (req, socket, head) => {
    // Get the upgrade handler from Next.js
    const upgradeHandler = app.getUpgradeHandler();
    if (upgradeHandler) {
      upgradeHandler(req, socket, head);
    }
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(
        `> Ready on ${protocol}://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`
      );
      console.log(`> Dev mode: ${dev}`);
      if (hasSSL) {
        console.log('> Using HTTPS (SSL enabled)');
      } else {
        console.log('> Using HTTP (SSL handled by reverse proxy or certificates not configured)');
      }
    });
});
