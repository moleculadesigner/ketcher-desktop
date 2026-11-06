// scripts/make-icon.mjs — build/icon.svg → build/icon.png (1024×1024)
//
// electron-builder сам превращает этот PNG в icon.icns для .app,
// поэтому менять иконку нужно так:
//   1. правим build/icon.svg
//   2. npm run icon
//   3. npm run dist
//
// Рендерим через Inkscape, а не через resvg: в иконке используются
// mesh-градиенты (SVG 2), которые resvg не поддерживает — он молча
// отрисовывает всё, кроме них, и получается пустая картинка.
//
// Запуск: npm run icon

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'build', 'icon.svg');
const target = path.join(root, 'build', 'icon.png');

// Inkscape можно поставить в разных местах: brew, .app, PATH.
const CANDIDATES = [
  process.env.INKSCAPE,
  '/opt/homebrew/bin/inkscape',
  '/usr/local/bin/inkscape',
  '/Applications/Inkscape.app/Contents/MacOS/inkscape',
].filter(Boolean);

const inkscape = CANDIDATES.find((candidate) => fs.existsSync(candidate));

if (inkscape) {
  execFileSync(
    inkscape,
    [
      source,
      '--export-type=png',
      `--export-filename=${target}`,
      '-w',
      '1024',
      '-h',
      '1024',
    ],
    // Inkscape пишет в stderr кучу предупреждений GTK — они нам не нужны.
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
  console.log('build/icon.svg → build/icon.png через Inkscape');
} else {
  // Запасной вариант: работает везде, но mesh-градиенты потеряются.
  const { Resvg } = await import('@resvg/resvg-js');
  const png = new Resvg(fs.readFileSync(source, 'utf8'), {
    fitTo: { mode: 'width', value: 1024 },
  })
    .render()
    .asPng();
  fs.writeFileSync(target, png);
  console.warn(
    '⚠️  Inkscape не найден — использован resvg. Mesh-градиенты в иконке НЕ отрисуются.\n' +
      '   Установите Inkscape (brew install --cask inkscape) или задайте INKSCAPE=/путь/к/inkscape',
  );
}

const { size } = fs.statSync(target);
console.log(`готово: build/icon.png (${size} байт, 1024×1024)`);
