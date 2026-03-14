// Minimal ICS proxy — Node.js built-ins only, no npm required.
// Serves static files from the current directory AND proxies ICS fetches.
//
// Usage:  node proxy.js
// Clock:  http://localhost:3000
// Settings: http://localhost:3000/settings.html

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const DIR  = __dirname;

// In-memory clear flag — set by POST /clear, consumed by GET /clear-pending
let clearPending = false;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ------------------------------------------------------------------
  // POST /clear  — iPhone Shortcut calls this to dismiss the reminder
  // ------------------------------------------------------------------
  if (url.pathname === '/clear' && req.method === 'POST') {
    clearPending = true;
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('ok');
    return;
  }

  // ------------------------------------------------------------------
  // GET /clear-pending  — clock page polls this; resets flag on read
  // ------------------------------------------------------------------
  if (url.pathname === '/clear-pending' && req.method === 'GET') {
    const pending = clearPending;
    clearPending = false;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ clear: pending }));
    return;
  }

  // ------------------------------------------------------------------
  // POST /open-browser  — kill kiosk Firefox, relaunch without --kiosk
  // ------------------------------------------------------------------
  if (url.pathname === '/open-browser' && req.method === 'POST') {
    const env = { ...process.env, DISPLAY: ':0' };
    spawn('pkill', ['-9', 'firefox'], { stdio: 'ignore' }).on('close', () => {
      setTimeout(() => {
        spawn('firefox', ['--no-remote', '--new-instance', 'about:newtab'], { detached: true, stdio: 'ignore', env }).unref();
      }, 3000);
    });
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // ------------------------------------------------------------------
  // POST /kiosk  — kill Firefox, relaunch in kiosk mode
  // ------------------------------------------------------------------
  if (url.pathname === '/kiosk' && req.method === 'POST') {
    const env = { ...process.env, DISPLAY: ':0' };
    spawn('pkill', ['-9', 'firefox'], { stdio: 'ignore' }).on('close', () => {
      setTimeout(() => {
        spawn('firefox', ['--kiosk', 'http://localhost:3000'], { detached: true, stdio: 'ignore', env }).unref();
      }, 3000);
    });
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // ------------------------------------------------------------------
  // OPTIONS preflight (for Tailscale cross-origin requests)
  // ------------------------------------------------------------------
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
    res.end();
    return;
  }

  // ------------------------------------------------------------------
  // GET /proxy?url=https://…   — fetch remote ICS and return it
  // ------------------------------------------------------------------
  if (url.pathname === '/proxy' && req.method === 'GET') {
    let target = url.searchParams.get('url') || '';
    target = target.replace(/^webcal:\/\//i, 'https://');

    if (!target.startsWith('https://') && !target.startsWith('http://')) {
      res.writeHead(400); res.end('Bad url'); return;
    }

    function fetchWithRedirects(url, redirectsLeft) {
      if (redirectsLeft < 0) { res.writeHead(502); res.end('Too many redirects'); return; }
      const mod = url.startsWith('https://') ? https : http;
      const fwd = mod.get(url, { headers: { 'User-Agent': 'SeniorClock/1.0' } }, (r) => {
        if ((r.statusCode === 301 || r.statusCode === 302 || r.statusCode === 307 || r.statusCode === 308) && r.headers.location) {
          r.resume(); // drain response
          const next = new URL(r.headers.location, url).href;
          fetchWithRedirects(next, redirectsLeft - 1);
          return;
        }
        res.writeHead(r.statusCode, {
          'Content-Type':                r.headers['content-type'] || 'text/calendar',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':               'no-store',
        });
        r.pipe(res);
      });
      fwd.on('error', (e) => { res.writeHead(502); res.end(e.message); });
    }
    fetchWithRedirects(target, 5);
    return;
  }

  // ------------------------------------------------------------------
  // Static file serving
  // ------------------------------------------------------------------
  let filePath = path.join(DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

}).listen(PORT, '0.0.0.0', () => {
  console.log(`Senior Clock  →  http://localhost:${PORT}`);
  console.log(`Settings      →  http://localhost:${PORT}/settings.html`);
  console.log(`Dev mode      →  http://localhost:${PORT}?dev=1`);
});
