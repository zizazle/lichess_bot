# ChessCoach Scripting SDK v2.0

> **ИНСТРУКЦИЯ ДЛЯ НЕЙРОСЕТИ (CLAUDE / CHATGPT / GEMINI):**
> Вы выступаете в роли Senior JS/Canvas разработчика плагинов для браузерного шахматного расширения **ChessCoach REWORK (Manifest V3)**.
> Пользователь прикрепил этот файл (`CHESSCOACH_API_DOCS.md`) и эталонный скрипт (`scripts/sample.js`).
> Ваша задача — написать готовый однофайловый скрипт для замены содержимого `scripts/sample.js` строго по спецификации **ChessCoach SDK v2.0 (`window.CC`)**.

---

> **Безопасность и статус SDK:** пользовательские скрипты не изолированы sandbox и имеют доступ к DOM и стандартным Web API в контексте content script. SDK не гарантирует блокировку чтения доступных странице данных или внешних запросов. CSP, CORS и HttpOnly являются отдельными ограничениями браузера, а не системой разрешений SDK. Запускайте только проверенный и доверенный код. `onFrame` экспериментален и не гарантирует постоянные 60 FPS.

## 1. Матрица реализуемости (Когда выполнять запрос, а когда выдавать отказ)

Перед генерацией кода проверьте запрос пользователя по таблице ниже:

### Реализуемые возможности

1. **Canvas-эффекты на доске (`onFrame`, координаты `800×800`):** частицы, эффекты взятия (`state.isCapture`), молнии, кометы, прицелы, подсветка шаха (`state.isCheck`), кастомные стрелки. Частота кадров зависит от браузера, нагрузки и Performance Governor.
2. **Кастомизация темы доски и сайта (`api.board.setCustomTexture`, `api.css.injectPage`):** замена текстуры клеток (включая загрузку своего фото через `api.ui.addFilePicker`), неон вокруг доски, кастомный фон страницы.
3. **Вторые окна и виджеты на экране (`api.createWindow`, `api.osd.showBanner`):** Killfeed взятых фигур, таймеры, радары точности, рофл-баннеры при зевках.
4. **Процедурные звуки (`api.audio.playTone`, `api.audio.ping`):** звуковые оповещения на шахи, взятия, цейтнот и маты через синтезатор WebAudio.

### Нереализуемые и недопустимые запросы

1. **Скрытие стрелок от OBS при захвате того же окна браузера** — браузер рендерит DOM и вкладку в единый буфер видеокарты; скрипт внутри вкладки не может вызвать системный WinAPI флаг `SetWindowDisplayAffinity`.
2. **Взлом сервера Lichess / Chess.com** (накрутка рейтинга ELO в базе сайта, добавление времени на серверные часы соперника, просмотр закрытых карт или IP соперника) — эти данные хранятся на сервере.
3. **Кража cookies, токенов сессии или скрытая отправка личных данных** недопустима. Не обещайте, что SDK технически блокирует такие действия: пользовательские скрипты не изолированы, а отсутствие разрешения `cookies` не защищает все данные, доступные через DOM и Web API.

---

## 2. Жизненный цикл и структура скрипта (`scripts/sample.js`)

Каждый скрипт регистрируется через `window.CC.registerScript({...})` и оборачивается в IIFE:

```javascript
(function () {
  if (!window.CC) return;

  window.CC.registerScript({
    id: "unique_script_id",
    name: "🔥 Название скрипта в меню",
    version: "2.0.0",
    author: "Автор",
    description: "Краткое описание для вкладки 📜 СКРИПТЫ.",

    // Вызывается при включении тумблера во вкладке «📜 СКРИПТЫ»
    onEnable(api) {
      const win = api.createWindow({
        id: "my-script-win",
        title: "🔥 НАСТРОЙКИ СКРИПТА",
        x: 28,
        y: 90,
        width: 340
      });
      // Добавление элементов управления в win.body...
    },

    // Вызывается через requestAnimationFrame; постоянные 60 FPS не гарантируются
    onFrame(api, ctx, dt, state) {
      // ctx — готовый CanvasRenderingContext2D (800x800) прямо поверх шахматной доски
    },

    // Вызывается каждые 250 мс
    onTick(api, state) {},

    // Вызывается мгновенно при каждом новом ходе на доске
    onMove(api, state) {},

    // Вызывается при обновлении лучшего хода или оценки движка
    onEvalUpdate(api, state) {},

    // При выключении SDK очищает ресурсы, созданные через его API
    onDisable(api) {}
  });
})();
```

## 3. Справочник методов `api`

### 3.1. Создание окна и UI-компонентов (`api.createWindow`, `api.ui`)

```javascript
const win = api.createWindow({ id: "custom-win", title: "⚙️ МОЙ СКРИПТ", x: 30, y: 100, width: 345 });

// Вкладки внутри окна скрипта (возвращает объект с контейнерами вкладок):
const tabs = api.ui.createTabs(win.body, ["Визуал", "Доска", "Звук"]);

// Тумблер (Checkbox):
api.ui.addToggle(tabs["Визуал"], {
  label: "Включить эффект",
  value: true,
  onChange(checked) {}
});

// Ползунок (Slider):
api.ui.addSlider(tabs["Визуал"], {
  label: "Масштаб частиц",
  min: 0.5, max: 3.0, step: 0.1, value: 1.2, unit: "x",
  onChange(val) {}
});

// Выбор цвета (ColorPicker):
api.ui.addColorPicker(tabs["Визуал"], {
  label: "Цвет свечения",
  value: "#00f5d4",
  onChange(hexColor) {}
});

// Загрузка своего фото / текстуры с ПК (возвращает Base64 DataURL):
api.ui.addFilePicker(tabs["Доска"], {
  label: "Своя картинка клеток",
  accept: "image/*",
  onChange(dataUrl) {
    api.board.setCustomTexture({ mode: "tile", imageSrc: dataUrl });
  }
});

// Горячая клавиша (Keybind как в CS:GO):
api.ui.addKeybind(tabs["Визуал"], {
  label: "Клавиша активации",
  defaultKey: "KeyX",
  onTrigger() {}
});

// Выпадающий список (Select):
api.ui.addSelect(tabs["Визуал"], {
  label: "Режим",
  options: [
    { value: "neon", label: "Неоновый" },
    { value: "fire", label: "Огненный" }
  ],
  value: "neon",
  onChange(val) {}
});

// Кнопка и текстовая заметка:
api.ui.addButton(tabs["Звук"], { label: "🔊 Тест звука", onClick() {} });
api.ui.addNote(tabs["Звук"], { text: "Подсказка для пользователя." });
```

Методы управления доступны также на объекте окна, например `win.addToggle(label, defaultVal, onChange)`.

### 3.2. Работа с доской, Canvas, SVG и текстурами (`api.board`)

Координатная сетка доски для Canvas и SVG всегда составляет 800×800 пикселей (каждая клетка — 100×100 пикселей).

api.board.sqToXY(square) — переводит шахматную нотацию ("e4", "f7") в пиксельные координаты центра клетки { x, y } в системе 800×800 с автоматическим учетом переворота доски за черных (isBlackOrientation).

api.board.setSvgLayer(svgMarkupString) — рисует векторный SVG-слой поверх доски.

api.board.setCustomTexture({ mode: "tile" | "full", imageSrc, lightColor, darkColor, glowColor }) — меняет внешний вид клеток или всей доски на Lichess и Chess.com.

api.board.resetCustomTexture() — возвращает стандартную доску.

### 3.3. Объект состояния партии `state`

Состояние передаётся в хуки и доступно через `api.getGameState()`:

```javascript
const state = {
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  boardMatrix: [ /* Массив 8x8: "P","N","B","R","Q","K" (белые), "p","n","b","r","q","k" (черные) или null */ ],
  isBlackOrientation: false, // true если мы играем за черных (доска перевернута)
  myColor: "w",              // "w" | "b"
  lastMoveFrom: "e2",        // Клетка, ОТКУДА только что сходили
  lastMoveTo: "e4",          // Клетка, КУДА только что сходили (идеально для взрывов/эффектов!)
  isCapture: false,          // true, если последним ходом съели фигуру
  capturedPiece: null,       // Тип съеденной фигуры ("p", "n", "b", "r", "q") или null
  isCheck: false,            // true, если на доске сейчас шах
  kingSquare: null,          // Клетка атакованного короля при шахе (например, "e8")
  bestMoveUci: "g1f3",       // Лучший ход по текущему анализу
  bestMoveFrom: "g1",        // Клетка старта лучшего хода
  bestMoveTo: "f3",          // Целевая клетка лучшего хода
  bestEvalText: "+0.45",     // Оценка позиции ("+1.25", "МАТ #1")
  avgMoveUci: "b1c3",        // Отдельная альтернативная линия, если есть
  myClock: "2:45",           // Наше время на часах
  enemyClock: "2:31",        // Время соперника
  moveCount: 12,             // Счетчик ходов в партии
  openingName: "◈ ИТАЛЬЯНСКАЯ ПАРТИЯ"
};
```

### 3.4. Баннеры, CSS, звук и таймеры

api.osd.showBanner({ id, text, subtext, accentColor, position }) — выводит красивый баннер на экран (position: "top-center", "bottom-center", "top-left", "bottom-left").

api.osd.hideBanner(id) — скрывает баннер.

api.css.injectPage(id, cssString) — инжектит CSS во внешний документ сайта (и автоматически удаляет при выключении скрипта).

api.audio.playTone(freqHz, durationMs, waveType) — проигрывает звук через синтезатор (waveType: "sine", "triangle", "square", "sawtooth").

`api.setInterval(fn, ms)`, `api.setTimeout(fn, ms)` и `api.addEventListener(target, event, fn)` учитываются SDK и очищаются при выключении скрипта. Это управление ресурсами, а не изоляция кода; напрямую созданные таймеры, DOM-узлы и слушатели нужно освобождать самостоятельно.

## 4. Архитектура

```text
ChessCoach_Root/
├── manifest.json            # Конфигурация Manifest V3, права доступа и порядок загрузки скриптов
├── README.md                # Описание основного расширения
├── CHESSCOACH_API_DOCS.md   # Данная спецификация API для нейросетей и разработчиков
├── background/
│   └── background.js        # Service Worker: двухфазный движок, альфа-бета поиск, облако Lichess 3000, таблицы эндшпилей Syzygy, WDL% телеметрия и база опыта (Experience DB)
├── offscreen/
│   ├── offscreen.html       # Persistent MV3 Offscreen Document для единого движка
│   └── offscreen.js         # Очередь full NNUE Stockfish, cache, cancel и idle lifecycle
├── content/
│   ├── main-bridge.js       # WebSocket-мост для мгновенной отправки ходов (только Lichess, мир MAIN)
│   ├── privacy-mask-bootstrap.js # Раннее скрытие профилей Chess.com до загрузки основного HUD
│   ├── content.css          # Стили Liquid Glass HUD, анимации стрелок, тем и карточек
│   ├── content.js           # Основное ядро и интерфейс для Lichess.org (режимы HvH / Все / Legit)
│   └── chesscom.js          # Стелс-ядро для Chess.com (кривые Безье, Закон Фиттса, фильтр T1%)
├── lib/
│   ├── openings.js          # Энциклопедия дебютов и гамбитов (window.ChessOpenings)
│   ├── explainer.js         # Человеческое объяснение ходов и рофл-радар ошибок врага (window.ChessExplainer)
│   ├── phonk-fx.js          # WebAudio синтезатор звука, тактические пинги и Phonk-эдит (window.ChessFX)
│   ├── engine-client.js     # Facade Engine Core 2: full offscreen backend и Lite fallback
│   ├── privacy-mask.js      # Визуальная маскировка профилей Chess.com для записи
│   ├── stockfish-local.js   # Локальный Stockfish 19 в WebWorker
│   └── script-api.js        # Ядро системы скриптов (window.CC): инжектит вкладку «📜 СКРИПТЫ», управляет окнами плагинов и хуками
├── data/
│   ├── eco-book.js          # Компактный CC0 ECO-индекс по UCI-префиксу (3865 линий)
│   └── chess-openings.COPYING.txt
├── vendor/stockfish/
│   ├── stockfish-19-single.js
│   ├── stockfish-19-single.wasm # Full NNUE Stockfish 19 WASM
│   ├── COPYING.txt
│   └── SOURCE.txt
└── scripts/
    └── sample.js            # Пользовательский скрипт (точка входа для кастомных модификаций)
```
