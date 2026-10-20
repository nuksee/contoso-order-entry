// Contoso Order Entry: a fake 2009-era ASP.NET WebForms app for LegacyLink to automate.
// No runtime dependencies. Start with `npm start`, then open http://localhost:5080.

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from './lib/data.js';
import { drift, setDrift } from './lib/drift.js';
import * as pages from './lib/pages.js';

const PORT = +(process.env.PORT || 5080);
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), 'public');
const sessions = new Map(); // .ASPXAUTH token -> user name

const ROUTES = {
  '/Login.aspx': pages.login,
  '/Default.aspx': pages.home,
  '/Customers/Search.aspx': pages.customerSearch,
  '/Customers/Details.aspx': pages.customerDetails,
  '/Orders/Status.aspx': pages.orderStatus,
  '/Orders/New.aspx': pages.newOrder,
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });

function cookie(req, name) {
  const m = new RegExp(`(?:^|;\\s*)${name.replace('.', '\\.')}=([^;]+)`).exec(req.headers.cookie || '');
  return m?.[1];
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'private', 'X-AspNet-Version': '2.0.50727', 'X-Powered-By': 'ASP.NET', ...headers });
  res.end(body);
}

const json = (res, obj) => send(res, 200, JSON.stringify(obj), { 'Content-Type': 'application/json' });

async function admin(req, res, url) {
  if (url.pathname === '/__admin/state') return json(res, { drift: drift(), orders: data.orders().length });
  if (req.method === 'POST' && url.pathname === '/__admin/drift') {
    const raw = await readBody(req);
    const body = req.headers['content-type']?.includes('json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
    const next = setDrift({ rename: !!body.rename, move: !!body.move });
    return req.headers['content-type']?.includes('json') ? json(res, { drift: next }) : send(res, 303, '', { Location: '/__admin' });
  }
  if (req.method === 'POST' && url.pathname === '/__admin/reset') {
    data.reset();
    setDrift({ rename: false, move: false });
    return req.headers['content-type']?.includes('json') ? json(res, { ok: true }) : send(res, 303, '', { Location: '/__admin' });
  }
  if (url.pathname === '/__admin') {
    const d = drift();
    const box = (k, text) => `<label><input type="checkbox" name="${k}" value="1"${d[k] ? ' checked' : ''}> ${text}</label><br>`;
    return send(
      res,
      200,
      `<!doctype html><title>Demo controls</title><body style="font:14px system-ui;max-width:520px;margin:2em auto">
      <h1>Demo controls</h1><p>Not part of the "legacy" app. Changes apply on the next page load.</p>
      <form method="post" action="/__admin/drift">
        ${box('rename', 'Rename controls (Customer # becomes Account No., Save Order becomes Submit Order, Order # becomes Sales Order No.)')}
        ${box('move', 'Move the New Order buttons to a toolbar above the form')}
        <p><button>Apply</button></p></form>
      <form method="post" action="/__admin/reset"><button>Reset data and drift</button></form>
      <p>Orders on file: ${data.orders().length}</p></body>`,
      { 'Content-Type': 'text/html; charset=utf-8' },
    );
  }
  return send(res, 404, 'Not found');
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path.startsWith('/__admin')) return admin(req, res, url);
  if (path === '/') return send(res, 302, '', { Location: '/Default.aspx' });

  if (path.startsWith('/Styles/')) {
    const file = normalize(join(PUBLIC, path));
    if (!file.startsWith(PUBLIC)) return send(res, 404, 'Not found');
    try {
      return send(res, 200, await readFile(file), { 'Content-Type': 'text/css' });
    } catch {
      return send(res, 404, 'Not found');
    }
  }

  const token = cookie(req, '.ASPXAUTH');
  if (path === '/Logout.aspx') {
    sessions.delete(token);
    return send(res, 302, '', { Location: '/Login.aspx', 'Set-Cookie': '.ASPXAUTH=; path=/; HttpOnly; Max-Age=0' });
  }

  const handler = Object.entries(ROUTES).find(([p]) => p.toLowerCase() === path.toLowerCase())?.[1];
  if (!handler) {
    return send(res, 404, '<h1>Server Error in \'/\' Application.</h1><h2><i>The resource cannot be found.</i></h2>', { 'Content-Type': 'text/html' });
  }

  const user = sessions.get(token);
  if (!user && handler !== pages.login) {
    return send(res, 302, '', { Location: `/Login.aspx?ReturnUrl=${encodeURIComponent(path + url.search)}` });
  }

  const body = new URLSearchParams(req.method === 'POST' ? await readBody(req) : '');
  const out = handler({ method: req.method, path, url: path + url.search, query: url.searchParams, body, user });

  const headers = {};
  if (out.login) {
    const t = randomBytes(24).toString('hex').toUpperCase();
    sessions.set(t, out.login);
    headers['Set-Cookie'] = `.ASPXAUTH=${t}; path=/; HttpOnly`;
  }
  if (out.redirect) return send(res, 302, '', { ...headers, Location: out.redirect });
  send(res, 200, out.html, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
}

createServer((req, res) =>
  handle(req, res).catch((err) => {
    console.error(err);
    send(res, 500, '<h1>Server Error in \'/\' Application.</h1>', { 'Content-Type': 'text/html' });
  }),
).listen(PORT, () => console.log(`Contoso Order Entry listening on http://localhost:${PORT} (drift: ${JSON.stringify(drift())})`));
