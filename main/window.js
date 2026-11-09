// main/window.js — создание окна приложения.
//
// Здесь всё, что касается BrowserWindow: размеры, безопасность, загрузка
// интерфейса, реакция на ошибки загрузки и внешние ссылки.

const { BrowserWindow, shell } = require('electron');
const path = require('node:path');

// Переопределение адреса для разработки: KETCHER_URL=http://127.0.0.1:5173/ npm start
const KETCHER_URL = process.env.KETCHER_URL || null;

// Встроенная страница (собранный renderer/dist через протокол app://).
const APP_INDEX_URL = 'app://bundle/index.html';

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
      // Ketcher — обычное веб-приложение, доступ к Node.js из страницы не нужен.
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
    win.loadFile(path.join(__dirname, '..', 'error.html'), {
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

  win.loadURL(KETCHER_URL || APP_INDEX_URL);

  return win;
}

module.exports = { createWindow, APP_INDEX_URL };
