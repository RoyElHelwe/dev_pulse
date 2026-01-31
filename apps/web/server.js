const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Always use dev mode for development workflow
const dev = true;
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

// Check if SSL certificates exist
const certPath = path.join(__dirname, '../../certs/cert.pem');
const keyPath = path.join(__dirname, '../../certs/key.pem');
const hasSSL = fs.existsSync(certPath) && fs.existsSync(keyPath);

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
    // Use HTTPS if certificates are available
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    server = createHttpsServer(httpsOptions, requestHandler);
    protocol = 'https';
  } else {
    // Fallback to HTTP if no certificates
    console.warn('⚠️  SSL certificates not found, using HTTP');
    console.warn('   Run: pnpm run generate:certs to create SSL certificates');
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
        console.log('> Using HTTP (SSL disabled - certificates not found)');
      }
    });
});
