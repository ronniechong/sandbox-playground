import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

export interface Route {
  path: string;
  contentType: string;
  body: () => string;
}

/**
 * Deliberately not Vite's own dev server: everything this serves (the
 * shell's build, every app's build, vendor/common) is already-built
 * plain JS/CSS loaded via <script>/<link>, not ES modules Vite needs to
 * transform. Plain static serving avoids Vite's dev-server transform
 * pipeline reinterpreting an IIFE bundle as a module graph it isn't.
 */
export function startStaticServer(
  root: string,
  routes: Route[],
  port: number,
): ReturnType<typeof createServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = routes.find((r) => r.path === url.pathname);
    if (route) {
      res.writeHead(200, { 'content-type': route.contentType, 'cache-control': 'no-cache' });
      res.end(route.body());
      return;
    }

    const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, safePath);
    if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const contentType = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-cache' });
    createReadStream(filePath).pipe(res);
  });
  server.listen(port);
  return server;
}
