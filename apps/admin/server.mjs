import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.ADMIN_PORT || 3100);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const clean = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(root, clean);

  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mime[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`ATHR Admin: http://127.0.0.1:${port}`);
});
