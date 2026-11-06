// main.js — «главный процесс» Electron.
//
// Electron состоит из двух видов процессов:
//   1. main (этот файл) — обычный Node.js-процесс: он создаёт окна,
//      работает с файловой системой, меню, треем и т.п.
//   2. renderer — Chromium внутри окна, который рисует интерфейс
//      (у нас там React-приложение с Ketcher из папки renderer/).
//
// Откуда берётся интерфейс:
//   • Обычный запуск — из собранного бандла renderer/dist через протокол app://.
//     Никакого сервера не нужно, всё внутри приложения.
//   • Разработка — если задан KETCHER_URL, окно откроет этот адрес
//     (например, dev-сервер Ketcher из ketcher/example).

const { app, BrowserWindow, shell, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// Переопределение адреса для разработки: KETCHER_URL=http://127.0.0.1:5173/ npm start
const KETCHER_URL = process.env.KETCHER_URL || null;

// Папка с собранным React-приложением (её создаёт `npm run build:renderer`).
const RENDERER_DIR = path.join(__dirname, 'renderer', 'dist');

// Собственный протокол app:// — чтобы файлы из папки выглядели для Chromium
// как обычный сайт. С file:// современные ES-модули и Worker'ы не работают
// (браузер считает их «чужим происхождением»), а с app:// — работают.
//
// registerSchemesAsPrivileged обязан вызываться ДО app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true, // полноценный origin: app://bundle, относительные пути
      secure: true, // считается «безопасным контекстом» (как https)
      supportFetchAPI: true, // доступен fetch()
      corsEnabled: true,
      stream: true,
    },
  },
]);

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

// Обработчик запросов app://bundle/... → файл из renderer/dist
function registerAppProtocol() {
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Ketcher Desktop',
    backgroundColor: '#ffffff',
    // Окно показываем только после того, как страница отрисована,
    // иначе при старте мелькает белый экран.
    show: false,
    webPreferences: {
      // Настройки безопасности. Ketcher — обычное веб-приложение,
      // поэтому доступ к Node.js из страницы не нужен:
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Если страница не открылась, показываем понятную подсказку
  // вместо серого экрана Electron.
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // -3 = ERR_ABORTED, это не ошибка (бывает при переходах внутри приложения)
    if (errorCode === -3) return;

    console.error(`Не удалось открыть ${validatedURL}: ${errorDescription} (${errorCode})`);
    win.loadFile(path.join(__dirname, 'error.html'), {
      query: { url: validatedURL },
    });
  });

  // Ссылки, которые «просятся» открыть новое окно, отправляем в системный браузер.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Инструменты разработчика: KETCHER_DEVTOOLS=1 npm start
  if (process.env.KETCHER_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.loadURL(KETCHER_URL || 'app://bundle/index.html');
}

// app.whenReady() — промис, который выполняется, когда Electron готов
// создавать окна. `then` — это «сделай это после того, как...».
app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  // macOS: если приложение открыли повторно (клик по иконке в Dock),
  // а окон нет — создаём новое.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// На macOS приложение принято не закрывать, когда закрыли все окна.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
