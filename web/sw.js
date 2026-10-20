// Browser build: this service worker runs the same request handling as
// server.js (lib/app.js), so the app works on a static host like GitHub Pages.
// State (orders, drift switches, login) is kept in IndexedDB because the
// browser stops idle service workers and in-memory state would be lost.

import { handle, isAppPath } from '../lib/app.js';
import * as data from '../lib/data.js';
import { drift, setDrift } from '../lib/drift.js';

const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, ''); // '' or '/contoso-order-entry'

// One browser, one user: no cookies needed (a service worker can't read or set them anyway).
let user = null;
const sessions = {
  get: () => user,
  create: (u) => ((user = u), 'BROWSER'),
  remove: () => (user = null),
};

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('contoso-order-entry', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function load() {
  const db = await openDb();
  const saved = await new Promise((resolve) => {
    const req = db.transaction('kv').objectStore('kv').get('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
  if (saved) {
    data.restore(saved.data);
    setDrift(saved.drift);
    user = saved.user;
  }
}

async function save() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ data: data.snapshot(), drift: drift(), user }, 'state');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const ready = load().catch((err) => console.error('Could not load saved state', err));

// The app writes root-relative URLs; on Pages it lives under /<repo>/.
const withBase = (html) => html.replace(/\b(href|action|src)="\//g, `$1="${BASE}/`);

async function serve(request, url) {
  await ready;
  const out = handle(
    {
      method: request.method,
      url,
      cookie: '',
      contentType: request.headers.get('content-type') || '',
      body: request.method === 'POST' ? await request.text() : '',
    },
    sessions,
  );
  if (request.method === 'POST' || url.toLowerCase().startsWith('/logout.aspx')) await save();

  const headers = new Headers(out.headers);
  headers.delete('Set-Cookie');
  const location = headers.get('Location');
  if (location) {
    headers.set('Location', new URL(location.startsWith('/') ? BASE + location : location, self.location.origin).href);
    return new Response(null, { status: out.status, headers });
  }
  const isHtml = (headers.get('Content-Type') || '').includes('text/html');
  return new Response(isHtml ? withBase(out.body) : out.body, { status: out.status, headers });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(BASE + '/')) return;
  const path = url.pathname.slice(BASE.length) || '/';
  if (!isAppPath(path)) return; // static files (Styles, index.html, sw.js) come from the host
  event.respondWith(
    serve(event.request, path + url.search).catch((err) => {
      console.error(err);
      return new Response("<h1>Server Error in '/' Application.</h1>", { status: 500, headers: { 'Content-Type': 'text/html' } });
    }),
  );
});
