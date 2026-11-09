// main/commands/copy-smiles.js — «скопировать выделение как SMILES»
//
// Зачем это в main-процессе, а не в странице: хоткей должен работать как в
// обычном приложении, а нативное меню — единственное надёжное место для
// Electron-акселераторов. Логика при этом остаётся крошечной: попросить страницу
// сконвертировать выделение и положить результат в буфер обмена.
//
// Как это работает:
//   main  ──executeJavaScript──▶  renderer (window.ketcher)
//   main  ◀── SMILES-строка ─────  renderer
//   main  ──clipboard.writeText──▶  системный буфер
//
// В renderer уходит промис: Indigo (WASM) считает асинхронно.

const { clipboard } = require('electron');

// Код выполняется в контексте страницы. window.ketcher кладёт туда
// renderer/src/main.jsx в onInit.
const COPY_SMILES_SCRIPT = `(async () => {
  const ketcher = window.ketcher;
  const editor = ketcher && ketcher.editor;
  if (!editor) return null;

  // Выделенный фрагмент как структура (пустая структура, если ничего не выделено).
  const struct = editor.structSelected();
  if (!struct || !struct.atoms.size) return null;

  // Конвертация в Daylight SMILES силами Indigo.
  const { struct: smiles } = await ketcher.indigo.convert(struct, {
    outputFormat: 'chemical/x-daylight-smiles',
  });

  return smiles ? smiles.trim() : null;
})()`;

/**
 * Копирует выделение в буфер обмена как SMILES.
 * @param {import('electron').BrowserWindow} win
 * @returns {Promise<string|null>} скопированная строка или null
 */
async function copySelectionAsSmiles(win) {
  if (!win || win.isDestroyed()) return null;

  try {
    const smiles = await win.webContents.executeJavaScript(COPY_SMILES_SCRIPT, true);

    if (!smiles) {
      // Ничего не выделено — это не ошибка, просто нечего копировать.
      // Буфер обмена намеренно не трогаем.
      console.info('[copy-smiles] выделения нет — буфер обмена не менялся');
      return null;
    }

    clipboard.writeText(smiles);
    console.info(`[copy-smiles] скопировано: ${smiles}`);
    return smiles;
  } catch (error) {
    console.error('[copy-smiles] не удалось скопировать:', error);
    return null;
  }
}

module.exports = { copySelectionAsSmiles };
