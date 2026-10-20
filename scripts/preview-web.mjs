// Serves dist/ the way GitHub Pages does: under BASE_PATH, with 404.html for unknown paths.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = +(process.env.PORT || 5090);
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const ROOT = join(process.cwd(), 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.startsWith(BASE)) {
    let file = normalize(join(ROOT, path.slice(BASE.length)));
    if (file === ROOT || path.endsWith('/')) file = join(file, 'index.html');
    if (file.startsWith(ROOT)) {
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
        return res.end(body);
      } catch {}
    }
  }
  res.writeHead(404, { 'Content-Type': TYPES['.html'] });
  res.end(await readFile(join(ROOT, '404.html')));
}).listen(PORT, () => console.log(`Previewing dist/ at http://localhost:${PORT}${BASE}`));
