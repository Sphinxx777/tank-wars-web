#!/usr/bin/env node
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream',
};

/** Small development server: only the selected static directory is exposed. */
export function createStaticServer(root = DEFAULT_ROOT) {
  const absoluteRoot = resolve(root);
  return http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = resolve(absoluteRoot, `.${pathname}`);
      if (pathname.endsWith('/')) filename = resolve(filename, 'index.html');
      const actualPath = await realpath(filename);
      const actualRoot = await realpath(absoluteRoot);
      if (!actualPath.startsWith(actualRoot + sep)) throw new Error('Outside static directory');
      const information = await stat(actualPath);
      if (!information.isFile()) throw new Error('Not a regular file');
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(actualPath)] || 'application/octet-stream',
        'Content-Length': information.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') response.end();
      else
        createReadStream(actualPath)
          .on('error', () => response.destroy())
          .pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8786);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const server = createStaticServer();
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${port} is busy. Try PORT=8788 npm start.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(`Tank Wars: http://127.0.0.1:${server.address().port}/`),
  );
}
