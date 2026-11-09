// main.js — точка входа Electron-приложения (main-процесс).
//
// Здесь только сборка приложения: порядок инициализации и жизненный цикл.
// Всё остальное разложено по папке main/:
//
//   main/protocol.js     — протокол app://, отдаёт файлы renderer/dist
//   main/window.js       — создание окна и загрузка интерфейса
//   main/menu.js         — меню приложения и горячие клавиши
//   main/commands/*.js   — команды, которые вызываются из меню (и не только)
//
// Правило: main.js не знает деталей — он вызывает модули в правильном порядке.
// Новая фича = новый файл в main/commands/ + пункт меню в main/menu.js.

const { app, BrowserWindow } = require('electron');
const { registerAppScheme, handleAppProtocol } = require('./main/protocol');
const { createWindow } = require('./main/window');
const { buildMenu } = require('./main/menu');

// Собственную схему app:// нужно объявить ДО app.whenReady(),
// иначе Chromium не будет считать её «обычным сайтом».
registerAppScheme();

app.whenReady().then(() => {
  // Обработчик запросов app://... навешивается только после ready.
  handleAppProtocol();

  buildMenu();
  createWindow();

  // macOS: клик по иконке в Dock, когда окон нет — открываем новое.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// На macOS приложение принято не закрывать, когда закрыли все окна.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
