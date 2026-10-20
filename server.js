// Contoso Order Entry: a fake 2009-era ASP.NET WebForms app for LegacyLink to automate.
// No runtime dependencies. Start with `npm start`, then open http://localhost:5080.

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/app.js';
import { drift } from './lib/drift.js';

const PORT = +(process.env.PORT || 5080);
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), 'public');

const tokens = new Map(); // .ASPXAUTH token -> user name
const sessions = {
  get: (t) => tokens.get(t),
  create(user) {
    const t = randomBytes(24).toString('hex').toUpperCase();
    tokens.set(t, user);
    return t;
  },
  remove: (t) => tokens.delete(t),
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });

async function serve(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;

  if (path.startsWith('/Styles/')) {
    const file = normalize(join(PUBLIC, path));
    try {
      if (!file.startsWith(PUBLIC)) throw new Error('outside public');
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      return res.end('Not found');
    }
  }

  const out = handle(
    { method: req.method, url: req.url, cookie: req.headers.cookie, contentType: req.headers['content-type'], body: req.method === 'POST' ? await readBody(req) : '' },
    sessions,
  );
  res.writeHead(out.status, out.headers);
  res.end(out.body);
}

createServer((req, res) =>
  serve(req, res).catch((err) => {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end("<h1>Server Error in '/' Application.</h1>");
  }),
).listen(PORT, () => console.log(`Contoso Order Entry listening on http://localhost:${PORT} (drift: ${JSON.stringify(drift())})`));
