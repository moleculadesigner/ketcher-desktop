# Бэклог

Живой список улучшений Ketcher Desktop. Одна задача = зачем, что сейчас, план, критерии готовности.

Статусы: `идея` → `в работе` → `готово`. Приоритет: высокий / средний / низкий.

---

## 1. Копировать выделение как SMILES по хоткею — на уровне Electron

**Статус:** идея · **Приоритет:** высокий · **Область:** `ketcher-desktop`, без правок в `ketcher/`

### Зачем

В Marvin привычный жест: выделил фрагмент → `Cmd+Shift+S` → в буфере SMILES.
Хочется так же, но **не поддерживая форк Ketcher**: хоткей должен жить в Electron-обёртке,
а `ketcher/` оставаться чистым апстримом (его можно `git pull` без конфликтов).

### Текущее состояние

Реализовано в форке — коммит `adcf049f55` («feat(ketcher-react): copy selection as SMILES via Mod+Shift+S»),
файлы [`copyAs.js`](ketcher/packages/ketcher-react/src/script/ui/action/copyAs.js) и
[`action/index.ts`](ketcher/packages/ketcher-react/src/script/ui/action/index.ts).
Логика оттуда, которую надо повторить: `editor.structSelected()` → `ketcher.indigo.convert(struct, { outputFormat: ChemicalMimeType.DaylightSmiles })` → `navigator.clipboard.writeText`.

Теперь нам это проще, чем в форке: своя страница (`renderer/src/main.jsx`) уже кладёт
Ketcher в `window.ketcher` в `onInit`, а приложение работает из встроенного бандла,
поэтому правки в `ketcher/` не нужны вообще.

### План

1. Пункт меню `Copy selection as SMILES` с accelerator `CommandOrControl+Shift+S`
   (меню — единственное место, где Electron-акселераторы работают надёжно; `globalShortcut` не подходит — он системный).
2. Обработчик в main-процессе: `win.webContents.executeJavaScript(...)` — выполняем в странице то же,
   что делал форк, но через публичный `window.ketcher` (его выставляет
   [`App.tsx`](ketcher/example/src/App.tsx#L42) в `onInit`; это апстримный код, менять не нужно).
3. Строку SMILES возвращаем из `executeJavaScript` в main и пишем в буфер через `clipboard.writeText` —
   так не зависим от прав на `navigator.clipboard` в renderer.

Черновик (проверить API на живой структуре):

```js
// main.js
const smiles = await win.webContents.executeJavaScript(`(async () => {
  const k = window.ketcher;
  const struct = k?.editor?.structSelected?.();
  if (!struct || !struct.atoms.size) return null;
  const { struct: s } = await k.indigo.convert(struct, {
    outputFormat: 'chemical/x-daylight-smiles',
  });
  return s.trim();
})()`);
if (smiles) clipboard.writeText(smiles);
```

### Подводные камни

- `window.ketcher` появится только после `onInit` — до этого `executeJavaScript` вернёт `null`. Нормально для хоткея.
- Конвертация идёт через Indigo (WASM), поэтому асинхронная: в `executeJavaScript` нужен `Promise`.
- Indigo ругается на стрелки, R-группы и часть query-структур — ошибку надо показать пользователю, а не глотать.
- Хоткей должен молча ничего не делать при пустом выделении (или коротко мигнуть — решить по ощущениям).
- Проверить, что `Cmd+Shift+S` не перехватывается самим Ketcher (в апстриме такого акселератора нет).

### Критерии готовности

- [ ] Выделил фрагмент → `Cmd+Shift+S` → в буфере SMILES именно выделения, не всей структуры
- [ ] Без выделения — ничего не копирует и не падает
- [ ] `git status` в `ketcher/` чистый
- [ ] Работает и при загрузке со страницы апстрима (`ketcher/example`), и позже — со своей страницей

---

## 2. WYSIWYG-экспорт картинки: звёздочки и any-связи превращаются в SMARTS, алиасы пропадают

**Статус:** идея · **Приоритет:** высокий · **Область:** `ketcher` (upstream-проблема)

![Save Structure: в превью SVG вместо атомов — SMARTS-подписи](docs/backlog-svg-export-smarts.webp)

### Симптом

При экспорте картинки (Save Structure → SVG/PNG) структура с «звёздочкой» (`*`, any atom) или
связью типа any рендерится как SMARTS: вместо `C`/`N` — `[#6]`/`[#7]`, вместо алиасов на атомах — ничего.
Сам холст Ketcher при этом показывает нормальную картинку. То есть экспорт **не WYSIWYG**.

### Как воспроизвести

1. Нарисовать структуру (например, бензол с заместителем).
2. Поставить атом `*` и/или связь типа any; повесить на атом алиас (Edit Atom → Alias).
3. Save Structure → формат `SVG Document` → Preview.
4. Ожидание: картинка как на холсте. Факт: SMARTS-подписи `[#6]`, `[#7]`, алиасы отсутствуют.

### Где копать

- Путь экспорта: [`Save/Save.tsx`](ketcher/packages/ketcher-react/src/script/ui/views/modal/components/document/Save/Save.tsx#L609) —
  `options.outputFormat = imageFormat`, дальше `generateImage` через struct service
  (в standalone-режиме — Indigo WASM, [`formatProperties.ts`](ketcher/packages/ketcher-core/src/application/formatters/formatProperties.ts#L196)).
- **Гипотеза:** Ketcher-холст рисует своим рендерером (`packages/ketcher-core/src/application/render`),
  а картинку на экспорт отдаёт Indigo, который для query-структуры печатает SMARTS-метки и не знает про `atom.alias`.
- Что проверить в первую очередь:
  1. Опции `GenerateImageOptions` / Indigo render: нет ли режима «рисовать как молекулу» или опции показа алиасов.
  2. Как Indigo получает структуру (KET/SMILES?) — возможно, теряется на этапе сериализации, а не рендера.
  3. Альтернативный путь: отдавать SVG из собственного рендерера Ketcher (у него уже есть SVG-сцена), а PNG — растеризовать её.
  4. Сравнить: экспорт в KET → переоткрытие показывает алиасы? Если да — проблема в рендере, а не в модели.

### Решение по оформлению

Правка идёт **PR в апстрим** (`epam/ketcher`), если получится разобраться в причине.
Значит делаем «как для чужого репозитория», а не как локальный хак:

- Отдельная ветка от свежего `master` (сейчас `ketcher/` стоит на локальной
  `feature/copy-as-smiles`, а `origin` смотрит прямо на `epam/ketcher` — форка-ремоута ещё нет).
- Сначала issue: PR-шаблон требует привязку к issue и имя вида `#1234 – issue name`.
  Шаблон бага лежит в [`ISSUE_TEMPLATE/bug_report.md`](ketcher/.github/ISSUE_TEMPLATE/bug_report.md),
  к нему и приложить скриншот из этой задачи.
- Unit-тест: рядом уже есть [`Save.test.tsx`](ketcher/packages/ketcher-react/src/script/ui/views/modal/components/document/Save/Save.test.tsx) — класть туда.
- Пройти чек-лист шаблона PR ([`pull_request_template.md`](ketcher/.github/pull_request_template.md)):
  unit-тесты, e2e-тесты, документация, имя ветки без `#`.
- Минимальный диф: если причина в одной опции Indigo — не переписывать экспорт целиком.

### Критерии готовности

- [ ] Сохранённый SVG визуально совпадает с холстом: `*` — звёздочкой, any-связь — как на холсте, алиасы на месте
- [ ] PNG получается из того же результата (не отдельной веткой кода)
- [ ] Обычные (не-query) структуры экспортируются как раньше — регрессии нет
- [ ] Unit-тест в `Save.test.tsx` (или там, где окажется причина) покрывает query-структуру с алиасом
- [ ] Если Indigo в принципе не умеет — это выяснено и записано в issue, а не замаскировано костылём

---

## Сделано

- **Офлайн-режим без dev-сервера.** Ketcher и Indigo (WASM) собираются в бандл
  (`renderer/dist`) и отдаются приложению через собственный протокол `app://`.
  Проверено: `setMolecule('c1ccccc1O')` → `getSmiles()` возвращает `c1c(O)cccc1`
  без сети. Подробности — в [README.md](README.md#как-устроено).
- **Нативный `.app`: имя, иконка, Launchpad.** `npm run dist` собирает
  `Ketcher Desktop.app` (bundle id `com.moleculadesigner.ketcherdesktop`,
  иконка из [build/icon.svg](build/icon.svg)) и `.dmg`. Установлено в `/Applications`
  и запускается через LaunchServices.

## Идеи без приоритета

- Своё меню приложения (сейчас стандартное Electron-меню).
- Открытие/сохранение `.ket`/`.mol`/`.sdf` через `preload` + IPC.
- Подпись и нотаризация, если приложение когда-нибудь пойдёт «в люди».
