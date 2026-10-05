// Same origin for the browser, like nginx in production:
// http://localhost:8080/api and /socket.io -> API, everything else -> web app.
import http from 'node:http';
import net from 'node:net';

const API = Number(process.env.API_PORT ?? 4100);
const WEB = Number(process.env.WEB_PORT ?? 3000);
const PORT = Number(process.env.E2E_PORT ?? 8080);
const target = (url = '') => (url.startsWith('/api') || url.startsWith('/socket.io') ? API : WEB);

const server = http.createServer((req, res) => {
  const upstream = http.request(
    { host: '127.0.0.1', port: target(req.url), path: req.url, method: req.method, headers: req.headers },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end('upstream down');
  });
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => socket.destroy());
  const upstream = net.connect(target(req.url), '127.0.0.1', () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`);
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(PORT, () => console.log(`e2e proxy on http://localhost:${PORT} (api :${API}, web :${WEB})`));
