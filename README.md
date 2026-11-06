# Ketcher Desktop

Electron-обёртка для [Ketcher](https://github.com/epam/ketcher) — химического редактора структур.
Шаг 1: окно, которое открывает Ketcher и ведёт себя как обычное приложение
(иконка в Dock, своё имя, без адресной строки и вкладок).

![Ketcher в окне Electron](docs/screenshot.png)

Текущие задачи и идеи — в [BACKLOG.md](BACKLOG.md).

## Что уже работает

- Окно 1280×900 с минимальными размерами, открывает `http://127.0.0.1:5173/` — dev-сервер Ketcher
  из папки `ketcher/example`.
- Если сервер не запущен — вместо серого экрана показывается подсказка `error.html`.
- Внешние ссылки открываются в системном браузере, а не внутри приложения.
- Адрес можно переопределить переменной окружения `KETCHER_URL`.

## Как запустить

Нужны **два терминала**.

**Терминал 1 — сам Ketcher** (веб-часть, её отдаёт Vite dev-сервер):

```sh
cd ketcher/example
npm run dev:standalone
# ждём строку: VITE v8.x  ready ... http://127.0.0.1:5173/
```

**Терминал 2 — наше окно**:

```sh
npm start
```

Открывается окно Electron, внутри — Ketcher. Закрыли окно — процесс завершился.

> Почему два процесса? Ketcher — это веб-приложение (HTML/CSS/JS + WASM).
> Vite — «веб-сервер + сборщик» для него, Electron — браузер в отдельном окне.
> Так сделано, чтобы во время разработки работал hot reload: поменяли код Ketcher —
> окно обновилось само, без перезапуска Electron.

### Полезные переменные

| Переменная | Что делает |
| --- | --- |
| `KETCHER_URL` | какой адрес открыть в окне (по умолчанию `http://127.0.0.1:5173/`) |
| `KETCHER_DEVTOOLS` | `KETCHER_DEVTOOLS=1 npm start` — открыть DevTools (консоль, инспектор DOM) |

Пример: `KETCHER_URL=http://127.0.0.1:4002 npm start`

## Структура проекта

```
ketcher-desktop/
├── package.json     # описание проекта: имя, точка входа (main.js), скрипты, зависимости
├── main.js          # ГЛАВНЫЙ процесс: создаёт окно, грузит в него Ketcher
├── error.html       # страница-подсказка, если Ketcher не запущен
├── ketcher/         # исходники Ketcher (клон репозитория epam/ketcher)
└── node_modules/    # сюда npm складывает зависимости (в git не попадает)
```

## Как это устроено (мини-ликбез по JS/Node)

Electron — это два вида процессов:

```
            main.js (Node.js)                 renderer (Chromium)
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ создаёт окна, меню, трей     │   │ рисует интерфейс:            │
    │ работает с файлами, ОС       │──▶│ HTML + CSS + JS (тут Ketcher)│
    │ НЕ рисует интерфейс          │   │ НЕТ прямого доступа к Node   │
    └──────────────────────────────┘   └──────────────────────────────┘
                    ▲                                  │
                    └──────── preload.js + IPC ────────┘
                              (следующий шаг)
```

Сейчас `preload.js` не нужен: окно только показывает сайт и ничего не просит у main.
Когда захотите открывать/сохранять `.ket`/`.mol` файлы на диске — понадобится.

### Разбор `main.js` по строкам

```js
const { app, BrowserWindow, shell } = require('electron');
```

`require` — аналог `import` в Python. Достаём из модуля `electron` три объекта:
`app` (само приложение, жизненный цикл), `BrowserWindow` (класс окна),
`shell` (утилиты ОС, например «открой эту ссылку в браузере»).

```js
const KETCHER_URL = process.env.KETCHER_URL || 'http://127.0.0.1:5173/';
```

`process.env` — переменные окружения (как `os.environ` в Python).
`a || b` — «a, а если пусто/undefined — то b».

```js
const win = new BrowserWindow({ width: 1280, height: 900, ... });
win.loadURL(KETCHER_URL);
```

Создали окно и сказали загрузить в него адрес. Всё остальное в объекте —
настройки: `webPreferences` отвечает за безопасность renderer'а
(мы явно выключаем доступ к Node из страницы — так правильно).

```js
win.once('ready-to-show', () => win.show());
```

`on` / `once` — подписка на события, как сигналы в Qt. Окно создаётся скрытым
(`show: false`) и показывается, когда страница отрисовалась — без белой вспышки.

```js
app.whenReady().then(() => { createWindow(); });
```

`whenReady()` возвращает промис (аналог `asyncio.Future`/`await`), `.then(...)` —
«когда Electron будет готов, вызови эту функцию». Стрелка `() => { ... }` —
лямбда-функция, как `lambda` в Python.

```js
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

На macOS приложение не принято закрывать при закрытии всех окон (как Safari).

### Что почитать

- [Electron: Quick Start](https://www.electronjs.org/docs/latest/tutorial/quick-start)
- [Electron: Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — как раз про main/renderer
- [MDN: JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) — если хочется разобраться в синтаксисе

## Что дальше (по возрастанию сложности)

1. **Офлайн-режим**: собрать Ketcher (`npm run build:standalone` в `example`)
   и отдавать готовые файлы из самого приложения через свой протокол,
   чтобы dev-сервер не требовался.
2. **Файлы на диске**: `preload.js` + `ipcMain`/`ipcRenderer` + `dialog.showOpenDialog`
   — открывать `.ket`, `.mol`, `.sdf` с диска и сохранять обратно. Это главное,
   ради чего вообще делают десктопную обёртку.
3. **Меню приложения**: свои пункты («Открыть…», «Сохранить как…») вместо стандартных.
4. **Сборка `.app`/`.exe`**: `electron-builder` или `@electron-forge/cli`.

## Траблшутинг

- **Окно с подсказкой вместо Ketcher** — не запущен dev-сервер (`npm run dev:standalone`
  в `ketcher/example`) или он слушает другой порт. Проверьте адрес в `KETCHER_URL`.
- **Порт 5173 занят** — Vite возьмёт 5174 и напишет это в консоли.
  Тогда: `KETCHER_URL=http://127.0.0.1:5174/ npm start`.
- **Пустое окно, ошибок нет** — запустите с DevTools: `KETCHER_DEVTOOLS=1 npm start`
  и посмотрите консоль.
