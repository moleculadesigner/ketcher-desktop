// main/protocol.js — свой протокол app://
//
// Chromium не даёт загружать ES-модули и Worker'ы с file:// (считает их «чужим
// происхождением»). Поэтому файлы из renderer/dist мы отдаём через app://bundle/...,
// и для страницы это выглядит как обычный сайт: работают модули, Worker с WASM,
// fetch и относительные пути.
//
// Используется две фазы:
//   1. registerAppScheme()   — ДО app.whenReady(): объявляем схему привилегированной
//   2. handleAppProtocol()   — ПОСЛЕ ready: начинаем отдавать файлы

const { protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// Куда Vite складывает собранную веб-часть.
const RENDERER_DIR = path.join(__dirname, '..', 'renderer', 'dist');

// Content-Type по расширению: без него Chromium не выполнит .js как модуль.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true, // полноценный origin: app://bundle, относительные пути
        secure: true, // «безопасный контекст», как https
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function handleAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = path.join(RENDERER_DIR, relativePath);

    // Защита от «вылезания» за пределы папки: app://bundle/../../etc/passwd
    const inside = path.relative(RENDERER_DIR, filePath);
    if (inside.startsWith('..') || path.isAbsolute(inside)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.readFile(filePath);
      const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

module.exports = { registerAppScheme, handleAppProtocol };
