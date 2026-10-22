(function () {
  console.log("[ChessCoach REWORK — Stable AutoMove & MAIN-World Bridge] Запущен!");

  let currentElo = 2000;
  let currentStyle = "tal"; // 'mogging', 'tal', 'kasparov', 'fischer', 'carlsen', 'solid', 'balanced'
  let showArrows = true;
  let showEvalBar = true;
  let turnMode = "my";
  let forcedMyColor = "auto";

  // === НАСТРОЙКИ АВТОХОДА ===
  let autoMoveEnabled = false;
  let autoMoveDelayMs = 450;          // Базовая задержка перед ходом (100 - 4000 мс)
  let autoMoveJitterMs = 200;         // Случайный разброс времени (0 - 2000 мс)
  let autoMoveTriggerRate = 100;      // Частота срабатывания автохода (10% - 100%)
  let useAverageMoveSometimes = true; // Разрешить иногда делать средний ход (2-ю линию)
  let averageMoveFrequency = 25;      // Частота выбора среднего хода вместо лучшего (0% - 100%)
  let protectCriticalMoves = true;    // Всегда играть лучший ход при Мате в 1 ход и спасении фигуры
  let autoClickMethod = "hybrid";     // 'hybrid' (WebSocket + Click), 'twoclick' (2 клика), 'drag' (Drag & Drop)

  // Визуальные настройки
  let uiTheme = "minimal"; // 'minimal', 'cyberpunk', 'crimson', 'gold', 'obsidian'
  let arrowStyle = "curved_neon";
  let arrowScale = 1.0;
  let arrowOpacity = 0.85;
  let roflMode = true;
  let safeAntiBanGuard = false;
  let activeTab = "analyzer";

  let committedBoardKey = "";
  let analysisRequestId = 0;
  let cachedMoves = { best: null, average: null, worst: null, boardKey: "" };
  let currentRoast = null;

  // === ЗАЩИТА ОТ ДЕРГАНИЯ СТАТУСА И ГОНКИ ТАЙМЕРОВ (STATE LOCK) ===
  let autoMoveTimer = null;
  let isExecutingMove = false;
  let moveCooldownUntil = 0;
  let currentTurnDecision = {
    boardKey: "",
    decided: false,
    skip: false,
    move: null,
    typeLabel: "",
    totalDelay: 0,
    attempts: 0
  };

  let sessionMoveHistory = [];
  let uciHistoryList = [];
  let lastSavedFenKey = "";
  let gameResultRecorded = false;

  let shadowRoot = null;

  function getShadow() {
    if (shadowRoot) return shadowRoot;
    const host = document.createElement("div");
    host.setAttribute("data-layer", "cc-rework-hud");
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "closed" });

    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes cc-liquid-wave {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes cc-pulse-flow {
        0% { stroke-dashoffset: 28; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes cc-marker-float {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-5px) scale(1.06); }
      }
      @keyframes cc-mate-ring {
        0% { r: 22; stroke-opacity: 0.95; stroke-width: 5; }
        100% { r: 62; stroke-opacity: 0; stroke-width: 1; }
      }
      @keyframes cc-mate-scream {
        0%, 100% { transform: translateY(0px) rotate(-6deg) scale(1); }
        50% { transform: translateY(-9px) rotate(6deg) scale(1.18); }
      }
      @keyframes cc-radar-spin {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
      }

      * {
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 245, 212, 0.35) transparent;
      }

      #chesscoach-panel {
        --cc-accent: #00f5d4;
        --cc-accent-2: #00bbf9;
        --cc-glow: rgba(0, 245, 212, 0.18);
        --cc-bg-glass: rgba(14, 16, 22, 0.84);
        position: fixed;
        top: 44px;
        right: 18px;
        width: 550px;
        min-height: 500px;
        max-height: 92vh;
        background: var(--cc-bg-glass);
        backdrop-filter: blur(30px) saturate(190%);
        -webkit-backdrop-filter: blur(30px) saturate(190%);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 20px;
        box-shadow:
          0 26px 64px rgba(0, 0, 0, 0.80),
          0 0 28px var(--cc-glow),
          inset 0 1px 1px rgba(255, 255, 255, 0.20);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
        z-index: 2147483646;
        user-select: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: width 0.2s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      }

      #chesscoach-panel::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: linear-gradient(90deg, #00f5d4, #00bbf9, #7b2cbf, #ff2a85, #00f5d4);
        background-size: 300% 100%;
        animation: cc-liquid-wave 6s ease infinite;
        z-index: 5;
      }

      #chesscoach-panel.theme-minimal {
        --cc-accent: #38bdf8;
        --cc-accent-2: #818cf8;
        --cc-glow: rgba(56, 189, 248, 0.12);
        --cc-bg-glass: rgba(17, 19, 25, 0.78);
      }
      #chesscoach-panel.theme-crimson {
        --cc-accent: #ff2a85;
        --cc-accent-2: #ff758f;
        --cc-glow: rgba(255, 42, 133, 0.22);
        --cc-bg-glass: rgba(22, 12, 18, 0.84);
      }
      #chesscoach-panel.theme-gold {
        --cc-accent: #ffbe0b;
        --cc-accent-2: #fb5607;
        --cc-glow: rgba(255, 190, 11, 0.20);
        --cc-bg-glass: rgba(20, 17, 12, 0.85);
      }
      #chesscoach-panel.theme-obsidian {
        --cc-accent: #f8fafc;
        --cc-accent-2: #94a3b8;
        --cc-glow: rgba(255, 255, 255, 0.08);
        --cc-bg-glass: rgba(11, 11, 13, 0.92);
      }

      #chesscoach-panel.cc-minimized {
        width: 300px;
        min-height: 46px;
        height: 46px;
      }

      #chesscoach-header {
        position: relative;
        z-index: 2;
        height: 46px;
        padding: 0 16px;
        background: rgba(9, 11, 16, 0.60);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        flex-shrink: 0;
      }
      .cc-brand {
        display: flex;
        align-items: center;
        gap: 9px;
        font-weight: 900;
        font-size: 13px;
        letter-spacing: 0.5px;
        color: #fff;
      }
      .cc-brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--cc-accent);
        box-shadow: 0 0 10px var(--cc-accent);
      }
      .cc-badge {
        background: linear-gradient(135deg, var(--cc-accent), var(--cc-accent-2));
        color: #07090e;
        font-weight: 900;
        font-size: 10.5px;
        padding: 2px 8px;
        border-radius: 6px;
      }
      .cc-deep-status {
        font-size: 10px;
        font-weight: 800;
        color: #00f5d4;
        background: rgba(0, 245, 212, 0.12);
        border: 1px solid rgba(0, 245, 212, 0.3);
        padding: 2px 7px;
        border-radius: 5px;
        display: none;
        animation: cc-radar-spin 1s ease-in-out infinite;
      }
      .cc-header-controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cc-pill-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: #e2e8f0;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 9px;
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .cc-pill-btn:hover {
        border-color: var(--cc-accent);
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
      }

      #chesscoach-workspace {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 132px 1fr;
        flex: 1;
        overflow: hidden;
      }

      .cc-sidebar {
        background: rgba(8, 10, 15, 0.52);
        border-right: 1px solid rgba(255, 255, 255, 0.07);
        padding: 12px 9px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .cc-nav-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .cc-tab-btn {
        background: transparent;
        border: 1px solid transparent;
        color: #94a3b8;
        padding: 9px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 800;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.16s ease;
      }
      .cc-tab-btn:hover {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.05);
      }
      .cc-tab-btn.active {
        color: #fff;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.03));
        border-color: rgba(255, 255, 255, 0.16);
        box-shadow: inset 3px 0 0 var(--cc-accent);
      }
      .cc-tab-icon {
        color: var(--cc-accent);
        font-size: 13px;
      }

      .cc-sidebar-footer {
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        padding-top: 9px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .cc-mini-stat {
        font-size: 10.5px;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
        padding: 0 4px;
      }
      .cc-mini-stat strong {
        color: var(--cc-accent);
      }

      .cc-main-view {
        padding: 13px 15px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .cc-tab-pane {
        display: none;
        flex-direction: column;
        gap: 9px;
        flex: 1;
      }
      .cc-tab-pane.active {
        display: flex;
      }

      #cc-enemy-turn-standby {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 20px;
        margin: 12px 0;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        gap: 10px;
      }
      .cc-standby-icon {
        font-size: 28px;
        color: var(--cc-accent);
        animation: cc-radar-spin 1.8s ease-in-out infinite;
      }
      .cc-standby-title {
        font-size: 14px;
        font-weight: 800;
        color: #f8fafc;
      }
      .cc-standby-sub {
        font-size: 12px;
        color: #94a3b8;
        max-width: 280px;
        line-height: 1.4;
      }

      #cc-mate-banner {
        display: none;
        background: linear-gradient(135deg, rgba(255, 190, 11, 0.28), rgba(255, 42, 133, 0.28));
        border: 1.5px solid #ffbe0b;
        border-radius: 12px;
        padding: 10px 12px;
        color: #fff;
        box-shadow: 0 0 24px rgba(255, 190, 11, 0.35);
      }
      .cc-mate-title {
        font-size: 13px;
        font-weight: 900;
        color: #ffbe0b;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 3px;
      }
      .cc-mate-sub {
        font-size: 12px;
        color: #fff3cd;
        font-weight: 600;
      }

      .cc-glass-card {
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 12px;
        padding: 10px 12px;
      }
      .cc-section-title {
        font-size: 11px;
        font-weight: 800;
        color: var(--cc-accent);
        margin-bottom: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .cc-move-card {
        background: rgba(20, 24, 34, 0.76);
        padding: 9px 12px;
        border-radius: 11px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-left: 4px solid #555;
        font-size: 12px;
        line-height: 1.4;
        color: #f1f5f9;
      }
      .cc-move-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 800;
        font-size: 11.5px;
        margin-bottom: 3px;
      }
      .cc-eval {
        font-family: monospace;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 1px 7px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 800;
      }

      .cc-roast-banner {
        background: linear-gradient(135deg, rgba(255, 42, 133, 0.16), rgba(0, 187, 249, 0.10));
        border: 1px solid rgba(255, 42, 133, 0.42);
        border-radius: 11px;
        padding: 8px 11px;
        font-size: 11.5px;
        line-height: 1.35;
        color: #ffe4ef;
        display: none;
      }
      .cc-roast-title {
        font-weight: 900;
        color: #ff4d94;
        font-size: 10.5px;
        margin-bottom: 2px;
        display: flex;
        justify-content: space-between;
      }

      .cc-control-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        margin-bottom: 5px;
        color: #e2e8f0;
      }
      .cc-slider {
        width: 100%;
        accent-color: var(--cc-accent);
        cursor: pointer;
        height: 5px;
      }
      .cc-select {
        width: 100%;
        background: rgba(12, 14, 20, 0.92);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        padding: 7px 9px;
        font-size: 12px;
        outline: none;
      }

      .cc-style-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .cc-style-btn {
        background: rgba(22, 26, 36, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        padding: 8px 10px;
        font-size: 11.5px;
        font-weight: 800;
        border-radius: 9px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .cc-style-btn:hover {
        color: #fff;
        background: rgba(38, 44, 60, 0.92);
      }
      .cc-style-btn.active {
        background: linear-gradient(135deg, rgba(0, 245, 212, 0.20), rgba(0, 187, 249, 0.16));
        color: #fff;
        border-color: var(--cc-accent);
        box-shadow: 0 0 12px var(--cc-glow);
      }

      .cc-Switch-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        font-size: 12px;
      }
      .cc-Switch-row:last-child {
        border-bottom: none;
      }
      .cc-Switch-row input[type="checkbox"] {
        width: 17px;
        height: 17px;
        accent-color: var(--cc-accent);
        cursor: pointer;
      }

      .cc-actions-bar {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: auto;
      }
      .cc-btn {
        background: rgba(30, 35, 48, 0.88);
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 9px;
        padding: 9px 10px;
        font-size: 11.5px;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.15s;
        text-align: center;
      }
      .cc-btn:hover {
        border-color: var(--cc-accent);
        color: #fff;
      }
      .cc-btn-primary {
        background: linear-gradient(135deg, var(--cc-accent), var(--cc-accent-2));
        color: #06080e !important;
        border: none;
        font-weight: 900;
      }
      .cc-btn-danger {
        background: rgba(255, 42, 133, 0.16);
        color: #ff4d94;
        border-color: rgba(255, 42, 133, 0.45);
      }

      .cc-auto-status-box {
        background: rgba(0, 245, 212, 0.08);
        border: 1px solid rgba(0, 245, 212, 0.28);
        border-radius: 10px;
        padding: 8px 11px;
        font-size: 11.5px;
        color: #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      #chesscoach-eval-bar {
        position: fixed;
        width: 14px;
        background: rgba(14, 16, 22, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 8px;
        overflow: hidden;
        z-index: 2147483640;
        pointer-events: none;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
      }
      #chesscoach-eval-fill {
        width: 100%;
        background: linear-gradient(180deg, #ffffff, #cbd5e1);
        transition: height 0.25s cubic-bezier(0.22, 1, 0.36, 1);
      }
      #chesscoach-eval-text {
        position: absolute;
        width: 100%;
        text-align: center;
        font-size: 9px;
        font-weight: 900;
        font-family: monospace;
        top: 4px;
        color: #00f5d4;
        text-shadow: 0 1px 2px #000;
      }
      .cc-best-flow {
        stroke-dasharray: 18 10;
        animation: cc-pulse-flow 0.75s linear infinite;
      }
    `;
    shadowRoot.appendChild(styleEl);
    return shadowRoot;
  }

  function $(id) {
    return getShadow().getElementById(id);
  }

  function saveSetting(obj) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(obj);
    }
  }

  function loadSettings() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        [
          "elo", "style", "showArrows", "showEvalBar", "uiTheme",
          "arrowStyle", "arrowScale", "arrowOpacity", "roflMode", "safeAntiBanGuard",
          "autoMoveEnabled", "autoMoveDelayMs", "autoMoveJitterMs", "autoMoveTriggerRate",
          "useAverageMoveSometimes", "averageMoveFrequency", "protectCriticalMoves", "autoClickMethod"
        ],
        (res) => {
          if (res.elo) currentElo = Number(res.elo);
          if (res.style) currentStyle = res.style;
          if (typeof res.showArrows === "boolean") showArrows = res.showArrows;
          if (typeof res.showEvalBar === "boolean") showEvalBar = res.showEvalBar;
          if (res.uiTheme) uiTheme = res.uiTheme;
          if (res.arrowStyle) arrowStyle = res.arrowStyle;
          if (res.arrowScale) arrowScale = Number(res.arrowScale);
          if (res.arrowOpacity) arrowOpacity = Number(res.arrowOpacity);
          if (typeof res.roflMode === "boolean") roflMode = res.roflMode;
          if (typeof res.safeAntiBanGuard === "boolean") safeAntiBanGuard = res.safeAntiBanGuard;

          if (typeof res.autoMoveEnabled === "boolean") autoMoveEnabled = res.autoMoveEnabled;
          if (res.autoMoveDelayMs !== undefined) autoMoveDelayMs = Number(res.autoMoveDelayMs);
          if (res.autoMoveJitterMs !== undefined) autoMoveJitterMs = Number(res.autoMoveJitterMs);
          if (res.autoMoveTriggerRate !== undefined) autoMoveTriggerRate = Number(res.autoMoveTriggerRate);
          if (typeof res.useAverageMoveSometimes === "boolean") useAverageMoveSometimes = res.useAverageMoveSometimes;
          if (res.averageMoveFrequency !== undefined) averageMoveFrequency = Number(res.averageMoveFrequency);
          if (typeof res.protectCriticalMoves === "boolean") protectCriticalMoves = res.protectCriticalMoves;
          if (res.autoClickMethod) autoClickMethod = res.autoClickMethod;

          updateUIValues();
          forceRecalculate();
        }
      );

      chrome.storage.onChanged.addListener((changes) => {
        if (changes.elo) currentElo = Number(changes.elo.newValue);
        if (changes.style) currentStyle = changes.style.newValue;
        if (changes.showArrows) showArrows = Boolean(changes.showArrows.newValue);
        if (changes.showEvalBar) showEvalBar = Boolean(changes.showEvalBar.newValue);
        if (changes.uiTheme) uiTheme = changes.uiTheme.newValue;
        if (changes.arrowStyle) arrowStyle = changes.arrowStyle.newValue;
        if (changes.arrowScale) arrowScale = Number(changes.arrowScale.newValue);
        if (changes.arrowOpacity) arrowOpacity = Number(changes.arrowOpacity.newValue);
        if (changes.roflMode) roflMode = Boolean(changes.roflMode.newValue);
        if (changes.safeAntiBanGuard) safeAntiBanGuard = Boolean(changes.safeAntiBanGuard.newValue);
        updateUIValues();
        renderArrowsOverlay(captureBoardState(true), cachedMoves);
      });
    }
  }

  function updateUIValues() {
    const panel = $("chesscoach-panel");
    if (!panel) return;

    panel.classList.remove("theme-minimal", "theme-cyberpunk", "theme-crimson", "theme-gold", "theme-obsidian");
    panel.classList.add(`theme-${uiTheme}`);

    if ($("cc-elo-slider")) $("cc-elo-slider").value = currentElo;
    if ($("cc-elo-val")) $("cc-elo-val").textContent = `${currentElo} ELO`;
    if ($("cc-elo-badge")) $("cc-elo-badge").textContent = `${currentElo} ELO`;

    const styleNames = {
      mogging: "⚡ Моггинг",
      tal: "✦ Таль",
      kasparov: "▲ Каспаров",
      fischer: "◈ Фишер",
      carlsen: "❖ Карлсен",
      solid: "🛡 Карпов",
      balanced: "⚙ Стокфиш"
    };
    if ($("cc-best-title")) {
      $("cc-best-title").textContent = `✦ ЛУЧШИЙ ХОД • ${styleNames[currentStyle] || "Таль"}`;
    }
    if ($("cc-active-style-stat")) {
      $("cc-active-style-stat").textContent = (styleNames[currentStyle] || "Таль").replace(/^[^\s]+\s/, "");
    }

    if ($("cc-color-pill")) {
      const labels = { auto: "◈ АВТО", w: "⚪ БЕЛЫЕ", b: "⚫ ЧЕРНЫЕ" };
      $("cc-color-pill").textContent = labels[forcedMyColor] || "◈ АВТО";
    }

    const autoText = autoMoveEnabled ? "🤖 АВТОХОД: ВКЛ" : "🤖 АВТОХОД: ВЫКЛ";
    if ($("cc-toggle-auto")) {
      $("cc-toggle-auto").textContent = autoText;
      $("cc-toggle-auto").style.borderColor = autoMoveEnabled ? "var(--cc-accent)" : "rgba(255,255,255,0.14)";
      $("cc-toggle-auto").style.color = autoMoveEnabled ? "var(--cc-accent)" : "#e2e8f0";
    }
    if ($("cc-auto-master-chk")) $("cc-auto-master-chk").checked = autoMoveEnabled;
    if ($("cc-auto-delay-slider")) $("cc-auto-delay-slider").value = autoMoveDelayMs;
    if ($("cc-auto-delay-val")) $("cc-auto-delay-val").textContent = `${(autoMoveDelayMs / 1000).toFixed(2)} сек`;
    if ($("cc-auto-jitter-slider")) $("cc-auto-jitter-slider").value = autoMoveJitterMs;
    if ($("cc-auto-jitter-val")) $("cc-auto-jitter-val").textContent = `±${(autoMoveJitterMs / 1000).toFixed(2)} сек`;
    if ($("cc-auto-rate-slider")) $("cc-auto-rate-slider").value = autoMoveTriggerRate;
    if ($("cc-auto-rate-val")) $("cc-auto-rate-val").textContent = `${autoMoveTriggerRate}% ходов`;

    if ($("cc-auto-avg-chk")) $("cc-auto-avg-chk").checked = useAverageMoveSometimes;
    if ($("cc-auto-avg-freq-slider")) $("cc-auto-avg-freq-slider").value = averageMoveFrequency;
    if ($("cc-auto-avg-freq-val")) $("cc-auto-avg-freq-val").textContent = `${averageMoveFrequency}%`;
    if ($("cc-auto-protect-chk")) $("cc-auto-protect-chk").checked = protectCriticalMoves;
    if ($("cc-auto-method-select")) $("cc-auto-method-select").value = autoClickMethod;

    if ($("cc-vis-theme")) $("cc-vis-theme").value = uiTheme;
    if ($("cc-vis-arrow-style")) $("cc-vis-arrow-style").value = arrowStyle;
    if ($("cc-vis-scale")) $("cc-vis-scale").value = arrowScale;
    if ($("cc-vis-scale-val")) $("cc-vis-scale-val").textContent = `${arrowScale.toFixed(1)}x`;
    if ($("cc-vis-opacity")) $("cc-vis-opacity").value = arrowOpacity;
    if ($("cc-vis-opacity-val")) $("cc-vis-opacity-val").textContent = `${Math.round(arrowOpacity * 100)}%`;
    if ($("cc-vis-arrows-chk")) $("cc-vis-arrows-chk").checked = showArrows;
    if ($("cc-vis-eval-chk")) $("cc-vis-eval-chk").checked = showEvalBar;
    if ($("cc-rage-rofl-chk")) $("cc-rage-rofl-chk").checked = roflMode;
    if ($("cc-rage-antiban-chk")) $("cc-rage-antiban-chk").checked = safeAntiBanGuard;

    getShadow().querySelectorAll(".cc-style-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === currentStyle);
    });
  }

  let lastStatusString = "";
  function setAutoStatusText(text, color = "#00f5d4") {
    if (text === lastStatusString) return; // Защита от лишних перерисовок DOM
    lastStatusString = text;
    const el = $("cc-auto-live-status");
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
  }

  function resetTurnDecision() {
    clearTimeout(autoMoveTimer);
    autoMoveTimer = null;
    currentTurnDecision = {
      boardKey: "",
      decided: false,
      skip: false,
      move: null,
      typeLabel: "",
      totalDelay: 0,
      attempts: 0
    };
  }

  function forceRecalculate() {
    committedBoardKey = "";
    resetTurnDecision();
    runCycle(true);
  }

  function switchTab(tabId) {
    activeTab = tabId;
    getShadow().querySelectorAll(".cc-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    getShadow().querySelectorAll(".cc-tab-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `cc-pane-${tabId}`);
    });
  }

  function ensurePanel() {
    if ($("chesscoach-panel")) return;

    const panel = document.createElement("div");
    panel.id = "chesscoach-panel";
    panel.innerHTML = `
      <div id="chesscoach-header">
        <div class="cc-brand">
          <span class="cc-brand-dot"></span>
          <span>CHESSCOACH // REWORK</span>
          <span class="cc-badge" id="cc-elo-badge">${currentElo} ELO</span>
          <span class="cc-deep-status" id="cc-deep-status">⚡ ДОРАСЧЕТ...</span>
        </div>
        <div class="cc-header-controls">
          <button class="cc-pill-btn" id="cc-color-pill" title="Быстрое переключение вашего цвета">◈ АВТО</button>
          <button class="cc-pill-btn" id="cc-toggle-btn" title="Свернуть/Развернуть (или клавиша INSERT)">—</button>
        </div>
      </div>

      <div id="chesscoach-workspace">
        <!-- ЛЕВОЕ МЕНЮ ВКЛАДОК -->
        <div class="cc-sidebar">
          <div class="cc-nav-list">
            <button class="cc-tab-btn active" data-tab="analyzer">
              <span class="cc-tab-icon">◈</span> АНАЛИЗ
            </button>
            <button class="cc-tab-btn" data-tab="automove">
              <span class="cc-tab-icon">🤖</span> АВТОХОД
            </button>
            <button class="cc-tab-btn" data-tab="rage">
              <span class="cc-tab-icon">⚡</span> ДВИЖОК
            </button>
            <button class="cc-tab-btn" data-tab="visuals">
              <span class="cc-tab-icon">✦</span> ВИЗУАЛ
            </button>
            <button class="cc-tab-btn" data-tab="misc">
              <span class="cc-tab-icon">❖</span> БАЗА / ОПЫТ
            </button>
          </div>

          <div class="cc-sidebar-footer">
            <div class="cc-mini-stat">
              <span>СТИЛЬ</span>
              <strong id="cc-active-style-stat">Таль</strong>
            </div>
            <div class="cc-mini-stat">
              <span>ПАМЯТЬ</span>
              <strong id="cc-memory-stat">0 ПОЗ.</strong>
            </div>
            <div class="cc-mini-stat" style="opacity:0.65;">
              <span>СКРЫТЬ</span>
              <span>[INS]</span>
            </div>
          </div>
        </div>

        <!-- ПРАВАЯ ОБЛАСТЬ КОНТЕНТА -->
        <div class="cc-main-view">

          <!-- ВКЛАДКА 1: АНАЛИЗ -->
          <div class="cc-tab-pane active" id="cc-pane-analyzer">
            <div id="cc-enemy-turn-standby">
              <div class="cc-standby-icon">⏳</div>
              <div class="cc-standby-title" id="cc-standby-title">Ход соперника...</div>
              <div class="cc-standby-sub">
                Все старые подсказки и стрелки очищены. Как только соперник сходит, стрелка появится мгновенно.
              </div>
            </div>

            <div id="cc-my-turn-active" style="display:flex; flex-direction:column; gap:8px; flex:1;">
              <div id="cc-mate-banner">
                <div class="cc-mate-title">
                  <span>👑💀 АХАХАХ! МАТ В 1 ХОД НА ДОСКЕ!</span>
                  <span style="font-size:17px;">😱😂</span>
                </div>
                <div class="cc-mate-sub" id="cc-mate-banner-text">
                  Соперник зевнул прямое фаталити! Жми «Сделать ход» и отправляй его в лобби!
                </div>
              </div>

              <div class="cc-glass-card" style="border-left: 3.5px solid var(--cc-accent);">
                <div class="cc-section-title">
                  <span id="cc-opening-name">◈ ГОТОВ К ПАРТИИ</span>
                  <span id="cc-turn-indicator" style="color:#94a3b8;">ОЖИДАНИЕ</span>
                </div>
                <div id="cc-opening-plan" style="font-size:11.5px; color:#cbd5e1; line-height:1.38;">
                  Сделайте ход на доске Lichess для мгновенного расчета.
                </div>
              </div>

              <div class="cc-roast-banner" id="cc-roast-box">
                <div class="cc-roast-title">
                  <span id="cc-roast-badge">⚡ РАДАР ОШИБОК СОПЕРНИКА</span>
                  <span>💀</span>
                </div>
                <div id="cc-roast-text">Ожидание хода соперника...</div>
              </div>

              <div class="cc-move-card" style="border-left-color:#00f5d4;">
                <div class="cc-move-header">
                  <span style="color:#00f5d4" id="cc-best-title">✦ ЛУЧШИЙ ХОД</span>
                  <span class="cc-eval" id="cc-best-eval">--</span>
                </div>
                <div id="cc-best-desc">Анализ позиции...</div>
                <div id="cc-best-pv" style="margin-top:4px; font-size:10.5px; color:var(--cc-accent); font-family:monospace; opacity:0.92;"></div>
              </div>

              <div class="cc-move-card" style="border-left-color:#ffbe0b;">
                <div class="cc-move-header">
                  <span style="color:#ffbe0b">❖ СРЕДНИЙ ХОД (2-Я ЛИНИЯ)</span>
                  <span class="cc-eval" id="cc-avg-eval">--</span>
                </div>
                <div id="cc-avg-desc">Анализ альтернативы...</div>
              </div>

              <div class="cc-move-card" style="border-left-color:#ff2a85;">
                <div class="cc-move-header">
                  <span style="color:#ff2a85">✖ ХУДШИЙ ХОД (ЗЕВОК)</span>
                  <span class="cc-eval" id="cc-worst-eval">--</span>
                </div>
                <div id="cc-worst-desc">Проверка угроз...</div>
              </div>
            </div>

            <div class="cc-actions-bar">
              <button class="cc-btn cc-btn-primary" id="cc-play-once">⚡ СДЕЛАТЬ ХОД</button>
              <button class="cc-btn" id="cc-toggle-auto">🤖 АВТОХОД: ВЫКЛ</button>
            </div>
          </div>

          <!-- ВКЛАДКА 2: ПОЛНАЯ НАСТРОЙКА АВТОХОДА -->
          <div class="cc-tab-pane" id="cc-pane-automove">
            <div class="cc-auto-status-box">
              <span>Статус бота:</span>
              <strong id="cc-auto-live-status" style="color:#00f5d4;">Готов к работе</strong>
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🤖 Включить автоматический ход</span>
                <input type="checkbox" id="cc-auto-master-chk">
              </div>

              <div class="cc-control-row" style="margin-top:8px;">
                <span>Базовая скорость / задержка хода:</span>
                <strong id="cc-auto-delay-val" style="color:var(--cc-accent);">0.45 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-delay-slider" min="100" max="4000" step="50" value="450">

              <div class="cc-control-row" style="margin-top:8px;">
                <span>Случайный разброс времени (Humanizer):</span>
                <strong id="cc-auto-jitter-val" style="color:var(--cc-accent);">±0.20 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-jitter-slider" min="0" max="2000" step="50" value="200">

              <div class="cc-control-row" style="margin-top:8px;">
                <span>Частота срабатывания автохода:</span>
                <strong id="cc-auto-rate-val" style="color:var(--cc-accent);">100% ходов</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-rate-slider" min="10" max="100" step="10" value="100">
            </div>

            <!-- Блок настройки Среднего хода -->
            <div class="cc-glass-card" style="border-left: 3.5px solid #ffbe0b;">
              <div class="cc-section-title" style="color:#ffbe0b;">
                <span>❖ ИМИТАЦИЯ ЧЕЛОВЕКА (СРЕДНИЙ ХОД)</span>
              </div>

              <div class="cc-Switch-row">
                <span>Иногда делать Средний ход (желтая стрелка)</span>
                <input type="checkbox" id="cc-auto-avg-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:8px;">
                <span>Частота (шанс) Среднего хода:</span>
                <strong id="cc-auto-avg-freq-val" style="color:#ffbe0b;">25%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-avg-freq-slider" min="0" max="100" step="5" value="25" style="accent-color:#ffbe0b;">

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Страховка: только Лучший ход при Мате в 1 и угрозах</span>
                <input type="checkbox" id="cc-auto-protect-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-control-row" style="margin-bottom:0;">
                <span>Канал отправки хода:</span>
                <select class="cc-select" id="cc-auto-method-select" style="width:225px;">
                  <option value="hybrid" selected>⚡ MAIN WebSocket + Аппаратный</option>
                  <option value="twoclick">🎯 Аппаратный 2-Клик по доске</option>
                  <option value="drag">🖐 Перетаскивание (Drag & Drop)</option>
                </select>
              </div>
            </div>

            <div class="cc-actions-bar">
              <button class="cc-btn cc-btn-primary" id="cc-auto-test-best">⚡ Сходить Лучшим</button>
              <button class="cc-btn" id="cc-auto-test-avg" style="border-color:#ffbe0b; color:#ffbe0b;">❖ Сходить Средним</button>
            </div>
          </div>

          <!-- ВКЛАДКА 3: ДВИЖОК И СТИЛИ -->
          <div class="cc-tab-pane" id="cc-pane-rage">
            <div class="cc-glass-card">
              <div class="cc-control-row">
                <span style="font-weight:800;">СИЛА ДВИЖКА (400 – 3000 ELO)</span>
                <strong id="cc-elo-val" style="color:var(--cc-accent);">${currentElo} ELO</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-elo-slider" min="400" max="3000" step="100" value="${currentElo}">
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚡ ВЫБОР СТИЛЯ ИГРЫ</span></div>
              <div class="cc-style-grid">
                <button class="cc-style-btn" data-style="mogging"><span>⚡ Моггинг</span><small>ДОМИНАЦИЯ</small></button>
                <button class="cc-style-btn active" data-style="tal"><span>✦ Михаил Таль</span><small>ЖЕРТВЫ</small></button>
                <button class="cc-style-btn" data-style="kasparov"><span>▲ Каспаров</span><small>АТАКА</small></button>
                <button class="cc-style-btn" data-style="fischer"><span>◈ Фишер</span><small>ТОЧНОСТЬ</small></button>
                <button class="cc-style-btn" data-style="carlsen"><span>❖ Карлсен</span><small>ТЕХНИКА</small></button>
                <button class="cc-style-btn" data-style="solid"><span>🛡 Карпов</span><small>ЗАЖИМ</small></button>
                <button class="cc-style-btn" data-style="balanced" style="grid-column: span 2;">
                  <span>⚙ Stockfish 3000 Cloud</span><small>МАКСИМУМ</small>
                </button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚙ РЕЖИМ РАБОТЫ</span></div>
              <div class="cc-control-row" style="margin-bottom:8px;">
                <span>Когда считать:</span>
                <select class="cc-select" id="cc-turn-select" style="width:200px;">
                  <option value="my" selected>Только в мой ход (чисто)</option>
                  <option value="auto">Всегда (и за соперника)</option>
                  <option value="w">Всегда за Белых</option>
                  <option value="b">Всегда за Черных</option>
                </select>
              </div>
              <div class="cc-Switch-row">
                <span>⚡ Радар зевков соперника и спецэффекты мата</span>
                <input type="checkbox" id="cc-rage-rofl-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>🛡 Блокировать Автоход в Rated-играх</span>
                <input type="checkbox" id="cc-rage-antiban-chk">
              </div>
            </div>
          </div>

          <!-- ВКЛАДКА 4: ВИЗУАЛ И СТРЕЛКИ -->
          <div class="cc-tab-pane" id="cc-pane-visuals">
            <div class="cc-glass-card">
              <div class="cc-section-title"><span>✦ СТИЛЬ МЕНЮ (LIQUID GLASS)</span></div>
              <select class="cc-select" id="cc-vis-theme">
                <option value="minimal">⚪ Pure Minimal (Чистый минимализм)</option>
                <option value="cyberpunk">🌌 Liquid Cyan Wave (Неоновая волна)</option>
                <option value="crimson">🔥 Crimson Rose (Агрессивный рубин)</option>
                <option value="gold">👑 Royal Gold (Королевское золото)</option>
                <option value="obsidian">🌑 Obsidian Stealth (Темный обсидиан)</option>
              </select>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>◈ КАСТОМИЗАЦИЯ СТРЕЛОК НА ДОСКЕ</span></div>
              <div class="cc-control-row" style="margin-bottom:8px;">
                <span>Форма стрелок:</span>
                <select class="cc-select" id="cc-vis-arrow-style" style="width:200px;">
                  <option value="curved_neon">🌈 Плавная дуга с потоком</option>
                  <option value="laser">⚡ Прямой кибер-лазер</option>
                  <option value="classic">♟️ Классическая прямая</option>
                  <option value="dotted">✨ Тактический пунктир</option>
                </select>
              </div>

              <div class="cc-control-row">
                <span>Толщина стрелок:</span>
                <strong id="cc-vis-scale-val" style="color:var(--cc-accent);">1.0x</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-vis-scale" min="0.6" max="1.6" step="0.1" value="1.0">

              <div class="cc-control-row" style="margin-top:8px;">
                <span>Яркость / Прозрачность:</span>
                <strong id="cc-vis-opacity-val" style="color:var(--cc-accent);">85%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-vis-opacity" min="0.3" max="1.0" step="0.05" value="0.85">
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row">
                <span>Показывать стрелки и значки на доске</span>
                <input type="checkbox" id="cc-vis-arrows-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Боковая шкала оценки (Eval Bar)</span>
                <input type="checkbox" id="cc-vis-eval-chk" checked>
              </div>
            </div>
          </div>

          <!-- ВКЛАДКА 5: БАЗА ОПЫТА -->
          <div class="cc-tab-pane" id="cc-pane-misc">
            <div class="cc-glass-card">
              <div class="cc-section-title"><span>❖ РУЧНОЕ ОБУЧЕНИЕ БОТА</span></div>
              <div style="font-size:11.5px; color:#cbd5e1; margin-bottom:9px; line-height:1.4;">
                Закрепите лучший ход как любимый шаблон или забаньте его, чтобы движок сразу нашел другой вариант:
              </div>
              <div class="cc-actions-bar">
                <button class="cc-btn" id="cc-train-good">👍 ЗАКРЕПИТЬ ХОД</button>
                <button class="cc-btn cc-btn-danger" id="cc-train-bad">👎 ЗАБАНИТЬ ХОД</button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>◈ БАЗА САМООБУЧЕНИЯ</span></div>
              <div id="cc-misc-db-summary" style="font-size:12px; color:#e2e8f0; margin-bottom:9px;">
                Выучено позиций в памяти: 0
              </div>
              <div class="cc-actions-bar">
                <button class="cc-btn" id="cc-export-db">📥 СКАЧАТЬ БАЗУ</button>
                <button class="cc-btn cc-btn-danger" id="cc-clear-db">🗑 ОЧИСТИТЬ ПАМЯТЬ</button>
              </div>
            </div>

            <div class="cc-glass-card">
              <button class="cc-btn" id="cc-open-studio-btn" style="width:100%;">
                ✦ Открыть полноэкранную Студию в отдельной вкладке
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    getShadow().appendChild(panel);
    updateUIValues();

    const header = $("chesscoach-header");
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      ox = e.clientX - panel.offsetLeft;
      oy = e.clientY - panel.offsetTop;
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = `${e.clientX - ox}px`;
      panel.style.top = `${e.clientY - oy}px`;
      panel.style.right = "auto";
    });
    window.addEventListener("mouseup", () => { dragging = false; });

    getShadow().querySelectorAll(".cc-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    let min = false;
    $("cc-toggle-btn").addEventListener("click", () => {
      min = !min;
      panel.classList.toggle("cc-minimized", min);
      $("chesscoach-workspace").style.display = min ? "none" : "grid";
      $("cc-toggle-btn").textContent = min ? "▢" : "—";
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Insert") {
        panel.style.display = panel.style.display === "none" ? "flex" : "none";
      }
    });

    $("cc-color-pill").addEventListener("click", () => {
      if (forcedMyColor === "auto") forcedMyColor = "w";
      else if (forcedMyColor === "w") forcedMyColor = "b";
      else forcedMyColor = "auto";
      updateUIValues();
      forceRecalculate();
    });

    // === ОБРАБОТЧИКИ ВКЛАДКИ АВТОХОД ===
    const toggleAutoMoveMaster = (newState) => {
      autoMoveEnabled = newState;
      saveSetting({ autoMoveEnabled });
      updateUIValues();
      resetTurnDecision();
      if (autoMoveEnabled) {
        setAutoStatusText("Автоход включен — анализ позиции...", "#00f5d4");
        scheduleAutoMoveIfNeeded();
      } else {
        setAutoStatusText("Автоход выключен", "#94a3b8");
      }
    };

    $("cc-toggle-auto").addEventListener("click", () => toggleAutoMoveMaster(!autoMoveEnabled));
    $("cc-auto-master-chk").addEventListener("change", (e) => toggleAutoMoveMaster(e.target.checked));

    $("cc-auto-delay-slider").addEventListener("input", (e) => {
      autoMoveDelayMs = Number(e.target.value);
      updateUIValues();
      saveSetting({ autoMoveDelayMs });
    });

    $("cc-auto-jitter-slider").addEventListener("input", (e) => {
      autoMoveJitterMs = Number(e.target.value);
      updateUIValues();
      saveSetting({ autoMoveJitterMs });
    });

    $("cc-auto-rate-slider").addEventListener("input", (e) => {
      autoMoveTriggerRate = Number(e.target.value);
      updateUIValues();
      saveSetting({ autoMoveTriggerRate });
    });

    $("cc-auto-avg-chk").addEventListener("change", (e) => {
      useAverageMoveSometimes = e.target.checked;
      saveSetting({ useAverageMoveSometimes });
    });

    $("cc-auto-avg-freq-slider").addEventListener("input", (e) => {
      averageMoveFrequency = Number(e.target.value);
      updateUIValues();
      saveSetting({ averageMoveFrequency });
    });

    $("cc-auto-protect-chk").addEventListener("change", (e) => {
      protectCriticalMoves = e.target.checked;
      saveSetting({ protectCriticalMoves });
    });

    $("cc-auto-method-select").addEventListener("change", (e) => {
      autoClickMethod = e.target.value;
      saveSetting({ autoClickMethod });
    });

    $("cc-play-once").addEventListener("click", () => {
      const state = captureBoardState(true);
      if (state && cachedMoves.best) {
        setAutoStatusText(`Выполняем ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true);
      }
    });

    $("cc-auto-test-best").addEventListener("click", () => {
      const state = captureBoardState(true);
      if (state && cachedMoves.best) {
        setAutoStatusText(`Лучший ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true);
      }
    });

    $("cc-auto-test-avg").addEventListener("click", () => {
      const state = captureBoardState(true);
      const move = cachedMoves.average || cachedMoves.best;
      if (state && move) {
        setAutoStatusText(`Средний ход: ${move.from}→${move.to}`, "#ffbe0b");
        executeMoveOnBoard(move, state, true);
      }
    });

    // === ОБРАБОТЧИКИ ДВИЖКА И ВИЗУАЛА ===
    const slider = $("cc-elo-slider");
    slider.addEventListener("input", (e) => {
      currentElo = Number(e.target.value);
      updateUIValues();
    });
    slider.addEventListener("change", (e) => {
      currentElo = Number(e.target.value);
      saveSetting({ elo: currentElo });
      forceRecalculate();
    });

    getShadow().querySelectorAll(".cc-style-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentStyle = btn.dataset.style;
        saveSetting({ style: currentStyle });
        updateUIValues();
        forceRecalculate();
      });
    });

    $("cc-turn-select").addEventListener("change", (e) => {
      turnMode = e.target.value;
      forceRecalculate();
    });

    $("cc-rage-rofl-chk").addEventListener("change", (e) => {
      roflMode = e.target.checked;
      saveSetting({ roflMode });
      forceRecalculate();
    });

    $("cc-rage-antiban-chk").addEventListener("change", (e) => {
      safeAntiBanGuard = e.target.checked;
      saveSetting({ safeAntiBanGuard });
    });

    $("cc-vis-theme").addEventListener("change", (e) => {
      uiTheme = e.target.value;
      saveSetting({ uiTheme });
      updateUIValues();
    });

    $("cc-vis-arrow-style").addEventListener("change", (e) => {
      arrowStyle = e.target.value;
      saveSetting({ arrowStyle });
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
    });

    $("cc-vis-scale").addEventListener("input", (e) => {
      arrowScale = Number(e.target.value);
      updateUIValues();
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
      saveSetting({ arrowScale });
    });

    $("cc-vis-opacity").addEventListener("input", (e) => {
      arrowOpacity = Number(e.target.value);
      updateUIValues();
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
      saveSetting({ arrowOpacity });
    });

    $("cc-vis-arrows-chk").addEventListener("change", (e) => {
      showArrows = e.target.checked;
      saveSetting({ showArrows });
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
    });

    $("cc-vis-eval-chk").addEventListener("change", (e) => {
      showEvalBar = e.target.checked;
      saveSetting({ showEvalBar });
      const st = captureBoardState(true);
      renderEvalBar(st, cachedMoves.best?.whitePerspectiveEval || 0);
    });

    $("cc-train-good").addEventListener("click", () => {
      if (!cachedMoves.best || !cachedMoves.boardKey) return;
      chrome.runtime.sendMessage(
        { type: "TRAIN_MOVE_MANUAL", fenKey: cachedMoves.boardKey, uci: cachedMoves.best.uci, delta: 95 },
        (res) => {
          const btn = $("cc-train-good");
          btn.textContent = "✦ ЗАКРЕПЛЕНО!";
          setTimeout(() => { btn.textContent = "👍 ЗАКРЕПИТЬ ХОД"; }, 800);
          if (res && res.positionsCount !== undefined) {
            $("cc-memory-stat").textContent = `${res.positionsCount} ПОЗ.`;
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          forceRecalculate();
        }
      );
    });

    $("cc-train-bad").addEventListener("click", () => {
      if (!cachedMoves.best || !cachedMoves.boardKey) return;
      chrome.runtime.sendMessage(
        { type: "TRAIN_MOVE_MANUAL", fenKey: cachedMoves.boardKey, uci: cachedMoves.best.uci, delta: -210 },
        (res) => {
          const btn = $("cc-train-bad");
          btn.textContent = "✖ ЗАБАНЕНО!";
          setTimeout(() => { btn.textContent = "👎 ЗАБАНИТЬ ХОД"; }, 800);
          if (res && res.positionsCount !== undefined) {
            $("cc-memory-stat").textContent = `${res.positionsCount} ПОЗ.`;
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          forceRecalculate();
        }
      );
    });

    $("cc-export-db").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
        const blob = new Blob([JSON.stringify(res?.experienceDB || {}, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chesscoach-rework-db-${Date.now()}.json`;
        a.click();
      });
    });

    $("cc-clear-db").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLEAR_MEMORY" }, () => {
        $("cc-memory-stat").textContent = "0 ПОЗ.";
        $("cc-misc-db-summary").textContent = "Выучено позиций в памяти: 0";
      });
    });

    $("cc-open-studio-btn").addEventListener("click", () => {
      if (chrome?.runtime?.getURL) {
        window.open(chrome.runtime.getURL("options/options.html"), "_blank");
      }
    });
  }

  function isRatedGameAgainstHuman() {
    const metaText = (document.querySelector(".game__meta")?.innerText || "");
    const isRated = metaText.includes("Rated") || metaText.includes("Рейтинговая");
    const isBot = metaText.includes("Stockfish") || metaText.includes("BOT") || metaText.includes("АИ");
    return isRated && !isBot;
  }

  function chooseAutoMoveOnce(res) {
    if (!res || !res.best) return null;

    if (protectCriticalMoves) {
      if (res.best.isMateInOne || res.best.isCheckmate || res.best.savedHangingPiece || res.hangingSquare) {
        return { move: res.best, typeLabel: "ЛУЧШИЙ (ЗАЩИТА/МАТ)" };
      }
    }

    if (useAverageMoveSometimes && res.average && res.average.uci !== res.best.uci) {
      const roll = Math.random() * 100;
      if (roll < averageMoveFrequency) {
        return { move: res.average, typeLabel: "СРЕДНИЙ (2-Я ЛИНИЯ)" };
      }
    }

    return { move: res.best, typeLabel: "ЛУЧШИЙ" };
  }

  // СТАБИЛЬНЫЙ ПЛАНИРОВЩИК АВТОХОДА БЕЗ МИГАНИЯ И ГОНКИ СОБЫТИЙ
  function scheduleAutoMoveIfNeeded() {
    if (!autoMoveEnabled) return;
    if (isExecutingMove || Date.now() < moveCooldownUntil) return;
    if (autoMoveTimer) return;

    const state = captureBoardState(false);
    if (!state || state.animating) return;
    if (state.actualTurn !== state.myColor) return;
    if (!cachedMoves || !cachedMoves.best || cachedMoves.boardKey !== state.boardKey) return;

    // Принимаем решение (пропуск / лучший / средний / задержка) СТРОГО ОДИН РАЗ на позицию!
    if (currentTurnDecision.boardKey !== state.boardKey || !currentTurnDecision.decided) {
      const triggerRoll = Math.random() * 100;
      if (autoMoveTriggerRate < 100 && triggerRoll > autoMoveTriggerRate) {
        currentTurnDecision = {
          boardKey: state.boardKey,
          decided: true,
          skip: true,
          move: null,
          typeLabel: "ПРОПУСК",
          totalDelay: 0,
          attempts: 0
        };
        setAutoStatusText(`Пропуск хода по шансу (${autoMoveTriggerRate}%) — ваш ход`, "#ffbe0b");
        return;
      }

      const picked = chooseAutoMoveOnce(cachedMoves);
      if (!picked || !picked.move) return;

      const jitter = autoMoveJitterMs > 0 ? Math.round((Math.random() * 2 - 1) * autoMoveJitterMs) : 0;
      const totalDelay = Math.max(80, autoMoveDelayMs + jitter);

      currentTurnDecision = {
        boardKey: state.boardKey,
        decided: true,
        skip: false,
        move: picked.move,
        typeLabel: picked.typeLabel,
        totalDelay,
        attempts: 0
      };
    }

    if (currentTurnDecision.skip) return;
    if (currentTurnDecision.attempts >= 3) {
      setAutoStatusText("Не удалось кликнуть по доске — сделайте ход вручную", "#ff2a85");
      return;
    }

    const mv = currentTurnDecision.move;
    const isAvg = currentTurnDecision.typeLabel.startsWith("СРЕДНИЙ");
    const delayToWait = currentTurnDecision.attempts === 0 ? currentTurnDecision.totalDelay : 750;

    setAutoStatusText(
      `Ход через ${(delayToWait / 1000).toFixed(2)}с: ${mv.from}→${mv.to} [${currentTurnDecision.typeLabel}]`,
      isAvg ? "#ffbe0b" : "#00f5d4"
    );

    const expectedBoardKey = state.boardKey;

    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (!autoMoveEnabled) return;

      const fresh = captureBoardState(true);
      if (!fresh || fresh.actualTurn !== fresh.myColor || fresh.boardKey !== expectedBoardKey) {
        return;
      }

      currentTurnDecision.attempts++;
      const moveNow = currentTurnDecision.move || cachedMoves.best;
      if (!moveNow) return;

      executeMoveOnBoard(moveNow, fresh, false);
    }, delayToWait);
  }

  // ТРОЙНОЙ ПРОБИВНОЙ МЕХАНИЗМ ХОДА (1. MAIN-World WebSocket -> 2. Chrome Debugger -> 3. Чистый DOM)
  function executeMoveOnBoard(moveObj, state, manualClick = false) {
    if (!moveObj || !moveObj.from || !moveObj.to || !state) return;

    if (!manualClick && safeAntiBanGuard && isRatedGameAgainstHuman()) {
      setAutoStatusText("Блок Анти-Бана в Rated игре!", "#ff2a85");
      return;
    }

    const fromSq = moveObj.from;
    const toSq = moveObj.to;
    const isPromotion =
      moveObj.piece === "p" && (toSq[1] === "8" || toSq[1] === "1");

    isExecutingMove = true;
    moveCooldownUntil = Date.now() + 850;
    const beforeKey = state.boardKey;

    setAutoStatusText(`Отправка хода: ${fromSq} → ${toSq}...`, "#00f5d4");

    // 1. КОНТУР 1: Отправляем ход через MAIN-World WebSocket (работает даже когда вкладка свернута!)
    if (autoClickMethod === "hybrid") {
      window.postMessage(
        {
          source: "CC_REWORK_CONTENT",
          type: "CC_EXECUTE_MAIN_MOVE",
          from: fromSq,
          to: toSq,
          isPromotion
        },
        "*"
      );
    }

    // 2. КОНТУР 2 и 3: Если вкладка видима или WebSocket не сработал за 120 мс — бьем аппаратным кликом + DOM!
    setTimeout(() => {
      const checkAfterWs = captureBoardState(true);
      if (checkAfterWs && checkAfterWs.boardKey !== beforeKey) {
        isExecutingMove = false;
        setAutoStatusText(`Сделан ход (WS): ${fromSq} → ${toSq}`, "#00f5d4");
        return;
      }

      const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
      if (!cgBoard) {
        isExecutingMove = false;
        return;
      }

      const r = cgBoard.getBoundingClientRect();
      if (r.width < 50) {
        isExecutingMove = false;
        return;
      }

      const isBlack = state.isBlackOrientation;
      const sqToClientCoords = (sq) => {
        const file = "abcdefgh".indexOf(sq[0]);
        const rank = parseInt(sq[1], 10) - 1;
        const col = isBlack ? 7 - file : file;
        const row = isBlack ? rank : 7 - rank;
        return {
          x: Math.round(r.left + (col + 0.5) * (r.width / 8)),
          y: Math.round(r.top + (row + 0.5) * (r.height / 8))
        };
      };

      const p1 = sqToClientCoords(fromSq);
      const p2 = sqToClientCoords(toSq);

      // Пробуем аппаратный клик через Chrome Debugger API в background.js
      chrome.runtime.sendMessage(
        {
          type: "NATIVE_CLICK_MOVE",
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          isPromo: isPromotion,
          method: autoClickMethod
        },
        (resp) => {
          if (resp && resp.ok) {
            setTimeout(() => {
              isExecutingMove = false;
              setAutoStatusText(`Сделан ход: ${fromSq} → ${toSq}`, "#00f5d4");
            }, 180);
            return;
          }

          // КОНТУР 3: Чистый DOM MouseEvent (БЕЗ конфликта PointerEvent + MouseEvent!)
          performCleanDomMove(cgBoard, p1, p2, isPromotion, () => {
            isExecutingMove = false;
            setAutoStatusText(`Сделан ход: ${fromSq} → ${toSq}`, "#00f5d4");
          });
        }
      );
    }, autoClickMethod === "hybrid" ? 110 : 10);
  }

  // Чистый DOM-клик без двойного срабатывания PointerEvent + MouseEvent
  function performCleanDomMove(cgBoard, p1, p2, isPromotion, onDone) {
    const fireMouse = (target, type, x, y, buttons) => {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
          button: 0,
          buttons: buttons
        })
      );
    };

    // Нажимаем на исходную клетку
    fireMouse(cgBoard, "mousedown", p1.x, p1.y, 1);

    setTimeout(() => {
      if (autoClickMethod === "drag") {
        fireMouse(document, "mousemove", Math.round((p1.x + p2.x) / 2), Math.round((p1.y + p2.y) / 2), 1);
        fireMouse(document, "mousemove", p2.x, p2.y, 1);
        setTimeout(() => {
          fireMouse(document, "mouseup", p2.x, p2.y, 0);
          fireMouse(cgBoard, "mouseup", p2.x, p2.y, 0);
          if (onDone) onDone();
        }, 40);
      } else {
        // Режим двух кликов: отпускаем на первой клетке и кликаем по второй
        fireMouse(cgBoard, "mouseup", p1.x, p1.y, 0);
        setTimeout(() => {
          fireMouse(cgBoard, "mousedown", p2.x, p2.y, 1);
          setTimeout(() => {
            fireMouse(cgBoard, "mouseup", p2.x, p2.y, 0);
            fireMouse(document, "mouseup", p2.x, p2.y, 0);

            if (isPromotion) {
              setTimeout(() => {
                const promoQueen = document.querySelector("#promotion-choice square, #promotion-choice piece.queen");
                if (promoQueen) {
                  fireMouse(promoQueen, "mousedown", p2.x, p2.y, 1);
                  fireMouse(promoQueen, "mouseup", p2.x, p2.y, 0);
                  promoQueen.click();
                }
              }, 90);
            }
            if (onDone) onDone();
          }, 35);
        }, 50);
      }
    }, 35);
  }

  function detectBlackOrientation(cgBoard, boardRect) {
    if (forcedMyColor === "b") return true;
    if (forcedMyColor === "w") return false;

    const wrap = cgBoard.closest(".cg-wrap");
    if (wrap) {
      if (wrap.classList.contains("orientation-black")) return true;
      if (wrap.classList.contains("orientation-white")) return false;
      if (wrap.querySelector("coords.ranks.black")) return true;
    }

    let whiteSumY = 0, whiteCount = 0;
    let blackSumY = 0, blackCount = 0;
    cgBoard.querySelectorAll("piece").forEach((p) => {
      if (p.classList.contains("ghost")) return;
      const pr = p.getBoundingClientRect();
      if (pr.width === 0) return;
      const cy = pr.top + pr.height / 2 - boardRect.top;
      if (p.classList.contains("white")) { whiteSumY += cy; whiteCount++; }
      else if (p.classList.contains("black")) { blackSumY += cy; blackCount++; }
    });

    if (whiteCount > 0 && blackCount > 0) {
      return (whiteSumY / whiteCount) < (blackSumY / blackCount);
    }
    return false;
  }

  // ТОЧНЫЙ МНОГОУРОВНЕВЫЙ ДЕТЕКТОР ОЧЕРЕДИ ХОДА НА LICHESS
  function detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation) {
    const myColor = isBlackOrientation ? "b" : "w";
    const enemyColor = myColor === "w" ? "b" : "w";

    // Уровень 1: По списку сделанных полуходов в панели нотации Lichess (самый точный источник!)
    const moveNodes = document.querySelectorAll("l4x kwdb, rm6 kwdb, .tview2 move");
    if (moveNodes.length > 0) {
      return moveNodes.length % 2 === 0 ? "w" : "b";
    }

    // Уровень 2: По активным часам игроков
    if (document.querySelector(".rclock-bottom.rclock-turn, .rclock-bottom.running")) return myColor;
    if (document.querySelector(".rclock-top.rclock-turn, .rclock-top.running")) return enemyColor;

    // Уровень 3: По клеткам последнего хода square.last-move (для доски анализа и старта игры)
    const cellW = boardRect.width / 8;
    const cellH = boardRect.height / 8;
    const lastMoveSquares = cgBoard.querySelectorAll("square.last-move");

    for (const sq of lastMoveSquares) {
      if (sq.classList.contains("current-premove") || sq.classList.contains("selected")) continue;
      const sqRect = sq.getBoundingClientRect();
      if (sqRect.width === 0) continue;
      const cx = sqRect.left + sqRect.width / 2 - boardRect.left;
      const cy = sqRect.top + sqRect.height / 2 - boardRect.top;
      const vCol = Math.floor(cx / cellW);
      const vRow = Math.floor(cy / cellH);
      if (vCol < 0 || vCol > 7 || vRow < 0 || vRow > 7) continue;

      const r = isBlackOrientation ? 7 - vRow : vRow;
      const c = isBlackOrientation ? 7 - vCol : vCol;
      const pieceOnLastMove = grid[r][c];

      if (pieceOnLastMove) {
        const movedColor = pieceOnLastMove === pieceOnLastMove.toUpperCase() ? "w" : "b";
        return movedColor === "w" ? "b" : "w";
      }
    }

    return "w";
  }

  function captureBoardState(ignoreAnim = false) {
    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (!cgBoard) return null;

    if (!ignoreAnim && !isExecutingMove && cgBoard.querySelector("piece.anim, piece.dragging")) {
      return { animating: true };
    }

    const boardRect = cgBoard.getBoundingClientRect();
    if (boardRect.width < 50 || boardRect.height < 50) return null;

    const isBlackOrientation = detectBlackOrientation(cgBoard, boardRect);
    const myColor = isBlackOrientation ? "b" : "w";

    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    const pieceMap = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

    const cellW = boardRect.width / 8;
    const cellH = boardRect.height / 8;

    const pieces = cgBoard.querySelectorAll("piece");
    pieces.forEach((p) => {
      if (p.classList.contains("ghost")) return;
      const pRect = p.getBoundingClientRect();
      if (pRect.width === 0) return;

      const centerX = pRect.left + pRect.width / 2 - boardRect.left;
      const centerY = pRect.top + pRect.height / 2 - boardRect.top;

      const visualCol = Math.floor(centerX / cellW);
      const visualRow = Math.floor(centerY / cellH);

      if (visualCol < 0 || visualCol > 7 || visualRow < 0 || visualRow > 7) return;

      const row = isBlackOrientation ? 7 - visualRow : visualRow;
      const col = isBlackOrientation ? 7 - visualCol : visualCol;

      const isWhite = p.classList.contains("white");
      let symbol = "p";
      for (const [cls, sym] of Object.entries(pieceMap)) {
        if (p.classList.contains(cls)) {
          symbol = sym;
          break;
        }
      }
      grid[row][col] = isWhite ? symbol.toUpperCase() : symbol;
    });

    const fenRows = grid.map((r) => {
      let s = "", empty = 0;
      for (const c of r) {
        if (!c) empty++;
        else {
          if (empty > 0) { s += empty; empty = 0; }
          s += c;
        }
      }
      if (empty > 0) s += empty;
      return s;
    });

    const actualTurn = detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation);

    let sideToAnalyze = actualTurn;
    if (turnMode === "w") sideToAnalyze = "w";
    else if (turnMode === "b") sideToAnalyze = "b";

    const boardPart = fenRows.join("/");
    return {
      animating: false,
      fen: `${boardPart} ${sideToAnalyze} KQkq - 0 1`,
      boardKey: `${boardPart} ${sideToAnalyze}`,
      boardRect,
      isBlackOrientation,
      myColor,
      actualTurn,
      sideToAnalyze
    };
  }

  function renderEvalBar(state, whiteEvalPawns) {
    let bar = $("chesscoach-eval-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "chesscoach-eval-bar";
      bar.innerHTML = `
        <div id="chesscoach-eval-fill"></div>
        <div id="chesscoach-eval-text">0.0</div>
      `;
      getShadow().appendChild(bar);
    }

    if (!showEvalBar || !state || !state.boardRect) {
      bar.style.display = "none";
      return;
    }

    const r = state.boardRect;
    bar.style.display = "block";
    bar.style.left = `${Math.max(4, r.left - 20)}px`;
    bar.style.top = `${r.top}px`;
    bar.style.height = `${r.height}px`;

    const evalNum = parseFloat(whiteEvalPawns) || 0;
    const clamped = Math.max(-10, Math.min(10, evalNum));
    const whitePercent = 50 + (clamped / 10) * 45;
    const fill = $("chesscoach-eval-fill");
    const txt = $("chesscoach-eval-text");

    if (fill) fill.style.height = `${whitePercent}%`;
    if (txt) txt.textContent = `${evalNum > 0 ? "+" : ""}${evalNum.toFixed(1)}`;
  }

  function hideArrows() {
    const svg = $("chesscoach-screen-svg");
    if (svg) svg.style.display = "none";
  }

  function renderArrowsOverlay(state, res) {
    let svg = $("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      getShadow().appendChild(svg);
    }

    if (!showArrows || !state || !state.boardRect || !res || !res.best) {
      svg.style.display = "none";
      return;
    }

    if (turnMode === "my" && state.actualTurn !== state.myColor) {
      svg.style.display = "none";
      return;
    }

    const { best, average, worst, hangingSquare, lastOpponentMove, enemyKingSquare } = res;
    const r = state.boardRect;
    svg.style.display = "block";
    svg.style.position = "fixed";
    svg.style.left = `${r.left}px`;
    svg.style.top = `${r.top}px`;
    svg.style.width = `${r.width}px`;
    svg.style.height = `${r.height}px`;
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "2147483645";

    const isBlack = state.isBlackOrientation;
    const sqToXY = (sq) => {
      const file = "abcdefgh".indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return { x: col * 100 + 50, y: row * 100 + 50 };
    };

    const drawCustomArrow = (m, gradId, glowColor, markerId, curveOffset, baseOp, isBest = false) => {
      if (!m || !m.from || !m.to) return "";
      const p1 = sqToXY(m.from);
      const p2 = sqToXY(m.to);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;
      const tx = p2.x - (dx / len) * 24;
      const ty = p2.y - (dy / len) * 24;

      const actualCurve = (arrowStyle === "curved_neon") ? curveOffset : 0;
      const cx = (p1.x + tx) / 2 + nx * actualCurve;
      const cy = (p1.y + ty) / 2 + ny * actualCurve;
      const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;

      const width = (isBest ? 14 : 10.5) * arrowScale;
      const op = Math.min(1, baseOp * (arrowOpacity / 0.85));
      const dashAttr = arrowStyle === "dotted" ? `stroke-dasharray="14 10"` : "";
      const glowFilter = arrowStyle === "classic" ? "" : `style="filter: drop-shadow(0 0 9px ${glowColor});"`;

      return `
        <circle cx="${p1.x}" cy="${p1.y}" r="${10 * arrowScale}" fill="${glowColor}" fill-opacity="${op * 0.7}" />
        <circle cx="${p2.x}" cy="${p2.y}" r="${34 * arrowScale}" fill="none" stroke="${glowColor}" stroke-width="${3.2 * arrowScale}" stroke-opacity="${op * 0.82}" />
        <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width}"
              stroke-linecap="round" stroke-opacity="${op}" ${dashAttr} ${glowFilter}
              marker-end="url(#${markerId})" />
        ${isBest && arrowStyle !== "classic" ? `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${3.5 * arrowScale}" stroke-linecap="round" stroke-opacity="0.6" class="cc-best-flow" />` : ""}
      `;
    };

    const drawHudMarkerOnSquare = (sq, symbol, borderColor, isLeft = false) => {
      if (!sq) return "";
      const p = sqToXY(sq);
      const bx = isLeft ? p.x - 28 : p.x + 28;
      const by = p.y - 28;
      return `
        <g style="animation: cc-marker-float 1.5s ease-in-out infinite;">
          <rect x="${bx - 16}" y="${by - 16}" width="32" height="32" rx="8"
                fill="rgba(10, 12, 18, 0.94)" stroke="${borderColor}" stroke-width="2.5" />
          <text x="${bx}" y="${by + 6}" text-anchor="middle" fill="${borderColor}"
                font-family="monospace" font-weight="900" font-size="18">${symbol}</text>
        </g>
      `;
    };

    const drawMateInOneSpectacle = (mateSq, kingSq) => {
      const pm = sqToXY(mateSq);
      const pk = kingSq ? sqToXY(kingSq) : pm;
      const bannerY = Math.max(45, pk.y - 52);
      const bannerX = Math.max(115, Math.min(685, pk.x));

      return `
        <circle cx="${pm.x}" cy="${pm.y}" r="26" fill="none" stroke="#ffbe0b" style="animation: cc-mate-ring 1.1s ease-out infinite;" />
        <circle cx="${pk.x}" cy="${pk.y}" r="26" fill="none" stroke="#ff2a85" style="animation: cc-mate-ring 1.1s ease-out 0.35s infinite;" />
        <g style="animation: cc-mate-scream 0.85s ease-in-out infinite; transform-origin: ${pk.x}px ${pk.y}px;">
          <text x="${pk.x - 36}" y="${pk.y + 36}" text-anchor="middle" font-size="30">😱</text>
          <text x="${pk.x + 36}" y="${pk.y + 36}" text-anchor="middle" font-size="30">😂</text>
          <text x="${pm.x + 32}" y="${pm.y - 26}" text-anchor="middle" font-size="32">👑</text>
        </g>
        <g style="animation: cc-marker-float 1s ease-in-out infinite;">
          <rect x="${bannerX - 108}" y="${bannerY - 22}" width="216" height="36" rx="10"
                fill="rgba(16, 12, 20, 0.96)" stroke="#ffbe0b" stroke-width="3"
                style="filter: drop-shadow(0 0 14px rgba(255, 190, 11, 0.7));" />
          <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#ffbe0b"
                font-family="-apple-system, sans-serif" font-weight="900" font-size="16">
            💀 МАТ В 1 ХОД! 😂
          </text>
        </g>
      `;
    };

    const avgCurve = (best && average && best.from === average.from) ? 42 : 16;
    const worstCurve = (best && worst && best.from === worst.from) ? -42 : -16;

    let markersHTML = "";
    if (best.isMateInOne) {
      markersHTML += drawMateInOneSpectacle(best.to, enemyKingSquare);
    } else {
      if (hangingSquare) markersHTML += drawHudMarkerOnSquare(hangingSquare, "!", "#ff2a85");
      if (best && best.isSacrifice) markersHTML += drawHudMarkerOnSquare(best.to, "⚡", "#ff4d94");
      else if (best && best.isFork) markersHTML += drawHudMarkerOnSquare(best.to, "⚔", "#00f5d4");
      else if (best && best.isPin) markersHTML += drawHudMarkerOnSquare(best.to, "◈", "#00bbf9");

      if ((roflMode || currentStyle === "mogging") && currentRoast && lastOpponentMove && lastOpponentMove.to) {
        markersHTML += drawHudMarkerOnSquare(lastOpponentMove.to, currentRoast.emoji, "#ffbe0b", true);
      }
    }

    const bestGrad = best.isMateInOne ? "grad-mate" : "grad-best";
    const bestGlow = best.isMateInOne ? "#ffbe0b" : "#00f5d4";

    svg.innerHTML = `
      <defs>
        <linearGradient id="grad-best" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00bbf9" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="grad-mate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff2a85" />
          <stop offset="50%" stop-color="#ffbe0b" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="grad-avg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff9e00" />
          <stop offset="100%" stop-color="#ffbe0b" />
        </linearGradient>
        <linearGradient id="grad-worst" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#b5179e" />
          <stop offset="100%" stop-color="#ff2a85" />
        </linearGradient>
        <marker id="m-best" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="${bestGlow}" fill-opacity="0.96"/>
        </marker>
        <marker id="m-avg" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="#ffbe0b" fill-opacity="0.85"/>
        </marker>
        <marker id="m-worst" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="#ff2a85" fill-opacity="0.8"/>
        </marker>
      </defs>
      ${!best.isMateInOne ? drawCustomArrow(worst, "grad-worst", "#ff2a85", "m-worst", worstCurve, 0.42, false) : ""}
      ${!best.isMateInOne ? drawCustomArrow(average, "grad-avg", "#ffbe0b", "m-avg", avgCurve, 0.52, false) : ""}
      ${drawCustomArrow(best, bestGrad, bestGlow, "m-best", 0, 0.88, true)}
      ${markersHTML}
    `;
  }

  function explainWithModule(m, type, fen) {
    if (window.ChessExplainer && window.ChessExplainer.explainMove) {
      return window.ChessExplainer.explainMove(m, type, fen, currentStyle, roflMode);
    }
    return m ? `${m.from} → ${m.to}` : "";
  }

  function checkGameEndAndLearn(myColor) {
    if (gameResultRecorded || sessionMoveHistory.length < 2) return;
    const pageText = document.body.innerText || "";

    const whiteWon = pageText.includes("White is victorious") || pageText.includes("Победа белых");
    const blackWon = pageText.includes("Black is victorious") || pageText.includes("Победа черных");
    const isDraw = pageText.includes("Stalemate") || pageText.includes("Draw") || pageText.includes("Ничья");

    if (!whiteWon && !blackWon && !isDraw) return;

    gameResultRecorded = true;
    let outcome = "draw";
    if (whiteWon) outcome = myColor === "w" ? "win" : "loss";
    if (blackWon) outcome = myColor === "b" ? "win" : "loss";

    chrome.runtime.sendMessage(
      { type: "RECORD_GAME_RESULT", history: sessionMoveHistory, result: outcome },
      (res) => {
        if (res && res.ok) {
          $("cc-memory-stat").textContent = `${res.positionsCount} ПОЗ.`;
          if ($("cc-misc-db-summary")) {
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          $("cc-opening-name").textContent =
            outcome === "win" ? "👑 ПОБЕДА ЗАПИСАНА В БАЗУ" : "◈ ОШИБКИ ПАРТИИ ИЗУЧЕНЫ";
        }
      }
    );
  }

  function applyAnalysisResult(state, res, isDeepPass = false, prevBestUci = "") {
    if (!res || res.error) return;
    cachedMoves = res;

    // Если во время ожидания таймера пришел уточненный DEEP PASS — тихо обновляем целевой ход без сброса таймера!
    if (isDeepPass && currentTurnDecision.boardKey === state.boardKey && !currentTurnDecision.skip) {
      if (currentTurnDecision.typeLabel.startsWith("СРЕДНИЙ") && res.average) {
        currentTurnDecision.move = res.average;
      } else if (res.best) {
        currentTurnDecision.move = res.best;
      }
    }

    if (res.positionsCount !== undefined) {
      $("cc-memory-stat").textContent = `${res.positionsCount} ПОЗ.`;
      if ($("cc-misc-db-summary")) {
        $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
      }
    }

    if (!isDeepPass && res.lastOpponentMove) {
      const oppUci = res.lastOpponentMove.from + res.lastOpponentMove.to;
      if (uciHistoryList[uciHistoryList.length - 1] !== oppUci) {
        uciHistoryList.push(oppUci);
      }
    }

    const mateBanner = $("cc-mate-banner");
    if (mateBanner) {
      if (res.best && res.best.isMateInOne) {
        mateBanner.style.display = "block";
        $("cc-mate-banner-text").textContent = `Ход ${res.best.from} → ${res.best.to}# ставит чистый МАТ В 1 ХОД! Соперник доигрался!`;
      } else {
        mateBanner.style.display = "none";
      }
    }

    const roastBox = $("cc-roast-box");
    if ((roflMode || currentStyle === "mogging") && res.lastOpponentMove && window.ChessExplainer) {
      currentRoast = window.ChessExplainer.roastOpponentMove(
        res.lastOpponentMove,
        res.opponentEvalDropPawns,
        state.fen,
        Boolean(res.best && res.best.isMateInOne)
      );
      if (currentRoast && roastBox && !(res.best && res.best.isMateInOne)) {
        roastBox.style.display = "block";
        $("cc-roast-badge").textContent = `⚡ ${currentRoast.badgeText}`;
        $("cc-roast-text").textContent = currentRoast.text;
      } else if (roastBox) {
        roastBox.style.display = "none";
      }
    } else if (roastBox) {
      currentRoast = null;
      roastBox.style.display = "none";
    }

    if (res.best) {
      const improvedByDeep = isDeepPass && prevBestUci && prevBestUci !== res.best.uci;
      const evalPrefix = (!res.best.isMateInOne && parseFloat(res.best.evalPawns) > 0) ? "+" : "";
      $("cc-best-eval").textContent = `${evalPrefix}${res.best.evalPawns}`;
      $("cc-best-desc").textContent =
        (improvedByDeep ? "✦ [УЛУЧШЕНО ГЛУБИНОЙ] " : "") + explainWithModule(res.best, "best", state.fen);
      $("cc-best-pv").textContent = res.best.pvLine ? `◈ Вариант: ${res.best.pvLine}` : "";

      const detectedOpening = window.ChessOpenings ? window.ChessOpenings.detect(uciHistoryList) : null;
      if (res.hangingSquare && !res.best.isMateInOne) {
        $("cc-opening-name").textContent = `⚠️ ВНИМАНИЕ: ПОЛЕ ${res.hangingSquare.toUpperCase()} ПОД БОЕМ!`;
        $("cc-opening-plan").textContent = `Ваша пешка или фигура на клетке ${res.hangingSquare} атакована — защитите или уведите её!`;
      } else if (res.best.bookName) {
        $("cc-opening-name").textContent = `◈ ДЕБЮТ: ${res.best.bookName.split("—")[0].trim()}`;
        $("cc-opening-plan").textContent = detectedOpening?.plan || res.best.bookName;
      } else if (detectedOpening) {
        $("cc-opening-name").textContent = `◈ ${detectedOpening.name.toUpperCase()}`;
        $("cc-opening-plan").textContent = detectedOpening.plan;
      }

      renderEvalBar(state, res.best.whitePerspectiveEval || res.best.evalPawns);

      if (!isDeepPass && state.actualTurn === state.myColor && res.boardKey !== lastSavedFenKey) {
        lastSavedFenKey = res.boardKey;
        sessionMoveHistory.push({ fenKey: res.boardKey, uci: res.best.uci });
        if (uciHistoryList[uciHistoryList.length - 1] !== res.best.uci) {
          uciHistoryList.push(res.best.uci);
        }
      }

      if (!isDeepPass && autoMoveEnabled && state.actualTurn === state.myColor) {
        scheduleAutoMoveIfNeeded();
      }
    }

    if (res.average) {
      const avgPref = parseFloat(res.average.evalPawns) > 0 ? "+" : "";
      $("cc-avg-eval").textContent = `${avgPref}${res.average.evalPawns}`;
      $("cc-avg-desc").textContent = explainWithModule(res.average, "avg", state.fen);
    }
    if (res.worst) {
      const wstPref = parseFloat(res.worst.evalPawns) > 0 ? "+" : "";
      $("cc-worst-eval").textContent = `${wstPref}${res.worst.evalPawns}`;
      $("cc-worst-desc").textContent = explainWithModule(res.worst, "worst", state.fen);
    }

    renderArrowsOverlay(state, res);
  }

  function runCycle(forceByButton = false) {
    ensurePanel();

    // Если прямо сейчас выполняется наш клик или действует кулдаун — не сбиваем состояние!
    if (!forceByButton && (isExecutingMove || Date.now() < moveCooldownUntil)) {
      return;
    }

    const state = captureBoardState(false);
    if (!state) return;

    if (state.animating) {
      return;
    }

    checkGameEndAndLearn(state.myColor);

    const standbyBox = $("cc-enemy-turn-standby");
    const activeBox = $("cc-my-turn-active");
    const deepBadge = $("cc-deep-status");

    // МГНОВЕННАЯ ОЧИСТКА В ХОД СОПЕРНИКА
    if (!forceByButton && turnMode === "my" && state.actualTurn !== state.myColor) {
      hideArrows();
      resetTurnDecision();
      if (deepBadge) deepBadge.style.display = "none";
      if (standbyBox) {
        standbyBox.style.display = "flex";
        const mySideText = state.myColor === "w" ? "вы за Белых ⚪" : "вы за Черных ⚫";
        $("cc-standby-title").textContent = `Ход соперника (${mySideText})`;
      }
      if (activeBox) activeBox.style.display = "none";
      if (autoMoveEnabled) {
        setAutoStatusText("Ждем ответа соперника...", "#94a3b8");
      }
      committedBoardKey = "";
      return;
    }

    if (standbyBox) standbyBox.style.display = "none";
    if (activeBox) activeBox.style.display = "flex";

    // Если позиция на доске не изменилась — НЕ пересчитываем заново и НЕ дергаем статус!
    if (!forceByButton && state.boardKey === committedBoardKey) {
      if (autoMoveEnabled && state.actualTurn === state.myColor && !autoMoveTimer && !currentTurnDecision.skip) {
        scheduleAutoMoveIfNeeded();
      }
      return;
    }

    committedBoardKey = state.boardKey;
    resetTurnDecision();

    const myReqId = ++analysisRequestId;
    const sideText = state.sideToAnalyze === "w" ? "ХОД БЕЛЫХ ⚪" : "ХОД ЧЕРНЫХ ⚫";
    if ($("cc-turn-indicator")) $("cc-turn-indicator").textContent = sideText;

    // ФАЗА 1: FAST PASS
    chrome.runtime.sendMessage(
      { type: "ANALYZE_POSITION", fen: state.fen, elo: currentElo, style: currentStyle, pass: "fast" },
      (fastRes) => {
        if (myReqId !== analysisRequestId || !fastRes || fastRes.error) return;
        applyAnalysisResult(state, fastRes, false, "");

        if (fastRes.best && fastRes.best.isMateInOne) {
          if (deepBadge) deepBadge.style.display = "none";
          return;
        }

        // ФАЗА 2: DEEP PASS
        if (deepBadge) deepBadge.style.display = "inline-block";
        const firstBestUci = fastRes.best ? fastRes.best.uci : "";

        chrome.runtime.sendMessage(
          { type: "ANALYZE_POSITION", fen: state.fen, elo: currentElo, style: currentStyle, pass: "deep" },
          (deepRes) => {
            if (myReqId !== analysisRequestId) return;
            if (deepBadge) deepBadge.style.display = "none";
            if (!deepRes || deepRes.error) return;

            const currentFresh = captureBoardState(true);
            if (!currentFresh || currentFresh.boardKey !== state.boardKey) return;

            applyAnalysisResult(currentFresh, deepRes, true, firstBestUci);
          }
        );
      }
    );
  }

  let boardObserver = null;
  function attachBoardObserver() {
    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (!cgBoard || boardObserver) return;
    boardObserver = new MutationObserver(() => {
      if (!isExecutingMove && Date.now() >= moveCooldownUntil) {
        runCycle(false);
      }
    });
   // Следим только за добавлением/удалением фигур (childList), игнорируя мелкие атрибуты вроде hover/selected!
    boardObserver.observe(cgBoard, { childList: true });
  }

  loadSettings();
  const mainLoopInterval = setInterval(() => {
    attachBoardObserver();
    runCycle(false);
  }, 110);

  const syncVisualPosition = () => {
    const state = captureBoardState(true);
    if (state && cachedMoves.best) {
      renderEvalBar(state, cachedMoves.best.whitePerspectiveEval || cachedMoves.best.evalPawns);
      if (turnMode === "my" && state.actualTurn !== state.myColor) return;
      renderArrowsOverlay(state, cachedMoves);
    }
  };

  window.addEventListener("scroll", syncVisualPosition);
  window.addEventListener("resize", syncVisualPosition);

  // === МОСТ ДЛЯ CONTENT2.JS (ПОЛНЫЙ ДОСТУП К ПЕРЕМЕННЫМ, SHADOW DOM И ПОДМЕНЕ ФУНКЦИЙ) ===
  window.CC_CORE = {
    getState() {
      return {
        currentElo, currentStyle, showArrows, showEvalBar, turnMode, forcedMyColor,
        autoMoveEnabled, autoMoveDelayMs, autoMoveJitterMs, autoMoveTriggerRate,
        useAverageMoveSometimes, averageMoveFrequency, protectCriticalMoves, autoClickMethod,
        uiTheme, arrowStyle, arrowScale, arrowOpacity, roflMode, safeAntiBanGuard, activeTab,
        committedBoardKey, cachedMoves, currentRoast, isExecutingMove, moveCooldownUntil,
        currentTurnDecision, sessionMoveHistory, uciHistoryList
      };
    },
    setState(patch) {
      if (!patch) return;
      if ("currentElo" in patch) currentElo = patch.currentElo;
      if ("currentStyle" in patch) currentStyle = patch.currentStyle;
      if ("showArrows" in patch) showArrows = patch.showArrows;
      if ("showEvalBar" in patch) showEvalBar = patch.showEvalBar;
      if ("turnMode" in patch) turnMode = patch.turnMode;
      if ("forcedMyColor" in patch) forcedMyColor = patch.forcedMyColor;
      if ("autoMoveEnabled" in patch) autoMoveEnabled = patch.autoMoveEnabled;
      if ("autoMoveDelayMs" in patch) autoMoveDelayMs = patch.autoMoveDelayMs;
      if ("autoMoveJitterMs" in patch) autoMoveJitterMs = patch.autoMoveJitterMs;
      if ("autoMoveTriggerRate" in patch) autoMoveTriggerRate = patch.autoMoveTriggerRate;
      if ("useAverageMoveSometimes" in patch) useAverageMoveSometimes = patch.useAverageMoveSometimes;
      if ("averageMoveFrequency" in patch) averageMoveFrequency = patch.averageMoveFrequency;
      if ("protectCriticalMoves" in patch) protectCriticalMoves = patch.protectCriticalMoves;
      if ("autoClickMethod" in patch) autoClickMethod = patch.autoClickMethod;
      if ("uiTheme" in patch) uiTheme = patch.uiTheme;
      if ("arrowStyle" in patch) arrowStyle = patch.arrowStyle;
      if ("arrowScale" in patch) arrowScale = patch.arrowScale;
      if ("arrowOpacity" in patch) arrowOpacity = patch.arrowOpacity;
      if ("roflMode" in patch) roflMode = patch.roflMode;
      if ("safeAntiBanGuard" in patch) safeAntiBanGuard = patch.safeAntiBanGuard;
      if ("committedBoardKey" in patch) committedBoardKey = patch.committedBoardKey;
      if ("cachedMoves" in patch) cachedMoves = patch.cachedMoves;
      if ("isExecutingMove" in patch) isExecutingMove = patch.isExecutingMove;
      if ("moveCooldownUntil" in patch) moveCooldownUntil = patch.moveCooldownUntil;
      if ("currentTurnDecision" in patch) currentTurnDecision = patch.currentTurnDecision;
    },
    override(hooks) {
      if (!hooks) return;
      if (hooks.executeMoveOnBoard) executeMoveOnBoard = hooks.executeMoveOnBoard;
      if (hooks.performCleanDomMove) performCleanDomMove = hooks.performCleanDomMove;
      if (hooks.scheduleAutoMoveIfNeeded) scheduleAutoMoveIfNeeded = hooks.scheduleAutoMoveIfNeeded;
      if (hooks.chooseAutoMoveOnce) chooseAutoMoveOnce = hooks.chooseAutoMoveOnce;
      if (hooks.detectActualTurnOnBoard) detectActualTurnOnBoard = hooks.detectActualTurnOnBoard;
      if (hooks.detectBlackOrientation) detectBlackOrientation = hooks.detectBlackOrientation;
      if (hooks.captureBoardState) captureBoardState = hooks.captureBoardState;
      if (hooks.renderArrowsOverlay) renderArrowsOverlay = hooks.renderArrowsOverlay;
      if (hooks.renderEvalBar) renderEvalBar = hooks.renderEvalBar;
      if (hooks.applyAnalysisResult) applyAnalysisResult = hooks.applyAnalysisResult;
      if (hooks.runCycle) runCycle = hooks.runCycle;
      if (hooks.ensurePanel) ensurePanel = hooks.ensurePanel;
    },
    $,
    getShadow,
    saveSetting,
    updateUIValues,
    setAutoStatusText,
    resetTurnDecision,
    forceRecalculate: () => forceRecalculate(),
    switchTab: (t) => switchTab(t),
    captureBoardState: (ig) => captureBoardState(ig),
    executeMoveOnBoard: (m, s, man) => executeMoveOnBoard(m, s, man),
    renderArrowsOverlay: (s, r) => renderArrowsOverlay(s, r),
    renderEvalBar: (s, e) => renderEvalBar(s, e),
    runCycle: (f) => runCycle(f),
    stopMainLoop: () => clearInterval(mainLoopInterval)
  };
})();