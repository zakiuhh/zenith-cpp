/**
 * server.js — Zenith C++ Local Dev Server
 *
 * Serves the IDE with the required Cross-Origin Isolation headers
 * so SharedArrayBuffer and the Wasm-Clang binary work correctly.
 *
 * Required headers:
 *   Cross-Origin-Embedder-Policy: require-corp
 *   Cross-Origin-Opener-Policy: same-origin
 *
 * Usage:
 *   node server.js
 *   node server.js --port 8080
 *
 * Then open: http://localhost:3000
 *
 * Zero external dependencies — uses Node.js built-in modules only.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ── Config ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const PORT = portFlag !== -1 ? parseInt(args[portFlag + 1]) : 3000;
const ROOT = __dirname;

// ── MIME types ─────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

// ── Cross-Origin Isolation Headers (REQUIRED for SharedArrayBuffer / Wasm) ──
const COEP_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy':   'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

// ── Server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Default to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${pathname}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Cache-Control': ext === '.wasm' ? 'public, max-age=86400' : 'no-cache',
      ...COEP_HEADERS,
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const divider = '─'.repeat(52);
  console.log(`\n  ${divider}`);
  console.log(`  ⚡  Zenith C++ Dev Server`);
  console.log(`  ${divider}`);
  console.log(`  URL:  \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  Root: ${ROOT}`);
  console.log(`\n  Headers injected:`);
  console.log(`    \x1b[33mCross-Origin-Embedder-Policy\x1b[0m: require-corp`);
  console.log(`    \x1b[33mCross-Origin-Opener-Policy\x1b[0m:   same-origin`);
  console.log(`\n  Press \x1b[31mCtrl+C\x1b[0m to stop`);
  console.log(`  ${divider}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use. Try: node server.js --port 8080\n`);
  } else {
    console.error(`\n  Server error: ${err.message}\n`);
  }
  process.exit(1);
});
