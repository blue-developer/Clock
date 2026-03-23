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

// App version — semver from version.txt + git commit hash, read live on every request.
// No service restart needed after git pull.
const { execSync } = require('child_process');
function readVersion() {
  try {
    const semver = fs.readFileSync(path.join(DIR, 'version.txt'), 'utf8').trim();
    const hash   = execSync('git rev-parse --short HEAD', { cwd: DIR, timeout: 2000 }).toString().trim();
    return `${semver}-${hash}`;
  } catch (_) {
    try { return fs.readFileSync(path.join(DIR, 'version.txt'), 'utf8').trim(); } catch (_) { return 'unknown'; }
  }
}

// In-memory flags
let clearPending = false;
let hardRefreshPending = false;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ------------------------------------------------------------------
  // GET /version  — returns current git commit hash; browser polls to
  //                 detect deploys and auto-reload the page
  // ------------------------------------------------------------------
  if (url.pathname === '/version' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ version: readVersion() }));
    return;
  }

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
  // POST /git-pull  — run update.sh to force-sync from GitHub
  // ------------------------------------------------------------------
  if (url.pathname === '/git-pull' && req.method === 'POST') {
    const scriptPath = path.join(DIR, 'update.sh');
    const child = spawn('bash', [scriptPath], { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });
    child.on('close', code => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: code === 0, output: output.trim() }));
    });
    child.on('error', err => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, output: err.message }));
    });
    return;
  }

  // ------------------------------------------------------------------
  // POST /hard-refresh  — signal the clock page to do a full reload
  // GET  /hard-refresh-pending  — clock polls this; resets flag on read
  // ------------------------------------------------------------------
  if (url.pathname === '/hard-refresh' && req.method === 'POST') {
    hardRefreshPending = true;
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('ok');
    return;
  }

  if (url.pathname === '/hard-refresh-pending' && req.method === 'GET') {
    const pending = hardRefreshPending;
    hardRefreshPending = false;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ refresh: pending }));
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

});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing clock server or pick a different port.`);
    process.exit(1);
  }

  if (err.code === 'EPERM') {
    console.error(`Permission denied while trying to listen on port ${PORT}.`);
    process.exit(1);
  }

  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Senior Clock  →  http://localhost:${PORT}`);
  console.log(`Settings      →  http://localhost:${PORT}/settings.html`);
  console.log(`Dev mode      →  http://localhost:${PORT}?dev=1`);
});
