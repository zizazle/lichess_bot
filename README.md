# ChessCoach REWORK

![Version](https://img.shields.io/badge/version-15.8.0-4c8bf5?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-V3-2f855a?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-116%2B-4285f4?style=flat-square)
![Status](https://img.shields.io/badge/status-intermediate_update-f59e0b?style=flat-square)

> [!IMPORTANT]
> Версия `15.8.0` является промежуточным апдейтом, а не финальным стабильным релизом. Engine Core 2 и основные функции уже интегрированы, но интерфейс, Script API, формат конфигурации и DOM-адаптеры ещё могут измениться до стабильной версии.

ChessCoach REWORK - локальное браузерное расширение Manifest V3 для анализа стандартных шахматных позиций на Lichess и Chess.com. Расширение внедряет HUD непосредственно в страницу, объединяет собственный двухфазный JS-поиск, Stockfish 19 NNUE, облачные источники анализа и визуальные подсказки.

Сборка не требуется: в проекте нет `package.json`, bundler или обязательных внешних зависимостей.

## Fair Play

Подсказки движка, стрелки, автоматические ходы и premove во время текущей партии могут нарушать правила Fair Play Lichess и Chess.com. Названия режимов `legit`, `stealth`, `anti-ban` и похожие параметры интерфейса не гарантируют безопасность аккаунта или невозможность обнаружения. Ответственность за использование расширения лежит на пользователе.

## Поддержка

| Компонент | Текущее состояние |
|---|---|
| Браузер | Google Chrome 116+ |
| Lichess | Основной адаптер и MAIN-world WebSocket bridge |
| Chess.com | Отдельный адаптер с поддержкой открытых Shadow DOM |
| Шахматный режим | Стандартные шахматы |
| Chess960 и варианты | Не поддерживаются |
| Firefox | Отдельный manifest отсутствует |
| Интерфейс | Встроенный HUD, popup/options page отсутствуют |

Другие Chromium-браузеры могут запускать расширение, но официально текущей версией не проверяются.

## Установка

1. Скачайте или клонируйте проект.
2. Откройте `chrome://extensions/`.
3. Включите режим разработчика.
4. Нажмите `Загрузить распакованное расширение`.
5. Выберите каталог проекта, в котором находится `manifest.json`.
6. Перезагрузите уже открытые вкладки Lichess и Chess.com.

Полный Stockfish NNUE содержит крупный WASM-файл, поэтому первая инициализация движка может занять заметное время.

## Возможности по платформам

| Возможность | Lichess | Chess.com |
|---|:---:|:---:|
| Fast/Deep анализ | Да | Да |
| Stockfish 19 NNUE и Lite fallback | Да | Да |
| Syzygy, Cloud Eval, Explorer | Да | Да |
| Лучший, средний и худший ход | Да | Да |
| SVG-стрелки, клетки и heatmap | Да | Да |
| Eval bar, WDL, PV и график оценки | Да | Да |
| Auto move | Да | Да |
| Проверяемый premove | Да | Нет |
| WebSocket + DOM hybrid | Да | Нет |
| Bézier click/drag | Нет | Да |
| T1 limiter и hesitation | Нет | Да |
| Privacy mask | Нет | Да |
| Пользовательский Script API | Да | Да |

Средняя и худшая линии зависят от режима и настроек. `ENGINE MAX` намеренно отключает среднюю линию.

## Аналитический pipeline

Расчёт позиции проходит в несколько этапов:

1. Fast pass собственного JS-движка быстро проверяет легальность, тактику, угрозы королю, висящие фигуры и форсированные продолжения.
2. Deep pass углубляет собственный поиск и уточняет тактические оценки.
3. Локальный Stockfish запускается параллельно при подходящих условиях.
4. До семи фигур приоритет получает Lichess Syzygy.
5. Для подходящих позиций Deep pass может использовать Lichess Cloud Eval или Masters Explorer.
6. Результаты объединяются только для актуального `positionId`; ответы от старой позиции отбрасываются.

Текущие временные бюджеты собственного поиска:

| Этап | Ориентир |
|---|---:|
| Fast pass | 26 мс в turbo, 48 мс в обычном режиме |
| Deep pass | 95-340 мс в зависимости от позиции и режима |
| Внешние API | Таймаут до 650 мс |

Ползунок `400-3000 ELO` управляет эвристиками собственного движка и профилями выбора. Это UI-параметр, а не измеренный рейтинг Stockfish: UCI `Skill Level`, `UCI_Elo` и `UCI_LimitStrength` не используются.

## Stockfish 19 NNUE

Основной backend использует упакованный `Stockfish.js 19.0.1` с full NNUE:

- один Worker в MV3 Offscreen Document;
- один поток `Threads=1`;
- Hash 32 МБ для устройств с 8-15 ГБ RAM;
- Hash 64 МБ для устройств с 16 ГБ RAM и выше;
- очередь до восьми запросов;
- LRU-кеш последних 48 расчётов;
- автоматическое закрытие offscreen document после трёх минут простоя.

Full backend выбирается, когда `navigator.deviceMemory` доступен и сообщает не менее 8 ГБ. Если устройство не подходит или full backend не загрузился, `lib/engine-client.js` переключается на Stockfish 19 Lite/ASM из `lib/stockfish-local.js`.

На производительных desktop-устройствах Lite backend может использовать второй Worker как верификатор опасного решения. Performance Governor автоматически сокращает дополнительную нагрузку при ухудшении производительности страницы.

## ENGINE MAX

`ENGINE MAX` предназначен для ожидания основного ответа Stockfish перед выбором хода:

- включает локальный Stockfish;
- выставляет профиль `balanced` и UI-ELO 3000;
- отключает average line, humanizer, turbo и случайный выбор;
- использует `MultiPV=1`;
- устанавливает вероятность запуска автохода в 100%;
- ждёт primary Stockfish перед автоматическим ходом;
- показывает стрелку только после завершения финального этапа Deep/NNUE-анализа;
- оставляет мгновенный показ точного Syzygy-хода и мата в один.

Адаптивный бюджет Stockfish достигает 4,2 секунды на Lichess и 3,6 секунды на Chess.com. На Lichess full NNUE также может заранее просчитать вероятный ответ соперника.

`ENGINE MAX` не включает auto move самостоятельно, не гарантирует использование full NNUE на любом устройстве и не является подтверждением рейтинга 3000 ELO.

## Анализ и визуализация

HUD показывает:

- лучший ход, оценку и principal variation;
- опциональные средний и худший ходы;
- eval bar и историю оценки;
- WDL, часы, источник анализа и ближайшую угрозу;
- тактические признаки: мат, шах, вилка, связка, жертва, ловушка и висящая фигура;
- состояние Stockfish, глубину, Hash и NPS при наличии данных.

Дебютный модуль использует ECO-индекс из 3865 разобранных линий глубиной до 20 полуходов, а также 36 вручную описанных дебютов и гамбитов с русскими пояснениями и отдельными premove-линиями.

WDL, trap chance, premove confidence и T1 являются внутренними эвристиками, а не гарантированными вероятностями.

В текущей версии доступны:

- 11 эвристических игровых профилей;
- 11 тем HUD;
- 16 стилей указателя хода: 4 клеточных и 12 стрелочных;
- 4 стиля матового эффекта;
- heatmap контроля 64 клеток;
- настройка масштаба и прозрачности указателей;
- пользовательский фон HUD с blur и затемнением.

Профили `tal`, `carlsen`, `hikaru`, `alphazero` и другие являются наборами коэффициентов оценки. Они не копируют модели или точный стиль названных игроков.

## Auto Move и premove

### Lichess

Доступны методы `hybrid`, `click` и `drag`. Hybrid использует MAIN-world bridge к WebSocket Lichess и DOM fallback. Настраиваются задержка, jitter, вероятность запуска, humanizer, выбор второй линии и защита критических ходов.

Отдельный premove-модуль включает:

- локальный мгновенный preview;
- проверку нескольких вероятных ответов соперника в background service worker;
- три уровня риска;
- premove-стрелки;
- дебютные premove-линии;
- optional ponder через full NNUE в `ENGINE MAX`.

### Chess.com

Доступны Bézier click и Bézier drag, hesitation, ограничение доли совпадений с top-1 и ручной запуск текущей рекомендации. Полноценный premove-модуль для Chess.com в этой версии отсутствует.

`Safe anti-ban guard` блокирует только автоматический запуск и не является гарантией безопасности.

## Privacy Mask для Chess.com

Privacy Mask предназначен для визуального скрытия данных во время записи экрана. Он может подменять:

- nickname и rating;
- title и flag;
- avatar, flair и дополнительные детали;
- заголовок вкладки;
- переходы к профилю.

Доступны 11 presets, пользовательский профиль, локальные изображения, ротация профиля соперника и три оформления: `Broadcast Neon`, `Royal Grandmaster`, `Chess.com Original`.

Ранний bootstrap скрывает карточки игроков до загрузки основного HUD, уменьшая кратковременный показ настоящих данных.

> [!WARNING]
> Privacy Mask выполняет только визуальную подмену. Он не анонимизирует сетевой трафик и не удаляет настоящие данные из внутренних структур сайта. Не используйте его как средство информационной безопасности.

## Experience DB

Experience DB хранит в `chrome.storage.local` таблицу бонусов для пары `FEN + UCI`:

- победа повышает вес отслеженных собственных ходов;
- поражение уменьшает вес;
- ничья увеличивает счётчик партий без изменения бонуса;
- вручную можно закрепить или запретить ход;
- база экспортируется и импортируется отдельно в JSON.

Это эвристическая таблица опыта, а не нейросетевое обучение. Автоматически учитываются только последние отслеженные собственные ходы партии.

## Конфигурация

Настройки, положение HUD, выбранная вкладка и локальный опыт сохраняются в `chrome.storage.local`. Большинство общих параметров используются обоими сайтами, поэтому изменение настройки на одной платформе может повлиять на другую.

Файл `.chess` содержит JSON-конфигурацию с сигнатурой `CHESSCOACH_CONFIG_V15` и может включать:

- настройки движка и визуализации;
- параметры auto move;
- встроенный пользовательский фон;
- Privacy Mask на Chess.com.

Импорт также принимает `.json`. Данные не шифруются, а строгая миграция схем между промежуточными версиями пока не реализована.

## Горячие клавиши

| Клавиша | Действие |
|---|---|
| `Insert` | Показать или скрыть HUD |
| удержание `Alt` | Показать heatmap |
| `X` или `Ч` | Выполнить рекомендованный ход на Chess.com |
| `Ctrl+Shift+M` | Включить или выключить Privacy Mask |
| `Escape` | Остановить активный матовый или аудиоэффект |

Дополнительные сочетания можно зарегистрировать через Script API.

## Script API v2

`lib/script-api.js` публикует `window.CC` для пользовательских JavaScript-модулей. API включает:

- lifecycle hooks `onEnable`, `onDisable`, `onTick`, `onMove`, `onEvalUpdate`, `onFrame`;
- чтение текущего состояния партии;
- вкладки, окна, input, select, toggle, slider, button и keybind;
- OSD-уведомления;
- SVG-слой и Canvas helpers;
- CSS для страницы и Shadow DOM;
- WebAudio tone/ping;
- локальное хранилище скрипта;
- отслеживаемые timers и listeners.

Чтобы добавить локальный скрипт:

1. Поместите JavaScript-файл в `scripts/`.
2. Перезагрузите unpacked extension на странице `chrome://extensions/`.
3. Подключите файл через вкладку скриптов HUD.

Hot reload и sandbox отсутствуют. Скрипт выполняется с доступом content script к DOM и стандартным Web API. `onFrame` в промежуточной версии считается экспериментальным и не гарантирует постоянные 60 FPS.

Документация: [`CHESSCOACH_API_DOCS.md`](CHESSCOACH_API_DOCS.md)  
Пример: [`scripts/sample.js`](scripts/sample.js)

## Архитектура

```text
CHESS/
|-- manifest.json
|-- background/
|   `-- background.js          # JS-движок, API, Syzygy, premove, Experience DB
|-- content/
|   |-- content.js             # Lichess adapter
|   |-- chesscom.js            # Chess.com adapter
|   |-- main-bridge.js         # Lichess MAIN-world bridge
|   |-- privacy-mask-bootstrap.js
|   `-- content.css
|-- lib/
|   |-- engine-client.js       # NNUE/fallback client и Performance Governor
|   |-- stockfish-local.js     # Stockfish Lite/ASM fallback
|   |-- privacy-mask.js        # Chess.com Privacy Mask
|   |-- script-api.js          # window.CC
|   |-- openings.js
|   |-- explainer.js
|   `-- phonk-fx.js
|-- offscreen/
|   |-- offscreen.html
|   `-- offscreen.js           # Full NNUE queue, cache и lifecycle
|-- vendor/stockfish/          # Stockfish 19.0.1 full NNUE assets и GPL
|-- data/                      # ECO book и лицензия CC0
|-- assets/profiles/           # Локальные профили Privacy Mask
`-- scripts/                   # Пользовательские JavaScript-модули
```

## Permissions и сеть

Manifest запрашивает только два служебных разрешения:

- `storage`;
- `offscreen`.

Отдельно разрешены HTTPS-запросы к Lichess, Chess.com, Lichess Tablebase, Lichess Explorer и `ntfy.sh`. Расширение не запрашивает `cookies`, `tabs`, `webRequest`, `downloads` или `scripting`.

Для поддерживаемых сайтов как web-accessible resources опубликованы `lib/*`, `content/*`, `assets/profiles/*` и `scripts/*`.

Content Security Policy разрешает только локальные scripts/workers и упакованный WASM:

```text
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self';
object-src 'self';
```

### Внешние передачи

- FEN позиции может передаваться в Lichess Cloud Eval, Masters Explorer и Syzygy.
- На Lichess peer-extension detector использует `ntfy.sh`: topic содержит короткий идентификатор комнаты, а payload - случайный instance ID, цвет, профиль, UI-ELO, состояние auto move и timestamp.
- Пользовательский внешний URL аватара может создать отдельный HTTPS-запрос.

Privacy Mask не скрывает эти обращения.

## Ограничения промежуточного апдейта

- DOM-адаптеры зависят от текущей разметки Lichess и Chess.com.
- Закрытые Shadow DOM Chess.com недоступны без публичного источника состояния.
- При открытии партии не с начальной позиции история, рокировка и en passant могут быть восстановлены не полностью.
- Chess960 и нестандартные варианты не поддерживаются.
- Full NNUE зависит от `navigator.deviceMemory`, доступной памяти и успешной загрузки WASM.
- Cloud Eval, Explorer, Syzygy и peer beacon зависят от сети и доступности внешних сервисов.
- ELO, WDL, trap chance, T1 и premove confidence не являются сертифицированными метриками.
- Script API не изолирует пользовательский код; `onFrame` пока экспериментальный.
- Формат `.chess` не имеет строгой миграции между версиями.
- Автоматических тестов, CI и сборочного pipeline в репозитории пока нет.

## Лицензии и сторонние данные

Stockfish и Stockfish.js распространяются по GPL-3.0. Источник, лицензия и контрольные суммы full NNUE assets находятся в:

- [`vendor/stockfish/COPYING.txt`](vendor/stockfish/COPYING.txt)
- [`vendor/stockfish/SOURCE.txt`](vendor/stockfish/SOURCE.txt)

ECO-данные распространяются по CC0-1.0:

- [`data/chess-openings.COPYING.txt`](data/chess-openings.COPYING.txt)

Для собственного кода проекта отдельный корневой `LICENSE` пока не добавлен. Права и атрибуцию изображений в `assets/profiles/` необходимо урегулировать до публичного стабильного релиза.
