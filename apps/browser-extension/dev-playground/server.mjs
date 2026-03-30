import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, 'index.html');
const statusPath = '/tmp/eloq-playground-status.json';

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Missing URL');
    return;
  }

  if (req.method === 'POST' && req.url === '/__status') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        await fs.writeFile(statusPath, body);
        res.writeHead(204);
        res.end();
      } catch (error) {
        res.writeHead(500);
        res.end(String(error));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/__status') {
    try {
      const body = await fs.readFile(statusPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ extensionRoot: false, underlineCount: 0, popoverVisible: false }));
    }
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const body = await fs.readFile(indexPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
    return;
  }

  if (req.method === 'GET' && req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(4783, '127.0.0.1', () => {
  console.log('Eloq playground listening on http://127.0.0.1:4783');
});
