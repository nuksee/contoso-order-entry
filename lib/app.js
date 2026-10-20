// Request handling shared by the Node server (server.js) and the browser build
// (web/sw.js). Takes a plain request object and returns a plain response, so
// neither node:http nor the Fetch API leaks in here.
//
//   req:      { method, url: '/path?query', cookie, contentType, body: string }
//   sessions: { get(token), create(user) -> token, remove(token) }
//   returns:  { status, headers, body }

import * as data from './data.js';
import { drift, setDrift } from './drift.js';
import * as pages from './pages.js';

const ROUTES = {
  '/Login.aspx': pages.login,
  '/Default.aspx': pages.home,
  '/Customers/Search.aspx': pages.customerSearch,
  '/Customers/Details.aspx': pages.customerDetails,
  '/Orders/Status.aspx': pages.orderStatus,
  '/Orders/New.aspx': pages.newOrder,
};

const BASE_HEADERS = { 'Cache-Control': 'private', 'X-AspNet-Version': '2.0.50727', 'X-Powered-By': 'ASP.NET' };
const respond = (status, body, headers = {}) => ({ status, body, headers: { ...BASE_HEADERS, ...headers } });
const html = (body, headers) => respond(200, body, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
const json = (obj) => respond(200, JSON.stringify(obj), { 'Content-Type': 'application/json' });
const redirect = (location, headers, status = 302) => respond(status, '', { ...headers, Location: location });

export const isAppPath = (path) => path === '/' || path.startsWith('/__admin') || path.toLowerCase() === '/logout.aspx' || !!route(path);

const route = (path) => Object.entries(ROUTES).find(([p]) => p.toLowerCase() === path.toLowerCase())?.[1];

const cookieValue = (header, name) => new RegExp(`(?:^|;\\s*)${name.replace('.', '\\.')}=([^;]+)`).exec(header || '')?.[1];

function admin(req, path) {
  const isJson = req.contentType?.includes('json');
  if (path === '/__admin/state') return json({ drift: drift(), orders: data.orders().length });
  if (req.method === 'POST' && path === '/__admin/drift') {
    const body = isJson ? JSON.parse(req.body || '{}') : Object.fromEntries(new URLSearchParams(req.body));
    const next = setDrift({ rename: !!body.rename, move: !!body.move });
    return isJson ? json({ drift: next }) : redirect('/__admin', {}, 303);
  }
  if (req.method === 'POST' && path === '/__admin/reset') {
    data.reset();
    setDrift({ rename: false, move: false });
    return isJson ? json({ ok: true }) : redirect('/__admin', {}, 303);
  }
  if (path === '/__admin') {
    const d = drift();
    const box = (k, text) => `<label><input type="checkbox" name="${k}" value="1"${d[k] ? ' checked' : ''}> ${text}</label><br>`;
    return html(`<!doctype html><title>Demo controls</title><body style="font:14px system-ui;max-width:520px;margin:2em auto">
      <h1>Demo controls</h1><p>Not part of the "legacy" app. Changes apply on the next page load.</p>
      <p id="current">Now: rename ${d.rename ? 'on' : 'off'}, move ${d.move ? 'on' : 'off'}</p>
      <form method="post" action="/__admin/drift">
        ${box('rename', 'Rename controls (Customer # becomes Account No., Save Order becomes Submit Order, Order # becomes Sales Order No.)')}
        ${box('move', 'Move the New Order buttons to a toolbar above the form')}
        <p><button>Apply</button></p></form>
      <form method="post" action="/__admin/reset"><button>Reset data and drift</button></form>
      <p>Orders on file: ${data.orders().length}</p>
      <p><a href="/Default.aspx">Open the app</a></p></body>`);
  }
  return respond(404, 'Not found');
}

export function handle(req, sessions) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path.startsWith('/__admin')) return admin(req, path);
  if (path === '/') return redirect('/Default.aspx');

  const token = cookieValue(req.cookie, '.ASPXAUTH');
  if (path.toLowerCase() === '/logout.aspx') {
    sessions.remove(token);
    return redirect('/Login.aspx', { 'Set-Cookie': '.ASPXAUTH=; path=/; HttpOnly; Max-Age=0' });
  }

  const handler = route(path);
  if (!handler) {
    return respond(404, "<h1>Server Error in '/' Application.</h1><h2><i>The resource cannot be found.</i></h2>", { 'Content-Type': 'text/html' });
  }

  const user = sessions.get(token);
  if (!user && handler !== pages.login) return redirect(`/Login.aspx?ReturnUrl=${encodeURIComponent(path + url.search)}`);

  const body = new URLSearchParams(req.method === 'POST' ? req.body : '');
  const out = handler({ method: req.method, path, url: path + url.search, query: url.searchParams, body, user });

  const headers = out.login ? { 'Set-Cookie': `.ASPXAUTH=${sessions.create(out.login)}; path=/; HttpOnly` } : {};
  return out.redirect ? redirect(out.redirect, headers) : html(out.html, headers);
}
