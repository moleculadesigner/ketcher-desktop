# Ketcher Desktop

Нативная macOS-обёртка для [Ketcher](https://github.com/epam/ketcher) — химического редактора структур.
Обычное приложение: своя иконка в Dock и Launchpad, своё имя, без адресной строки и вкладок.
**Работает офлайн, без локального сервера** — Ketcher и Indigo (WASM) лежат внутри приложения.

![Ketcher в окне Electron](docs/screenshot.png)

Текущие задачи и идеи — в [BACKLOG.md](BACKLOG.md).

## Как устроено

```
┌────────────────────────────── app://bundle ──────────────────────────────┐
│  renderer/  — наша веб-часть (React + ketcher-react из npm)              │
│  Vite собирает её в renderer/dist → внутрь .app (asar)                   │
└──────────────────────────────────────────────────────────────────────────┘
                    ▲                                    
                    │ протокол app:// (main.js)
┌───────────────────┴──────────────────────────────────────────────────────┐
│  main.js — главный процесс Electron: окно, меню, файлы, свой протокол    │
└──────────────────────────────────────────────────────────────────────────┘
```

Два процесса, как в любом Electron-приложении:

- **main** (`main.js`, Node.js) — создаёт окно, отдаёт статику из `renderer/dist`
  через собственный протокол `app://`, а в будущем будет открывать/сохранять файлы.
- **renderer** (React + Chromium) — рисует интерфейс Ketcher.

Зачем протокол `app://`, а не `file://`? Браузер запрещает загружать ES-модули и
Web Worker'ы с `file://` (считает их «чужим происхождением»). `app://bundle/...`
выглядит для Chromium как обычный сайт — и модули, и Worker с WASM работают штатно.
Регистрация — в начале [main.js](main.js), обработчик — `registerAppProtocol()`.

## Быстрый старт

```sh
npm install          # один раз
npm start            # соберёт renderer и откроет приложение
```

Сборки занимают ~2 секунды, `prestart` запускает её автоматически, так что
`npm start` всегда запускает актуальную версию.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm start` | собрать веб-часть и открыть приложение |
| `npm run build:renderer` | только собрать бандл в `renderer/dist` |
| `npm run dev:renderer` | dev-сервер нашей веб-части с hot reload (порт 5190) |
| `npm run dist` | собрать `.app` + `.dmg` + `.zip` в `release/` |
| `npm run ketcher:dev` | dev-сервер Ketcher из локального клона `ketcher/` |
| `npm run icon` | пересобрать `build/icon.png` из `build/icon.svg` (нужен Inkscape) |

## Два режима работы

**1. Обычный запуск (по умолчанию).** Ketcher берётся из npm-пакетов
`ketcher-react` / `ketcher-standalone` и уже вшит в приложение. Сеть и сервер не нужны.

**2. Разработка самого Ketcher.** Если в `ketcher/` вы правите исходники апстрима,
запустите его dev-сервер и укажите на него Electron:

```sh
# терминал 1
npm run ketcher:dev

# терминал 2
KETCHER_URL=http://127.0.0.1:5173/ npm start
```

В этом режиме Electron открывает dev-сервер вместо встроенного бандла — работает
hot reload. Переменными `KETCHER_URL` и `KETCHER_DEVTOOLS=1` удобно пользоваться
и при отладке нашей веб-части через `npm run dev:renderer`.

> **Важно:** пакеты в npm отстают от master. Сейчас в npm `3.18.0`,
> а в локальном клоне `ketcher/` — `3.20.0`. Если нужна свежая версия Ketcher,
> это повод перейти на режим 2 (или собрать пакеты локально).

## Сборка приложения

```sh
npm run dist
```

Результат в `release/`:

- `mac-arm64/Ketcher Desktop.app` — само приложение;
- `Ketcher Desktop-0.1.0-arm64.dmg` — установщик (перетащить в Applications);
- `Ketcher Desktop-0.1.0-arm64-mac.zip` — для обновлений/раздачи.

Установка «как обычное приложение»: перетащить `.app` в `/Applications`
(или `cp -R "release/mac-arm64/Ketcher Desktop.app" /Applications/`), затем
`open -a "Ketcher Desktop"`. После этого иконка появляется в Launchpad и Dock.

Сборка **не подписана** (`mac.identity: null` в [package.json](package.json)):
для личного использования этого достаточно. Для раздачи другим людям нужен
Apple Developer ID и нотаризация, иначе Gatekeeper будет ругаться.

### Иконка

Цепочка такая:

```
build/icon.svg  ──npm run icon──▶  build/icon.png  ──npm run dist──▶  .app/Contents/Resources/icon.icns
   (исходник)                      (1024×1024)                        (набор 16…1024 для Retina)
```

- [build/icon.svg](build/icon.svg) — исходник, его и правим.
- [build/icon.png](build/icon.png) — растр, который делает `npm run icon`
  ([scripts/make-icon.mjs](scripts/make-icon.mjs)).
- `icon.icns` electron-builder собирает сам: в [package.json](package.json) поле
  `build.mac.icon` указывает на PNG, а `build.directories.buildResources` — на папку `build/`.
  В `.app` прописывается `CFBundleIconFile = icon.icns` в `Info.plist`.

**Рендерит Inkscape, а не resvg.** В иконке используются mesh-градиенты (SVG 2,
теги `<meshgradient>` / `<meshpatch>`), которые resvg не поддерживает — он молча
пропускает их, и получается почти пустая картинка. Inkscape же понимает mesh
нативно. Скрипт ищет его в `PATH`, `/opt/homebrew/bin`, `/Applications/Inkscape.app`
(или берёт путь из `INKSCAPE=...`), а если не нашёл — падает обратно на resvg
и предупреждает, что градиенты потеряются.

Порядок замены иконки: правим SVG → `npm run icon` → `npm run dist` → переустановить `.app`.
PNG можно нарисовать и сразу в 1024×1024 (тогда шаг `npm run icon` не нужен),
но SVG удобнее: одна правка — и все размеры пересобраны.

> Если в SVG попал `<script>` (например, `mesh_polyfill` от инструмента, которым
> рисовали) — на сборку он не влияет, Inkscape скрипты не выполняет. Но в файле
> иконки он не нужен: это лишние килобайты и исполняемый код в ассете.

## Структура

```
ketcher-desktop/
├── main.js                 # главный процесс: окно, протокол app://, меню
├── error.html              # подсказка, если приложение не смогло загрузиться
├── renderer/               # наша веб-часть
│   ├── index.html
│   ├── vite.config.js      # сборка в renderer/dist
│   └── src/main.jsx        # React: <Editor> из ketcher-react + standalone Indigo
├── build/icon.svg|png      # иконка приложения
├── ketcher/                # локальный клон апстрима (только для режима разработки)
├── release/                # результат npm run dist (в git не попадает)
└── docs/                   # скриншоты
```

## Как это работает внутри (для тех, кто учит JS/Node)

- `require('electron')` — аналог `import` в Python. Из модуля достаём `app`
  (жизненный цикл), `BrowserWindow` (окно), `protocol` (свои схемы URL).
- `app.whenReady().then(...)` — аналог `await` для события «Electron готов»:
  окна можно создавать только после него.
- `protocol.handle('app', ...)` — мы сами решаем, что отдать на `app://bundle/...`.
  Читаем файл из `renderer/dist` и возвращаем `Response` с правильным `Content-Type`
  (без него Chromium не выполнит `.js` как модуль).
- `webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }` —
  страница не имеет доступа к Node.js. Это правильный дефолт; когда понадобятся
  файловые диалоги, общение пойдёт через `preload.js` + IPC, а не напрямую.
- В `renderer/src/main.jsx` мы кладём экземпляр Ketcher в `window.ketcher` —
  так до его API сможет дотянуться главный процесс (например, для хоткея
  «скопировать выделение как SMILES» из бэклога).

### Две неочевидные правки в сборке

Обе — в [renderer/vite.config.js](renderer/vite.config.js), обе нужны именно
из-за Ketcher:

- `resolve.alias.events` — Ketcher использует Node-модуль `events` (`EventEmitter`).
  В браузере его нет, и Vite подставляет заглушку, на которой приложение падает
  с `EventEmitter is not a constructor`. Поэтому подключён браузерный полифил
  из пакета `events`.
- `define.global` — часть кода Ketcher рассчитывает на Node-глобал `global`.
  Апстримный пример для этого вставляет `var global = global || window`;
  здесь то же самое делается на этапе сборки.

## Траблшутинг

- **Пустое окно / окно с подсказкой** — запустите `KETCHER_DEVTOOLS=1 npm start`
  и посмотрите консоль. Если был задан `KETCHER_URL`, проверьте, что сервер жив.
- **`Emoji ... is not a constructor` / `global is not defined`** — кто-то удалил
  шимы из `renderer/vite.config.js`; верните их.
- **Порт 5173 занят** — Vite возьмёт 5174 и напишет это в консоли;
  тогда `KETCHER_URL=http://127.0.0.1:5174/ npm start`.
- **Приложение не появляется в Launchpad** — проверьте, что `.app` лежит
  в `/Applications`, и обновите базу Launch Services:
  `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/Ketcher Desktop.app"`.

## Что дальше

- Хоткей «копировать выделение как SMILES» на уровне Electron (см. бэклог).
- Открытие/сохранение `.ket`/`.mol`/`.sdf` через `preload.js` + IPC.
- Своё меню приложения вместо стандартного.
