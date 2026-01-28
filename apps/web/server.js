const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Always use dev mode for development workflow
const dev = true;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app with custom options for HTTPS
const app = next({ 
  dev, 
  hostname, 
  port,
  // Tell Next.js to use the custom server
  customServer: true,
});
const handle = app.getRequestHandler();

// Load SSL certificates
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../../certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../../certs/cert.pem')),
};

app.prepare().then(() => {
  const server = createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

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
      console.log(`> Ready on https://${hostname}:${port}`);
      console.log(`> Dev mode: ${dev}`);
    });
});
