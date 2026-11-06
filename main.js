// main.js — «главный процесс» Electron.
//
// Electron состоит из двух видов процессов:
//   1. main (этот файл) — обычный Node.js-процесс: он создаёт окна,
//      работает с файловой системой, меню, треем и т.п.
//   2. renderer — Chromium внутри окна, который рисует интерфейс
//      (у нас там будет Ketcher).
//
// Поэтому здесь мы не пишем химию и не трогаем DOM — только «окно».

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

// Адрес, который откроется в окне.
// По умолчанию — dev-сервер Ketcher (npm run dev:standalone в папке ketcher/example).
// Можно переопределить: KETCHER_URL=https://example.com npm start
const KETCHER_URL = process.env.KETCHER_URL || 'http://127.0.0.1:5173/';

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
      // Настройки безопасности. Для нашего случая (Ketcher — обычный сайт)
      // они не нужны, но пусть будут явно прописаны:
      // renderer не получает доступ к Node.js и общается с main только через preload.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Если адрес не открылся (например, dev-сервер Ketcher не запущен),
  // показываем понятную подсказку вместо серого экрана Electron.
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // -3 = ERR_ABORTED, это не ошибка (бывает при переходах внутри приложения)
    if (errorCode === -3) return;

    console.error(`Не удалось открыть ${validatedURL}: ${errorDescription} (${errorCode})`);
    win.loadFile(path.join(__dirname, 'error.html'), {
      query: { url: KETCHER_URL },
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

  win.loadURL(KETCHER_URL);
}

// app.whenReady() — промис, который выполняется, когда Electron готов
// создавать окна. `then` — это «сделай это после того, как...».
app.whenReady().then(() => {
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
