// main/menu.js — меню приложения и горячие клавиши.
//
// Меню — это не только «красивые пункты»: в Electron только через него
// работают акселераторы (Cmd+C, Cmd+Shift+S и т.п.). Глобальные клавиши
// (globalShortcut) здесь не подходят — они перехватывают нажатия во всей
// системе, даже когда приложение не в фокусе.

const { Menu, BrowserWindow } = require('electron');
const { copySelectionAsSmiles } = require('./commands/copy-smiles');

// Команда работает с активным окном. На macOS в момент клика по меню
// фокус может быть уже не на окне, поэтому есть запасной вариант.
function activeWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function buildMenu() {
  const template = [
    // На macOS первый пункт — меню приложения (About, Hide, Quit).
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),

    // Стандартные пункты важны: без editMenu перестанут работать
    // Cmd+C / Cmd+V / Cmd+Z в полях ввода внутри диалогов Ketcher.
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },

    {
      label: 'Structure',
      submenu: [
        {
          id: 'structure.copy-smiles',
          label: 'Copy Selection as SMILES',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => {
            const win = activeWindow();
            if (win) copySelectionAsSmiles(win);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
