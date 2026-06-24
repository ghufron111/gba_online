/**
 * GBA Vault — Local HTTP Server
 * Jalankan: node server.js
 * Akses   : http://localhost:3000
 *
 * Tidak butuh npm install — hanya pakai modul bawaan Node.js
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Config ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';          // listen semua interface (bisa diakses dari LAN)
const ROOT = __dirname;          // folder tempat server.js berada

// ── MIME Types ───────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.gba': 'application/octet-stream',
  '.gbc': 'application/octet-stream',
  '.gb': 'application/octet-stream',
  '.iso': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.cue': 'application/octet-stream',
  '.chd': 'application/octet-stream',
  '.img': 'application/octet-stream',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// ── Helper: get local IPs ────────────────────────────────────────
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const list of Object.values(nets)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// ── Server ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Parse URL — strip query string & decode
  let urlPath = req.url.split('?')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch { /* keep raw */ }

  // Default route → index.html
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Resolve file path (prevent directory traversal)
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Try serving the file
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // If directory requested, try index.html inside it
      const fallback = path.join(filePath, 'index.html');
      fs.stat(fallback, (err2, stat2) => {
        if (!err2 && stat2.isFile()) {
          serveFile(fallback, req, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html lang="id">
            <head><meta charset="UTF-8"><title>404 — GBA Vault</title>
            <style>
              body{font-family:system-ui,sans-serif;background:#07070f;color:#f1f0ff;
                   display:flex;flex-direction:column;align-items:center;justify-content:center;
                   min-height:100vh;gap:1rem;text-align:center}
              h1{font-size:4rem;margin:0;color:#7c3aed}
              p{color:#8b8aaa}
              a{color:#a855f7;text-decoration:none}
              a:hover{text-decoration:underline}
            </style></head>
            <body>
              <h1>404</h1>
              <p>File tidak ditemukan: <code>${urlPath}</code></p>
              <a href="/">← Kembali ke Library</a>
            </body></html>
          `);
        }
      });
      return;
    }

    serveFile(filePath, req, res);
  });
});

function serveFile(filePath, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(500); res.end('Server error'); return;
    }

    // ── CORS & security headers ──
    const headers = {
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'X-Content-Type-Options': 'nosniff',
    };

    // ── Range request support (for large ROM files) ──
    const range = req.headers['range'];
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        ...headers,
        'Content-Length': chunkSize,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(filePath).pipe(res);
    }

    // Log
    const time = new Date().toTimeString().slice(0, 8);
    console.log(`  [${time}] ${req.method} ${req.url} → ${path.basename(filePath)}`);
  });
}

// ── Start ────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const ips = getLocalIPs();

  console.log('\n');
  console.log('  ██████╗ ██████╗  █████╗     ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗');
  console.log('  ██╔════╝ ██╔══██╗██╔══██╗    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝');
  console.log('  ██║  ███╗██████╔╝███████║    ██║   ██║███████║██║   ██║██║     ██║   ');
  console.log('  ██║   ██║██╔══██╗██╔══██║    ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   ');
  console.log('  ╚██████╔╝██████╔╝██║  ██║     ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   ');
  console.log('   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝      ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   ');
  console.log('');
  console.log('  ─────────────────────────────────────────────────');
  console.log(`  🎮  Server berjalan!`);
  console.log('');
  console.log(`  📍  Lokal    → http://localhost:${PORT}`);
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`  🌐  Jaringan → http://${ip}:${PORT}`);
    });
  }
  console.log('');
  console.log('  Tekan Ctrl+C untuk menghentikan server.');
  console.log('  ─────────────────────────────────────────────────\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌  Port ${PORT} sudah digunakan!`);
    console.error(`  Coba: node server.js (dengan PORT=3001 di depannya)\n`);
    console.error(`  Contoh Windows: set PORT=3001 && node server.js\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
