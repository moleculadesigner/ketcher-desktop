// scripts/install-app.mjs — собрать приложение и поставить его в /Applications.
//
// Зачем: electron-builder всегда оставляет собранный .app в release/mac-arm64/,
// а Spotlight и Launch Services индексируют ЛЮБОЙ .app на диске, не только
// в /Applications. Из-за этого в поиске (Spotlight, Raycast, Alfred) появляются
// две одинаковые программы. Поэтому после копирования в /Applications
// мы удаляем промежуточную копию — .dmg и .zip остаются.
//
// Запуск: npm run install:app

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builtApp = path.join(root, 'release', 'mac-arm64', 'Ketcher Desktop.app');
const installedApp = '/Applications/Ketcher Desktop.app';
const lsregister =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

console.log('→ собираю (npm run dist)…');
execFileSync('npm', ['run', 'dist'], { cwd: root, stdio: 'inherit' });

if (!fs.existsSync(builtApp)) {
  console.error(`✖ не найден ${builtApp}`);
  process.exit(1);
}

console.log(`→ ставлю в ${installedApp}`);
fs.rmSync(installedApp, { recursive: true, force: true });
// ditto, а не cp -R: сохраняет права, xattr и структуру бандла как Finder.
execFileSync('ditto', [builtApp, installedApp]);

// Сообщаем Launch Services о новом приложении (иначе иконка/имя могут
// подхватиться не сразу).
execFileSync(lsregister, ['-f', installedApp]);

// Убираем промежуточную копию, чтобы поиск не показывал две программы.
fs.rmSync(path.join(root, 'release', 'mac-arm64'), {
  recursive: true,
  force: true,
});

console.log('✓ готово: приложение в /Applications, дубль из release/ удалён');
console.log('  установщик остался: release/Ketcher Desktop-0.1.0-arm64.dmg');
