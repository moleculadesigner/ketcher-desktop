import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Ketcher-core внутри использует Node-модуль `events` (EventEmitter).
// В браузере его нет, и Vite в этом случае подставляет заглушку,
// на которой приложение падает. Поэтому подкладываем браузерный полифил
// из пакета `events`.
const eventsPolyfill = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'events',
  'events.js',
);

// Vite собирает нашу веб-часть (React + Ketcher) в один статичный бандл:
// renderer/dist/*.html/.js/.css — их Electron потом отдаёт через протокол app://.
export default defineConfig({
  root: __dirname,
  // Относительные пути в index.html: dist можно положить куда угодно.
  base: './',
  plugins: [react()],
  define: {
    // Часть кода Ketcher (и его зависимостей) рассчитывает на Node-глобал `global`.
    // В апстримном примере для этого вставляют `var global = global || window`.
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Любой импорт `events` (в том числе из зависимостей) идёт в полифил.
      events: eventsPolyfill,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Chromium внутри Electron 45 — современный, полифилы не нужны.
    target: 'chrome140',
    // Ketcher вместе с Indigo (WASM в base64) весит десятки мегабайт —
    // предупреждение Vite об этом нам не нужно.
    chunkSizeWarningLimit: 50000,
  },
  server: {
    port: 5190,
  },
});
