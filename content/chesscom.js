(function () {
  console.log("[ChessCoach REWORK v15.8 — Engine Core 2, Full NNUE & Position-ID] Запущен!");

  function isStrictBrilliantMove(moveObj) {
    if (!moveObj) return false;
    const evalNum = parseFloat(moveObj.evalPawns) || 0;
    return Boolean(
      moveObj.isMateInOne ||
      moveObj.isForcedMateInTwo ||
      (moveObj.promo === "n" && evalNum >= 1.5) ||
      (moveObj.isSacrifice &&
        evalNum >= 2.0 &&
        !moveObj.ignoredHangingPiece &&
        !moveObj.underDirectAttack)
    );
  }

  if (window.ChessFX) {
    window.ChessFX.isBrilliantMove = isStrictBrilliantMove;
  }

  const ALL_STYLE_NAMES = {
    mogging: "⚡ Моггинг",
    tal: "✦ Таль",
    alphazero: "🧠 AlphaZero",
    morphy: "🎭 Морфи",
    hikaru: "🚀 Накамура",
    kasparov: "▲ Каспаров",
    fischer: "◈ Фишер",
    carlsen: "❖ Карлсен",
    solid: "🛡 Карпов",
    botvinnik: "🏛 Ботвинник",
    balanced: "⚙ Стокфиш"
  };

  const THEME_ACCENT_COLORS = {
    minimal: ["#38bdf8", "#818cf8"],
    cyberpunk: ["#00f5d4", "#00bbf9"],
    aurora: ["#00f5d4", "#f72585"],
    hologram: ["#c77dff", "#48cae4"],
    crimson: ["#ff2a85", "#ff758f"],
    gold: ["#ffbe0b", "#fb5607"],
    matrix: ["#38b000", "#ccff33"],
    titanium: ["#e0fbfc", "#98c1d9"],
    obsidian: ["#f8fafc", "#94a3b8"],
    nebula: ["#67e8f9", "#d946ef"],
    grandmaster: ["#f8d477", "#6ee7b7"]
  };
  const ARROW_STYLE_IDS = new Set([
    "sq_cyber_frame", "sq_Step_badges", "sq_hologram_tiles", "sq_minimal_dots",
    "curved_neon", "comet_trail", "cyber_chevron", "quantum_portal", "tube_3d", "plasma",
    "sniper_3d", "dna_wave", "chroma_rgb", "laser", "classic", "dotted"
  ]);
  const MATE_STYLE_IDS = new Set(["phonk_skull", "orbital_laser", "royal_exec", "rofl_classic"]);

  const FILES = "abcdefgh";

  // На Chess.com доступны только безопасные профили: "legit" (по умолчанию) и "all" (расширенный легит)
  let workMode = "legit";
  let activeTabId = "analyzer";
  let panelLeft = null;
  let panelTop = null;
  let panelMinimized = false;
  let panelHidden = false;

  // Пользовательский фон из проводника
  let customBgDataUrl = "";
  let customBgDim = 0.72;
  let customBgBlur = 4;

  // Живая телеметрия 24/7
  let liveTelemetryEnabled = true;
  let teleShowClocks = true;
  let teleShowEngine = true;
  let teleShowWdl = true;
  let teleShowThreats = true;
  let lastTelemetryData = {
    serverSource: "STEALTH READY",
    pingMs: 0,
    myWin: 50,
    draw: 30,
    enemyWin: 20,
    nearestThreatText: "Ожидание начала партии на Chess.com..."
  };

  // СТАТИСТИКА FAIR PLAY АНТИ-БАНА (Контроль T1% совпадений со Stockfish)
  let legitStats = {
    totalMyMoves: 0,
    top1Matches: 0,
    secondLineMatches: 0,
    windowBlursCount: 0,
    lastBestUciOnMyTurn: "",
    lastAvgUciOnMyTurn: ""
  };

  let currentElo = 2400;
  let currentStyle = "tal";
  let showArrows = true;
  let showEvalBar = true;
  let showAverageMove = true;
  let showWorstMove = false;
  let turnMode = "my";
  let forcedMyColor = "auto";

  let useStockfishWasm = true;
  let engineMaxMode = false;
  let trapRadarEnabled = true;
  let audioRadarEnabled = true;
  let heatmapAlwaysOn = false;
  let isAltPressed = false;

  // Настройки Беспалевного Legit-Автохода для Chess.com
  let autoMoveEnabled = false;
  let legitAutoTiming = true;
  let humanHesitationEnabled = true; // Имитация задумчивости в сложных позициях
  let autoT1LimiterEnabled = true;   // Авто-удержание T1% ниже 68%
  let maxSafeT1Percent = 66;         // Порог T1%, выше которого форсируется 2-я линия
  let autoMoveDelayMs = 540;
  let autoMoveJitterMs = 260;
  let autoMoveTriggerRate = 85;
  let useAverageMoveSometimes = true;
  let averageMoveFrequency = 30;
  let protectCriticalMoves = true;
  let autoClickMethod = "bezier_click"; // "bezier_click" | "bezier_drag"

  let uiTheme = "cyberpunk";
  let arrowStyle = "curved_neon";
  let arrowScale = 1.0;
  let arrowOpacity = 0.88;
  let phonkEditEnabled = false;
  let mateStyle = "phonk_skull";
  let roflMode = true;
  let safeAntiBanGuard = false;
  let welcomeBannerHidden = false;

  const DEFAULT_VISUAL_MASK = Object.freeze({
    version: 1,
    enabled: false,
    myPresetId: "anonymous",
    opponentPresetId: "nakamura",
    style: "broadcast",
    maskDetails: true,
    maskPageTitle: true,
    blockProfileHover: true,
    autoRotateOpponent: false,
    my: { nickname: "HiddenKnight", elo: 2400, title: "GM", countryCode: "", avatarUrl: "" },
    opponent: { nickname: "Hikaru", elo: 2802, title: "GM", countryCode: "US", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png" }
  });
  let visualMask = normalizeVisualMask(DEFAULT_VISUAL_MASK);
  let privacyMaskManager = null;
  let privacyMaskFoundPlayers = 0;
  let privacySaveTimer = null;
  let uiAbortController = null;

  let castlingRights = { K: true, Q: true, k: true, q: true };
  let prevGridState = null;
  let prevBoardPartForHistory = "";
  let currentEpSquare = "-";
  let halfmoveClock = 0;
  let fullmoveNumber = 1;
  let lastPathname = location.pathname;
  let lastRealEnemyMove = null;
  let lastOurExecutedMove = null;

  let committedBoardKey = "";
  let committedEnemyBoardKey = "";
  let analysisRequestId = 0;
  let activeEngineBoardKey = "";
  const analysisSessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let positionId = 0;
  let positionAnalysisId = 0;
  let positionRequestId = 0;
  let currentPositionKey = "";
  let boardDirty = true;
  let analysisRetryCount = 0;
  let cachedMoves = {
    best: null,
    average: null,
    worst: null,
    safeNonRepeatingUcis: [],
    boardKey: "",
    pass: "",
    isDangerPosition: false,
    heatmap: [],
    timeAdvice: null,
    telemetry: null,
    syzygyActive: false
  };
  let currentRoast = null;

  let evalGraphHistory = [];
  let lastRecordedGraphBoardKey = "";
  let recentPositionHistory = [];
  let gameStartedFromInitial = false;

  let autoMoveTimer = null;
  let animRetryTimer = null;
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
  let suspectEngineStreak = 0;
  let uciHistoryList = [];
  let gameResultRecorded = false;

  let shadowRoot = null;
  let extensionInvalidated = false;
  let mainIntervalId = null;
  let neuralCanvasRafId = null;

  const StockfishWasmEngine = window.ChessCoachEngine.create({
    isEnabled: () => useStockfishWasm && !extensionInvalidated && isContextValid()
  });

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function handleEngineVisibilityChange(event) {
    if (event?.type === "visibilitychange" && !document.hidden) return;
    analysisRequestId++;
    activeEngineBoardKey = "";
    StockfishWasmEngine.cancel?.();
  }

  function shutdownOrphanedScript() {
    extensionInvalidated = true;
    StockfishWasmEngine.terminate();
    if (mainIntervalId) { clearInterval(mainIntervalId); mainIntervalId = null; }
    if (neuralCanvasRafId) { cancelAnimationFrame(neuralCanvasRafId); neuralCanvasRafId = null; }
    if (autoMoveTimer) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
    if (animRetryTimer) { clearTimeout(animRetryTimer); animRetryTimer = null; }
    if (privacySaveTimer) { clearTimeout(privacySaveTimer); privacySaveTimer = null; }
    if (privacyMaskManager) { privacyMaskManager.destroy(); privacyMaskManager = null; }
    if (uiAbortController) { uiAbortController.abort(); uiAbortController = null; }
    try { chrome.storage?.onChanged?.removeListener(handleStorageChanges); } catch (e) {}
    if (window.ChessFX && shadowRoot) {
      window.ChessFX.stopPhonkEdit(shadowRoot);
    }
    window.removeEventListener("scroll", syncVisualPosition, true);
    window.removeEventListener("resize", syncVisualPosition);
    document.removeEventListener?.("visibilitychange", handleEngineVisibilityChange);
    window.removeEventListener("pagehide", handleEngineVisibilityChange);
    try {
      if (domObserver) domObserver.disconnect();
      if (boardResizeObserver) boardResizeObserver.disconnect();
    } catch (e) {}
    if (shadowRoot?.host?.isConnected) shadowRoot.host.remove();
    shadowRoot = null;
  }

  function safeSendMessage(payload, callback) {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }
    try {
      chrome.runtime.sendMessage(payload, (res) => {
        try {
          if (chrome.runtime.lastError) {
            if (callback) callback({ error: chrome.runtime.lastError.message, status: "error", meta: payload.meta || null });
            return;
          }
          if (callback) callback(res);
        } catch (err) {
          shutdownOrphanedScript();
        }
      });
    } catch (err) {
      if (callback) callback({ error: String(err?.message || err), status: "error", meta: payload.meta || null });
    }
  }

  function getShadow() {
    if (shadowRoot) {
      if (!shadowRoot.host.isConnected) document.documentElement.appendChild(shadowRoot.host);
      return shadowRoot;
    }
    // Полный DOM-стелс: никаких data-атрибутов или ID на хост-элементе в основном документе Chess.com
    const host = document.createElement("div");
    host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483646;";
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "closed" });
    if (typeof window.__ChessCoachRegisterHudShadow === "function") {
      window.__ChessCoachRegisterHudShadow(shadowRoot);
    }

    if (isContextValid()) {
      const linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = chrome.runtime.getURL("content/content.css");
      shadowRoot.appendChild(linkEl);
    }
    return shadowRoot;
  }

  function $(id) {
    return getShadow().getElementById(id);
  }

  function saveSetting(obj) {
    if (extensionInvalidated || !isContextValid()) return;
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(obj);
      }
    } catch (e) {
      shutdownOrphanedScript();
    }
  }

  function setSelectSafe(selectNode, val, fallback) {
    if (!selectNode) return;
    const exists = Array.from(selectNode.options).some((o) => o.value === val);
    selectNode.value = exists ? val : fallback;
  }

  function applyCustomBackgroundToPanel() {
    const bgLayer = $("cc-custom-bg-layer");
    const dimLayer = $("cc-custom-bg-dim");
    const neuralCanvas = $("cc-neural-canvas");
    if (!bgLayer || !dimLayer) return;

    if (customBgDataUrl && customBgDataUrl.startsWith("data:image/")) {
      bgLayer.style.display = "block";
      bgLayer.style.backgroundImage = `url("${customBgDataUrl}")`;
      bgLayer.style.filter = `blur(${customBgBlur}px)`;
      dimLayer.style.display = "block";
      dimLayer.style.background = `rgba(6, 9, 15, ${customBgDim})`;
      if (neuralCanvas) neuralCanvas.style.opacity = "0.28";
    } else {
      bgLayer.style.display = "none";
      bgLayer.style.backgroundImage = "none";
      dimLayer.style.display = "none";
      if (neuralCanvas) neuralCanvas.style.opacity = "0.65";
    }
  }

  function applyPersistentPanelGeometry() {
    const panel = $("chesscoach-panel");
    const workspace = $("chesscoach-workspace");
    const modeBar = $("cc-mode-switcher-bar");
    const toggleBtn = $("cc-toggle-btn");
    if (!panel) return;

    if (typeof panelLeft === "number" && typeof panelTop === "number") {
      const clampedX = Math.max(0, Math.min(window.innerWidth - 120, panelLeft));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 60, panelTop));
      panel.style.left = `${clampedX}px`;
      panel.style.top = `${clampedY}px`;
      panel.style.right = "auto";
    }

    panel.classList.toggle("cc-minimized", Boolean(panelMinimized));
    if (workspace) workspace.style.display = panelMinimized ? "none" : "grid";
    if (modeBar) modeBar.style.display = panelMinimized ? "none" : "grid";
    if (toggleBtn) toggleBtn.textContent = panelMinimized ? "▢" : "—";
    panel.style.display = panelHidden ? "none" : "flex";
  }

  function getT1MatchPercent() {
    if (legitStats.totalMyMoves === 0) return 0;
    return Math.round((legitStats.top1Matches / legitStats.totalMyMoves) * 100);
  }

  function updateLegitAntiBanMeterUI() {
    const valEl = $("cc-antiban-t1-val");
    const fillEl = $("cc-antiban-t1-fill");
    const hintEl = $("cc-antiban-t1-hint");
    const blurEl = $("cc-antiban-blur-badge");
    if (!valEl || !fillEl || !hintEl) return;

    const total = legitStats.totalMyMoves;
    const t1Pct = getT1MatchPercent();
    fillEl.style.width = `${Math.min(100, t1Pct)}%`;

    if (blurEl) {
      blurEl.textContent = `Альт-Табы: ${legitStats.windowBlursCount}`;
      blurEl.style.color = legitStats.windowBlursCount > 4 ? "#ffbe0b" : "#94a3b8";
    }

    if (total < 4) {
      valEl.textContent = `🟢 T1: ${t1Pct}% (${total} ход.) • КАЛИБРОВКА`;
      valEl.style.color = "#00f5d4";
      fillEl.style.background = "#00f5d4";
      hintEl.textContent = `Безопасный коридор T1 на Chess.com: до ${maxSafeT1Percent}%. Авто-лимитер сам разбавит игру 2-й линией.`;
    } else if (t1Pct <= maxSafeT1Percent) {
      valEl.textContent = `🟢 T1: ${t1Pct}% (${legitStats.top1Matches}/${total}) • 100% ЛЕГИТ`;
      valEl.style.color = "#38b000";
      fillEl.style.background = "#38b000";
      hintEl.textContent = `Идеальная человеческая статистика! Сделано ходов по 2-й линии: ${legitStats.secondLineMatches}.`;
    } else if (t1Pct <= 76) {
      valEl.textContent = `🟡 T1: ${t1Pct}% (${legitStats.top1Matches}/${total}) • ВЫШЕ НОРМЫ`;
      valEl.style.color = "#ffbe0b";
      fillEl.style.background = "#ffbe0b";
      hintEl.textContent = `Точность близка к детекту! Авто-лимитер переключит следующий спокойный ход на 2-ю линию (желтая стрелка).`;
    } else {
      valEl.textContent = `🔴 T1: ${t1Pct}% (${legitStats.top1Matches}/${total}) • ОПАСНЫЙ T1!`;
      valEl.style.color = "#ff2a85";
      fillEl.style.background = "#ff2a85";
      hintEl.textContent = `⚠️ Слишком много ходов по 1-й линии Stockfish! Срочно сделайте 1–2 хода по желтой стрелке или своей рукой.`;
    }
  }

  function applyWorkModePreset(mode, triggerSave = true) {
    if (mode === "hvh") {
      mode = "legit";
      setAutoStatusText("🛡️ На Chess.com режим Резни (HvH) отключен для 100% защиты от бана!", "#ffbe0b");
    }

    workMode = mode;
    const panel = $("chesscoach-panel");
    if (panel) {
      panel.setAttribute("data-work-mode", mode);
    }

    if (mode === "legit") {
      currentElo = 2500;
      currentStyle = "tal";
      useStockfishWasm = true;
      showAverageMove = true;
      showWorstMove = false;
      engineMaxMode = false;
      legitAutoTiming = true;
      humanHesitationEnabled = true;
      autoT1LimiterEnabled = true;
      protectCriticalMoves = true;
      useAverageMoveSometimes = true;
      averageMoveFrequency = 32;
      autoMoveDelayMs = 540;
      autoMoveJitterMs = 260;
      StockfishWasmEngine.initWorker();

      if (triggerSave) {
        saveSetting({
          workMode: "legit",
          elo: 2500,
          style: "tal",
          useStockfishWasm: true,
          showAverageMove: true,
          showWorstMove: false,
          engineMaxMode: false,
          legitAutoTiming: true,
          protectCriticalMoves: true,
          useAverageMoveSometimes: true,
          averageMoveFrequency: 32,
          autoMoveDelayMs: 540,
          autoMoveJitterMs: 260
        });
      }
      setAutoStatusText("🛡 CHESS.COM STEALTH LEGIT (БЕЗЬЕ + T1 ЛИМИТЕР 66%)", "#38b000");
    } else {
      if (triggerSave) {
        saveSetting({ workMode: "all" });
      }
      setAutoStatusText("◈ РАСШИРЕННЫЙ LEGIT-РЕЖИМ (ВСЕ НАСТРОЙКИ ОТКРЫТЫ)", "#00f5d4");
    }

    updateUIValues();
    if (triggerSave) {
      forceRecalculate();
    }
  }

  function detectPlayerDisplayName() {
    const bottomUser = document.querySelector(
      ".board-layout-bottom .user-tagline-username, .board-layout-bottom [data-test-element='user-tagline-username'], .player-bottom .user-tagline-username"
    );
    if (visualMask.enabled) return visualMask.my.nickname;
    if (bottomUser && bottomUser.textContent) {
      const clean = bottomUser.textContent.trim();
      if (clean && clean.length >= 2 && clean.length <= 24) return clean;
    }
    return "Гроссмейстер";
  }

  function getDynamicGreetingText() {
    const hour = new Date().getHours();
    const user = detectPlayerDisplayName();
    if (hour >= 5 && hour < 12) return `☀️ Доброе утро, ${user}! Стелс-модуль Chess.com активен`;
    if (hour >= 12 && hour < 18) return `🛡️ Привет, ${user}! Анти-бан защита Fair Play на 100%`;
    if (hour >= 18 && hour < 23) return `🌌 Добрый вечер, ${user}! Легитное доминирование на Chess.com`;
    return `🌙 Ночная катка, ${user}? Кривые Безье и T1-фильтр на страже аккаунта!`;
  }

  function initNeuralCanvasBackground(panel) {
    const canvas = $("cc-neural-canvas");
    if (!canvas || !panel) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let width = 600;
    let height = 560;
    const mouse = { x: -999, y: -999 };

    const updateSize = () => {
      width = panel.clientWidth || 600;
      height = panel.clientHeight || 560;
      canvas.width = width;
      canvas.height = height;
    };
    updateSize();

    panel.addEventListener("mousemove", (e) => {
      const rect = panel.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    panel.addEventListener("mouseleave", () => {
      mouse.x = -999;
      mouse.y = -999;
    });

    const particles = Array.from({ length: 20 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.9
    }));

    let lastFrameAt = 0;
    const renderFrame = (timestamp = 0) => {
      if (extensionInvalidated) return;
      if (panel.classList.contains("cc-minimized") || panel.style.display === "none") {
        neuralCanvasRafId = requestAnimationFrame(renderFrame);
        return;
      }
      const performanceMode = window.ChessCoachEngine.getPerformanceMode?.() || "normal";
      if (performanceMode === "critical") {
        neuralCanvasRafId = requestAnimationFrame(renderFrame);
        return;
      }
      const frameInterval = performanceMode === "constrained" ? 80 : 42;
      if (timestamp - lastFrameAt < frameInterval) {
        neuralCanvasRafId = requestAnimationFrame(renderFrame);
        return;
      }
      lastFrameAt = timestamp;

      if (canvas.width !== panel.clientWidth || canvas.height !== panel.clientHeight) {
        updateSize();
      }

      ctx.clearRect(0, 0, width, height);
      const [c1, c2] = THEME_ACCENT_COLORS[uiTheme] || THEME_ACCENT_COLORS.cyberpunk;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const mdx = mouse.x - p.x;
        const mdy = mouse.y - p.y;
        const mDist = Math.hypot(mdx, mdy);
        if (mDist < 110 && mDist > 1) {
          p.x -= (mdx / mDist) * 0.35;
          p.y -= (mdy / mDist) * 0.35;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? c1 : c2;
        ctx.globalAlpha = 0.55;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 105) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = c1;
            ctx.globalAlpha = (1 - dist / 105) * 0.18;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      neuralCanvasRafId = requestAnimationFrame(renderFrame);
    };

    if (neuralCanvasRafId) cancelAnimationFrame(neuralCanvasRafId);
    neuralCanvasRafId = requestAnimationFrame(renderFrame);
  }

  function loadSettings() {
    if (!isContextValid()) return;
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          [
            "workMode", "activeTabId", "panelLeft", "panelTop", "panelMinimized", "panelHidden",
            "customBgDataUrl", "customBgDim", "customBgBlur",
            "liveTelemetryEnabled", "teleShowClocks", "teleShowEngine", "teleShowWdl", "teleShowThreats",
            "elo", "style", "showArrows", "showEvalBar", "showAverageMove", "showWorstMove", "turnMode", "forcedMyColor",
            "useStockfishWasm", "engineMaxMode", "trapRadarEnabled", "audioRadarEnabled", "heatmapAlwaysOn",
            "uiTheme", "arrowStyle", "arrowScale", "arrowOpacity",
            "phonkEditEnabled", "mateStyle", "roflMode", "safeAntiBanGuard", "welcomeBannerHidden",
            "autoMoveEnabled", "legitAutoTiming", "humanHesitationEnabled", "autoT1LimiterEnabled", "maxSafeT1Percent",
            "autoMoveDelayMs", "autoMoveJitterMs", "autoMoveTriggerRate",
            "useAverageMoveSometimes", "averageMoveFrequency", "protectCriticalMoves", "autoClickMethod",
            "chesscomVisualMaskV1"
          ],
          (res) => {
            if (!isContextValid() || !res) return;
            workMode = res.workMode === "all" ? "all" : "legit";
            if (res.activeTabId) activeTabId = res.activeTabId;
            if (typeof res.panelLeft === "number") panelLeft = res.panelLeft;
            if (typeof res.panelTop === "number") panelTop = res.panelTop;
            if (typeof res.panelMinimized === "boolean") panelMinimized = res.panelMinimized;
            if (typeof res.panelHidden === "boolean") panelHidden = res.panelHidden;

            if (typeof res.customBgDataUrl === "string") customBgDataUrl = res.customBgDataUrl;
            if (res.customBgDim !== undefined) customBgDim = Number(res.customBgDim);
            if (res.customBgBlur !== undefined) customBgBlur = Number(res.customBgBlur);

            if (typeof res.liveTelemetryEnabled === "boolean") liveTelemetryEnabled = res.liveTelemetryEnabled;
            if (typeof res.teleShowClocks === "boolean") teleShowClocks = res.teleShowClocks;
            if (typeof res.teleShowEngine === "boolean") teleShowEngine = res.teleShowEngine;
            if (typeof res.teleShowWdl === "boolean") teleShowWdl = res.teleShowWdl;
            if (typeof res.teleShowThreats === "boolean") teleShowThreats = res.teleShowThreats;

            if (res.elo) currentElo = Number(res.elo);
            if (res.style) currentStyle = res.style;
            if (typeof res.showArrows === "boolean") showArrows = res.showArrows;
            if (typeof res.showEvalBar === "boolean") showEvalBar = res.showEvalBar;
            if (typeof res.showAverageMove === "boolean") showAverageMove = res.showAverageMove;
            if (typeof res.showWorstMove === "boolean") showWorstMove = res.showWorstMove;
            if (["my", "auto", "w", "b"].includes(res.turnMode)) turnMode = res.turnMode;
            if (["auto", "w", "b"].includes(res.forcedMyColor)) forcedMyColor = res.forcedMyColor;
            if (typeof res.useStockfishWasm === "boolean") useStockfishWasm = res.useStockfishWasm;
            if (typeof res.engineMaxMode === "boolean") engineMaxMode = res.engineMaxMode;
            if (typeof res.trapRadarEnabled === "boolean") trapRadarEnabled = res.trapRadarEnabled;
            if (typeof res.audioRadarEnabled === "boolean") audioRadarEnabled = res.audioRadarEnabled;
            if (typeof res.heatmapAlwaysOn === "boolean") heatmapAlwaysOn = res.heatmapAlwaysOn;

            if (typeof res.uiTheme === "string" && THEME_ACCENT_COLORS[res.uiTheme]) uiTheme = res.uiTheme;
            if (res.arrowStyle) arrowStyle = res.arrowStyle;
            if (res.arrowScale) arrowScale = Number(res.arrowScale);
            if (res.arrowOpacity) arrowOpacity = Number(res.arrowOpacity);
            if (typeof res.phonkEditEnabled === "boolean") phonkEditEnabled = res.phonkEditEnabled;
            if (res.mateStyle) mateStyle = res.mateStyle;
            if (typeof res.roflMode === "boolean") roflMode = res.roflMode;
            if (typeof res.safeAntiBanGuard === "boolean") safeAntiBanGuard = res.safeAntiBanGuard;
            if (typeof res.welcomeBannerHidden === "boolean") welcomeBannerHidden = res.welcomeBannerHidden;

            if (typeof res.autoMoveEnabled === "boolean") autoMoveEnabled = res.autoMoveEnabled;
            if (typeof res.legitAutoTiming === "boolean") legitAutoTiming = res.legitAutoTiming;
            if (typeof res.humanHesitationEnabled === "boolean") humanHesitationEnabled = res.humanHesitationEnabled;
            if (typeof res.autoT1LimiterEnabled === "boolean") autoT1LimiterEnabled = res.autoT1LimiterEnabled;
            if (res.maxSafeT1Percent !== undefined) maxSafeT1Percent = Number(res.maxSafeT1Percent);
            if (res.autoMoveDelayMs !== undefined) autoMoveDelayMs = Math.max(220, Number(res.autoMoveDelayMs));
            if (res.autoMoveJitterMs !== undefined) autoMoveJitterMs = Number(res.autoMoveJitterMs);
            if (res.autoMoveTriggerRate !== undefined) autoMoveTriggerRate = Number(res.autoMoveTriggerRate);
            if (typeof res.useAverageMoveSometimes === "boolean") useAverageMoveSometimes = res.useAverageMoveSometimes;
            if (res.averageMoveFrequency !== undefined) averageMoveFrequency = Number(res.averageMoveFrequency);
            if (typeof res.protectCriticalMoves === "boolean") protectCriticalMoves = res.protectCriticalMoves;
            if (res.autoClickMethod === "bezier_click" || res.autoClickMethod === "bezier_drag") {
              autoClickMethod = res.autoClickMethod;
            }
            if (engineMaxMode) {
              useStockfishWasm = true;
              currentElo = 3000;
              currentStyle = "balanced";
              showAverageMove = false;
              useAverageMoveSometimes = false;
              autoT1LimiterEnabled = false;
              humanHesitationEnabled = false;
              legitAutoTiming = false;
              autoMoveTriggerRate = 100;
            }
            visualMask = normalizeVisualMask(res.chesscomVisualMaskV1 || DEFAULT_VISUAL_MASK);
            ensurePrivacyMaskManager();
            privacyMaskManager?.update();

            if (useStockfishWasm) {
              StockfishWasmEngine.initWorker();
            }

            ensurePanel();
            applyCustomBackgroundToPanel();
            applyPersistentPanelGeometry();
            switchTab(activeTabId, false);
            updateUIValues();
            forceRecalculate();
          }
        );
      }
    } catch (e) {
      shutdownOrphanedScript();
    }
  }

  function updateLiveTelemetryUI() {
    const card = $("cc-live-telemetry-card");
    if (!card) return;
    card.style.display = liveTelemetryEnabled ? "flex" : "none";
    if (!liveTelemetryEnabled) return;
    const telemetry = lastTelemetryData || {};

    const mySecs = getMyRemainingSeconds();
    const enSecs = getEnemyRemainingSeconds();
    const clocksKnown = Number.isFinite(mySecs) && Number.isFinite(enSecs);
    const diffSecs = clocksKnown ? Math.round(mySecs - enSecs) : 0;
    const diffStr = clocksKnown ? (diffSecs > 0 ? `+${diffSecs}с` : `${diffSecs}с`) : "—";

    const boxClocks = $("cc-tele-box-clocks");
    if (boxClocks) {
      boxClocks.style.display = teleShowClocks ? "block" : "none";
      const valEl = $("cc-tele-clocks-val");
      if (valEl) {
        valEl.innerHTML = `<span style="color:var(--cc-positive);">${formatClockMMSS(mySecs)}</span> vs <span style="color:var(--cc-negative);">${formatClockMMSS(enSecs)}</span> <small style="color:var(--cc-warning);">(${diffStr})</small>`;
      }
    }

    const boxEngine = $("cc-tele-box-engine");
    if (boxEngine) {
      boxEngine.style.display = teleShowEngine ? "block" : "none";
      const valEl = $("cc-tele-engine-val");
      if (valEl) {
        const wasmBadge = useStockfishWasm ? "SF LOCAL" : "JS CORE";
        const source = telemetry.serverSource || "STEALTH";
        valEl.textContent = source.startsWith("SF LOCAL") ? source : `${wasmBadge} • ${source}`;
      }
    }

    const boxWdl = $("cc-tele-box-wdl");
    if (boxWdl) {
      boxWdl.style.display = teleShowWdl ? "block" : "none";
      const w = telemetry.myWin ?? 50;
      const d = telemetry.draw ?? 30;
      const l = telemetry.enemyWin ?? 20;
      const valEl = $("cc-tele-wdl-val");
      if (valEl) {
        valEl.innerHTML = `<span style="color:var(--cc-positive);">Поб: ${w}%</span> • <span style="color:var(--cc-text-secondary);">Нич: ${d}%</span> • <span style="color:var(--cc-negative);">Пор: ${l}%</span>`;
      }
      if ($("cc-wdl-fill-w")) $("cc-wdl-fill-w").style.width = `${w}%`;
      if ($("cc-wdl-fill-d")) $("cc-wdl-fill-d").style.width = `${d}%`;
      if ($("cc-wdl-fill-l")) $("cc-wdl-fill-l").style.width = `${l}%`;
    }

    const boxThreats = $("cc-tele-box-threats");
    if (boxThreats) {
      boxThreats.style.display = teleShowThreats ? "block" : "none";
      const valEl = $("cc-tele-threats-val");
      if (valEl) {
        valEl.textContent = telemetry.nearestThreatText || "Угроз не обнаружено";
      }
    }
  }

  function updateUIValues() {
    const panel = $("chesscoach-panel");
    if (!panel) return;

    panel.setAttribute("data-work-mode", workMode);
    getShadow().querySelectorAll(".cc-mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === workMode);
    });

    const allThemes = Object.keys(THEME_ACCENT_COLORS).map(name => `theme-${name}`);
    allThemes.forEach((cls) => panel.classList.remove(cls));
    panel.classList.add(`theme-${uiTheme}`);

    const welcomeCard = $("cc-welcome-card");
    if (welcomeCard) {
      welcomeCard.style.display = welcomeBannerHidden ? "none" : "block";
      const greetEl = $("cc-welcome-greeting");
      if (greetEl) greetEl.textContent = getDynamicGreetingText();
      const modeChip = $("cc-welcome-chip-mode");
      if (modeChip) {
        modeChip.textContent = workMode === "legit" ? "🛡 Профиль: Stealth Legit" : "◈ Профиль: Расширенный Legit";
      }
      const cpuChip = $("cc-welcome-chip-cpu");
      if (cpuChip) {
        cpuChip.textContent = `🎯 T1-Лимитер: <= ${maxSafeT1Percent}%`;
      }
      const wasmChip = $("cc-welcome-chip-wasm");
      if (wasmChip) {
        wasmChip.textContent = useStockfishWasm ? "⚡ SF LOCAL + Безье: ВКЛ" : "⚙ JS Core + Безье: ВКЛ";
      }
    }

    if ($("cc-elo-slider")) $("cc-elo-slider").value = currentElo;
    if ($("cc-elo-val")) $("cc-elo-val").textContent = `${currentElo} ELO`;
    if ($("cc-elo-badge")) $("cc-elo-badge").textContent = `${currentElo} ELO`;
    const enginePower = $("cc-engine-power");
    if (enginePower && (!cachedMoves.engineMeta || !useStockfishWasm)) {
      const resources = StockfishWasmEngine.getResourceProfile?.() || { dualWorker: false, totalHashMb: 64 };
      enginePower.textContent = useStockfishWasm
        ? `${resources.fullNnue ? "SF FULL" : "SF"} ${resources.dualWorker ? 2 : 1}C · H${resources.totalHashMb}M`
        : "JS CORE";
    }

    const styleLabel = ALL_STYLE_NAMES[currentStyle] || "✦ Таль";
    const bestMv = cachedMoves.best;
    const isBrilliant = bestMv && isStrictBrilliantMove(bestMv);
    const isTrap = bestMv && bestMv.isTrap && bestMv.trapChance >= 75;
    const isSyzygy = bestMv && bestMv.fromSyzygy;

    if ($("cc-best-title")) {
      let badgesHtml = "";
      if (isSyzygy) badgesHtml += `<span class="cc-syzygy-badge">🔮 SYZYGY БОГ</span>`;
      if (isBrilliant) badgesHtml += `<span class="cc-brilliant-badge">💎 БРИЛЛИАНТ !!</span>`;
      if (isTrap) badgesHtml += `<span class="cc-trap-badge">🪤 ЛОВУШКА (${bestMv.trapChance}%)</span>`;
      $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД (1-Я ЛИНИЯ) • ${styleLabel}${badgesHtml}`;
    }
    if ($("cc-active-style-stat")) {
      $("cc-active-style-stat").textContent = styleLabel.replace(/^[^\s]+\s/, "");
    }

    if ($("cc-avg-card")) {
      $("cc-avg-card").style.display = showAverageMove ? "block" : "none";
    }
    if ($("cc-worst-card")) {
      $("cc-worst-card").style.display = (showWorstMove && workMode === "all") ? "block" : "none";
    }
    if ($("cc-show-avg-chk")) $("cc-show-avg-chk").checked = showAverageMove;
    if ($("cc-show-worst-chk")) $("cc-show-worst-chk").checked = showWorstMove;

    if ($("cc-sf-wasm-chk")) $("cc-sf-wasm-chk").checked = useStockfishWasm;
    if ($("cc-engine-max-chk")) $("cc-engine-max-chk").checked = engineMaxMode;
    if ($("cc-trap-radar-chk")) $("cc-trap-radar-chk").checked = trapRadarEnabled;
    if ($("cc-audio-radar-chk")) $("cc-audio-radar-chk").checked = audioRadarEnabled;
    if ($("cc-heatmap-always-chk")) $("cc-heatmap-always-chk").checked = heatmapAlwaysOn;

    if ($("cc-live-telemetry-chk")) $("cc-live-telemetry-chk").checked = liveTelemetryEnabled;
    if ($("cc-tele-clocks-chk")) $("cc-tele-clocks-chk").checked = teleShowClocks;
    if ($("cc-tele-engine-chk")) $("cc-tele-engine-chk").checked = teleShowEngine;
    if ($("cc-tele-wdl-chk")) $("cc-tele-wdl-chk").checked = teleShowWdl;
    if ($("cc-tele-threats-chk")) $("cc-tele-threats-chk").checked = teleShowThreats;
    updateLiveTelemetryUI();
    updateLegitAntiBanMeterUI();

    if ($("cc-color-pill")) {
      const labels = { auto: "◈ АВТО", w: "⚪ БЕЛЫЕ", b: "⚫ ЧЕРНЫЕ" };
      $("cc-color-pill").textContent = labels[forcedMyColor] || "◈ АВТО";
    }

    const autoText = autoMoveEnabled ? "🛡 LEGIT АВТО: ВКЛ" : "🛡 LEGIT АВТО: ВЫКЛ";
    if ($("cc-toggle-auto")) {
      $("cc-toggle-auto").textContent = autoText;
      $("cc-toggle-auto").style.borderColor = autoMoveEnabled ? "var(--cc-accent)" : "rgba(255,255,255,0.14)";
      $("cc-toggle-auto").style.color = autoMoveEnabled ? "var(--cc-accent)" : "#e2e8f0";
    }
    if ($("cc-auto-master-chk")) $("cc-auto-master-chk").checked = autoMoveEnabled;
    if ($("cc-legit-timing-chk")) $("cc-legit-timing-chk").checked = legitAutoTiming;
    if ($("cc-hesitation-chk")) $("cc-hesitation-chk").checked = humanHesitationEnabled;
    if ($("cc-t1-limiter-chk")) $("cc-t1-limiter-chk").checked = autoT1LimiterEnabled;
    if ($("cc-t1-limit-slider")) $("cc-t1-limit-slider").value = maxSafeT1Percent;
    if ($("cc-t1-limit-val")) $("cc-t1-limit-val").textContent = `Не выше ${maxSafeT1Percent}%`;

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
    setSelectSafe($("cc-auto-method-select"), autoClickMethod, "bezier_click");
    setSelectSafe($("cc-turn-select"), turnMode, "my");

    setSelectSafe($("cc-vis-theme"), uiTheme, "cyberpunk");
    setSelectSafe($("cc-vis-arrow-style"), arrowStyle, "curved_neon");
    setSelectSafe($("cc-vis-mate-style"), mateStyle, "phonk_skull");
    if ($("cc-vis-scale")) $("cc-vis-scale").value = arrowScale;
    if ($("cc-vis-scale-val")) $("cc-vis-scale-val").textContent = `${arrowScale.toFixed(1)}x`;
    if ($("cc-vis-opacity")) $("cc-vis-opacity").value = arrowOpacity;
    if ($("cc-vis-opacity-val")) $("cc-vis-opacity-val").textContent = `${Math.round(arrowOpacity * 100)}%`;
    if ($("cc-vis-arrows-chk")) $("cc-vis-arrows-chk").checked = showArrows;
    if ($("cc-vis-eval-chk")) $("cc-vis-eval-chk").checked = showEvalBar;
    if ($("cc-vis-phonk-chk")) $("cc-vis-phonk-chk").checked = phonkEditEnabled;
    if ($("cc-rage-rofl-chk")) $("cc-rage-rofl-chk").checked = roflMode;
    if ($("cc-rage-antiban-chk")) $("cc-rage-antiban-chk").checked = safeAntiBanGuard;

    if ($("cc-bg-dim-slider")) $("cc-bg-dim-slider").value = customBgDim;
    if ($("cc-bg-dim-val")) $("cc-bg-dim-val").textContent = `${Math.round(customBgDim * 100)}%`;
    if ($("cc-bg-blur-slider")) $("cc-bg-blur-slider").value = customBgBlur;
    if ($("cc-bg-blur-val")) $("cc-bg-blur-val").textContent = `${customBgBlur}px`;

    if ($("cc-mask-enabled-chk")) $("cc-mask-enabled-chk").checked = visualMask.enabled;
    if ($("cc-mask-details-chk")) $("cc-mask-details-chk").checked = visualMask.maskDetails;
    if ($("cc-mask-title-chk")) $("cc-mask-title-chk").checked = visualMask.maskPageTitle;
    if ($("cc-mask-hover-chk")) $("cc-mask-hover-chk").checked = visualMask.blockProfileHover;
    if ($("cc-mask-rotate-chk")) $("cc-mask-rotate-chk").checked = visualMask.autoRotateOpponent;
    setSelectSafe($("cc-mask-style-select"), visualMask.style, "broadcast");
    setSelectSafe($("cc-mask-my-preset"), visualMask.myPresetId, "custom");
    setSelectSafe($("cc-mask-opponent-preset"), visualMask.opponentPresetId, "custom");
    setSelectSafe($("cc-mask-my-title"), visualMask.my.title, "");
    setSelectSafe($("cc-mask-opponent-title"), visualMask.opponent.title, "");
    if ($("cc-mask-my-name")) $("cc-mask-my-name").value = visualMask.my.nickname;
    if ($("cc-mask-opponent-name")) $("cc-mask-opponent-name").value = visualMask.opponent.nickname;
    if ($("cc-mask-my-elo")) $("cc-mask-my-elo").value = visualMask.my.elo;
    if ($("cc-mask-opponent-elo")) $("cc-mask-opponent-elo").value = visualMask.opponent.elo;
    const preview = $("cc-mask-preview");
    if (preview) preview.setAttribute("data-mask-style", visualMask.style);
    if ($("cc-mask-preview-my-name")) $("cc-mask-preview-my-name").textContent = `${visualMask.my.title ? `${visualMask.my.title} ` : ""}${visualMask.my.nickname}`;
    if ($("cc-mask-preview-my-elo")) $("cc-mask-preview-my-elo").textContent = `${visualMask.my.elo}`;
    if ($("cc-mask-preview-opponent-name")) $("cc-mask-preview-opponent-name").textContent = `${visualMask.opponent.title ? `${visualMask.opponent.title} ` : ""}${visualMask.opponent.nickname}`;
    if ($("cc-mask-preview-opponent-elo")) $("cc-mask-preview-opponent-elo").textContent = `${visualMask.opponent.elo}`;
    const privacyApi = window.ChessCoachPrivacyMask;
    if ($("cc-mask-preview-my-avatar")) $("cc-mask-preview-my-avatar").src = visualMask.my.avatarUrl || privacyApi?.makeGeneratedAvatar(visualMask.my.nickname) || "";
    if ($("cc-mask-preview-opponent-avatar")) $("cc-mask-preview-opponent-avatar").src = visualMask.opponent.avatarUrl || privacyApi?.makeGeneratedAvatar(visualMask.opponent.nickname) || "";
    if ($("cc-mask-preview-my-flag")) $("cc-mask-preview-my-flag").textContent = privacyApi?.countryCodeToEmoji(visualMask.my.countryCode) || "♟";
    if ($("cc-mask-preview-opponent-flag")) $("cc-mask-preview-opponent-flag").textContent = privacyApi?.countryCodeToEmoji(visualMask.opponent.countryCode) || "♟";
    updatePrivacyMaskStatus();

    getShadow().querySelectorAll(".cc-style-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === currentStyle);
    });
  }

  let lastStatusString = "";
  function setAutoStatusText(text, color = "#00f5d4") {
    if (text === lastStatusString) return;
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

  function clearPositionPresentation(label = "СИНХРОНИЗАЦИЯ ПОЗИЦИИ...") {
    if (autoMoveTimer) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
    cachedMoves = { best: null, average: null, worst: null, heatmap: [], boardKey: "", positionId: -1, qualityRank: -1 };
    committedBoardKey = "";
    committedEnemyBoardKey = "";
    activeEngineBoardKey = "";
    resetTurnDecision();
    hideArrows();
    renderEvalBar(null, 0);
    const activeBox = $("cc-my-turn-active");
    if (activeBox) activeBox.style.display = "flex";
    if ($("cc-best-desc")) $("cc-best-desc").textContent = label;
    if ($("cc-best-eval")) $("cc-best-eval").textContent = "--";
    if ($("cc-best-pv")) $("cc-best-pv").textContent = "Ожидаем стабильную доску";
    if ($("cc-avg-box")) $("cc-avg-box").style.display = "none";
    if ($("cc-worst-box")) $("cc-worst-box").style.display = "none";
    for (const id of ["cc-mate-banner", "cc-time-sniper-banner", "cc-roast-box"]) {
      const node = $(id); if (node) node.style.display = "none";
    }
    if ($("cc-opening-name")) $("cc-opening-name").textContent = "◈ ОБНОВЛЕНИЕ ПОЗИЦИИ";
    if ($("cc-opening-plan")) $("cc-opening-plan").textContent = "Ожидаем новый анализ";
    if ($("cc-tele-threats-val")) $("cc-tele-threats-val").textContent = "Синхронизация позиции...";
    lastTelemetryData = null;
    updateEvalMoodAndEngineBadge(null, null);
  }

  function markBoardDirty(reason = "DOM") {
    if (boardDirty) {
      if (reason === "BOARD_REPLACED") {
        analysisRequestId++;
        StockfishWasmEngine.cancel?.();
        clearPositionPresentation("НОВАЯ ДОСКА • СИНХРОНИЗАЦИЯ...");
      }
      return;
    }
    boardDirty = true;
    positionAnalysisId++;
    analysisRequestId++;
    StockfishWasmEngine.cancel?.();
    clearPositionPresentation(reason === "MOVE" ? "ХОД ИЗМЕНИЛСЯ • СИНХРОНИЗАЦИЯ..." : "СИНХРОНИЗАЦИЯ ПОЗИЦИИ...");
  }

  function adoptPositionState(state) {
    if (!state?.positionKey) return null;
    if (state.positionKey !== currentPositionKey) {
      if (currentPositionKey) clearPositionPresentation("НОВАЯ ПОЗИЦИЯ • АНАЛИЗ...");
      currentPositionKey = state.positionKey;
      positionId++;
      positionAnalysisId++;
      analysisRetryCount = 0;
    }
    boardDirty = false;
    state.sessionId = analysisSessionId;
    state.positionId = positionId;
    state.positionKey = currentPositionKey;
    if (window.__CHESSCOACH_BOARD_STATE__) {
      window.__CHESSCOACH_BOARD_STATE__.positionId = positionId;
      window.__CHESSCOACH_BOARD_STATE__.positionKey = currentPositionKey;
    }
    return state;
  }

  function createAnalysisMeta(state, pass, analysisId) {
    return { sessionId: analysisSessionId, positionId: state.positionId, analysisId, requestId: ++positionRequestId, pass, positionKey: state.positionKey, analysisKey: state.boardKey };
  }

  function isCurrentAnalysisMeta(meta) {
    return Boolean(meta && !boardDirty && meta.sessionId === analysisSessionId && meta.positionId === positionId && meta.analysisId === positionAnalysisId && meta.positionKey === currentPositionKey);
  }

  function isCachedAnalysisCurrent(state = null) {
    const hasVisual = Boolean(cachedMoves?.best || cachedMoves?.heatmap?.length);
    if (!currentPositionKey) return Boolean(hasVisual && (!state || !cachedMoves.boardKey || cachedMoves.boardKey === state.boardKey));
    return Boolean(!boardDirty && hasVisual && cachedMoves.positionId === positionId && (!state || state.positionKey === currentPositionKey));
  }

  function forceRecalculate() {
    committedBoardKey = "";
    committedEnemyBoardKey = "";
    positionAnalysisId++;
    resetTurnDecision();
    runCycle(true);
  }

  function switchTab(tabId, saveToStorage = true) {
    const buttons = [...getShadow().querySelectorAll(".cc-tab-btn")];
    const panes = [...getShadow().querySelectorAll(".cc-tab-pane")];
    const isValid = buttons.some(button => button.dataset.tab === tabId) && panes.some(pane => pane.id === `cc-pane-${tabId}`);
    const scriptsPendingInjection = tabId === "scripts" && !isValid;
    const safeTabId = isValid ? tabId : "analyzer";
    activeTabId = scriptsPendingInjection ? "scripts" : safeTabId;
    buttons.forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === safeTabId);
    });
    panes.forEach((p) => {
      p.classList.toggle("active", p.id === `cc-pane-${safeTabId}`);
    });
    if (saveToStorage || (!isValid && !scriptsPendingInjection)) {
      saveSetting({ activeTabId: safeTabId });
    }
    if (safeTabId === "analyzer") {
      renderLiveEvalGraph();
    }
  }

  function buildCurrentConfigPayload(configName = "ChessCom_Legit", includeBg = true) {
    return {
      signature: "CHESSCOACH_CONFIG_V15",
      version: "15.8.0",
      platform: "chess.com",
      name: configName,
      exportedAt: new Date().toISOString(),
      settings: {
        workMode,
        elo: currentElo,
        style: currentStyle,
        showArrows,
        showEvalBar,
        showAverageMove,
        showWorstMove,
        turnMode,
        forcedMyColor,
        useStockfishWasm,
        engineMaxMode,
        trapRadarEnabled,
        audioRadarEnabled,
        heatmapAlwaysOn,
        liveTelemetryEnabled,
        teleShowClocks,
        teleShowEngine,
        teleShowWdl,
        teleShowThreats,
        autoMoveEnabled,
        legitAutoTiming,
        humanHesitationEnabled,
        autoT1LimiterEnabled,
        maxSafeT1Percent,
        autoMoveDelayMs,
        autoMoveJitterMs,
        autoMoveTriggerRate,
        useAverageMoveSometimes,
        averageMoveFrequency,
        protectCriticalMoves,
        autoClickMethod,
        uiTheme,
        arrowStyle,
        arrowScale,
        arrowOpacity,
        phonkEditEnabled,
        mateStyle,
        roflMode,
        safeAntiBanGuard,
        visualMask,
        customBgDataUrl: includeBg ? customBgDataUrl : "",
        customBgDim,
        customBgBlur
      }
    };
  }

  function applyImportedChessConfig(rawObj) {
    if (!rawObj || typeof rawObj !== "object") return false;
    const s = (rawObj.signature === "CHESSCOACH_CONFIG_V15" && rawObj.settings) ? rawObj.settings : rawObj;
    if (!s || typeof s !== "object") return false;
    const knownKeys = [
      "workMode", "elo", "style", "showArrows", "showEvalBar", "showAverageMove", "showWorstMove",
      "turnMode", "forcedMyColor", "useStockfishWasm", "engineMaxMode", "uiTheme", "arrowStyle", "visualMask",
      "autoMoveEnabled", "customBgDataUrl"
    ];
    if (!knownKeys.some(key => Object.prototype.hasOwnProperty.call(s, key))) return false;

    if (s.workMode === "legit" || s.workMode === "all") workMode = s.workMode;
    if (s.elo !== undefined) currentElo = Math.max(400, Math.min(3000, Number(s.elo) || 2400));
    if (typeof s.style === "string" && ALL_STYLE_NAMES[s.style]) currentStyle = s.style;

    if (typeof s.showArrows === "boolean") showArrows = s.showArrows;
    if (typeof s.showEvalBar === "boolean") showEvalBar = s.showEvalBar;
    if (typeof s.showAverageMove === "boolean") showAverageMove = s.showAverageMove;
    if (typeof s.showWorstMove === "boolean") showWorstMove = s.showWorstMove;
    if (["my", "auto", "w", "b"].includes(s.turnMode)) turnMode = s.turnMode;
    if (["auto", "w", "b"].includes(s.forcedMyColor)) forcedMyColor = s.forcedMyColor;

    if (typeof s.useStockfishWasm === "boolean") useStockfishWasm = s.useStockfishWasm;
    if (typeof s.engineMaxMode === "boolean") engineMaxMode = s.engineMaxMode;
    if (typeof s.trapRadarEnabled === "boolean") trapRadarEnabled = s.trapRadarEnabled;
    if (typeof s.audioRadarEnabled === "boolean") audioRadarEnabled = s.audioRadarEnabled;
    if (typeof s.heatmapAlwaysOn === "boolean") heatmapAlwaysOn = s.heatmapAlwaysOn;

    if (typeof s.liveTelemetryEnabled === "boolean") liveTelemetryEnabled = s.liveTelemetryEnabled;
    if (typeof s.teleShowClocks === "boolean") teleShowClocks = s.teleShowClocks;
    if (typeof s.teleShowEngine === "boolean") teleShowEngine = s.teleShowEngine;
    if (typeof s.teleShowWdl === "boolean") teleShowWdl = s.teleShowWdl;
    if (typeof s.teleShowThreats === "boolean") teleShowThreats = s.teleShowThreats;

    if (typeof s.autoMoveEnabled === "boolean") autoMoveEnabled = s.autoMoveEnabled;
    if (typeof s.legitAutoTiming === "boolean") legitAutoTiming = s.legitAutoTiming;
    if (typeof s.humanHesitationEnabled === "boolean") humanHesitationEnabled = s.humanHesitationEnabled;
    if (typeof s.autoT1LimiterEnabled === "boolean") autoT1LimiterEnabled = s.autoT1LimiterEnabled;
    if (s.maxSafeT1Percent !== undefined) maxSafeT1Percent = Math.max(50, Math.min(80, Number(s.maxSafeT1Percent) || 66));
    if (s.autoMoveDelayMs !== undefined) autoMoveDelayMs = Math.max(220, Math.min(2500, Number(s.autoMoveDelayMs) || 540));
    if (s.autoMoveJitterMs !== undefined) autoMoveJitterMs = Math.max(60, Math.min(1000, Number(s.autoMoveJitterMs) || 260));
    if (s.autoMoveTriggerRate !== undefined) autoMoveTriggerRate = Math.max(20, Math.min(100, Number(s.autoMoveTriggerRate) || 85));
    if (typeof s.useAverageMoveSometimes === "boolean") useAverageMoveSometimes = s.useAverageMoveSometimes;
    if (s.averageMoveFrequency !== undefined) averageMoveFrequency = Math.max(10, Math.min(75, Number(s.averageMoveFrequency) || 30));
    if (typeof s.protectCriticalMoves === "boolean") protectCriticalMoves = s.protectCriticalMoves;
    if (s.autoClickMethod === "bezier_click" || s.autoClickMethod === "bezier_drag") {
      autoClickMethod = s.autoClickMethod;
    }

    if (typeof s.uiTheme === "string" && THEME_ACCENT_COLORS[s.uiTheme]) uiTheme = s.uiTheme;
    if (ARROW_STYLE_IDS.has(s.arrowStyle)) arrowStyle = s.arrowStyle;
    if (s.arrowScale !== undefined) arrowScale = Math.max(0.6, Math.min(1.6, Number(s.arrowScale) || 1));
    if (s.arrowOpacity !== undefined) arrowOpacity = Math.max(0.3, Math.min(1, Number(s.arrowOpacity) || 0.88));
    if (typeof s.phonkEditEnabled === "boolean") phonkEditEnabled = s.phonkEditEnabled;
    if (MATE_STYLE_IDS.has(s.mateStyle)) mateStyle = s.mateStyle;
    if (typeof s.roflMode === "boolean") roflMode = s.roflMode;
    if (typeof s.safeAntiBanGuard === "boolean") safeAntiBanGuard = s.safeAntiBanGuard;

    if (typeof s.customBgDataUrl === "string" && (s.customBgDataUrl === "" || s.customBgDataUrl.startsWith("data:image/"))) {
      customBgDataUrl = s.customBgDataUrl;
    }
    if (s.customBgDim !== undefined) customBgDim = Math.max(0.2, Math.min(0.92, Number(s.customBgDim) || 0.72));
    if (s.customBgBlur !== undefined) customBgBlur = Math.max(0, Math.min(16, Number(s.customBgBlur) || 0));
    if (s.visualMask && typeof s.visualMask === "object") visualMask = normalizeVisualMask(s.visualMask);

    if (useStockfishWasm) {
      StockfishWasmEngine.initWorker();
    }

    saveSetting({
      workMode,
      elo: currentElo,
      style: currentStyle,
      showArrows,
      showEvalBar,
      showAverageMove,
      showWorstMove,
      turnMode,
      forcedMyColor,
      useStockfishWasm,
      engineMaxMode,
      trapRadarEnabled,
      audioRadarEnabled,
      heatmapAlwaysOn,
      liveTelemetryEnabled,
      teleShowClocks,
      teleShowEngine,
      teleShowWdl,
      teleShowThreats,
      autoMoveEnabled,
      legitAutoTiming,
      humanHesitationEnabled,
      autoT1LimiterEnabled,
      maxSafeT1Percent,
      autoMoveDelayMs,
      autoMoveJitterMs,
      autoMoveTriggerRate,
      useAverageMoveSometimes,
      averageMoveFrequency,
      protectCriticalMoves,
      autoClickMethod,
      uiTheme,
      arrowStyle,
      arrowScale,
      arrowOpacity,
      phonkEditEnabled,
      mateStyle,
      roflMode,
      safeAntiBanGuard,
      chesscomVisualMaskV1: visualMask,
      customBgDataUrl,
      customBgDim,
      customBgBlur
    });

    applyCustomBackgroundToPanel();
    ensurePrivacyMaskManager();
    privacyMaskManager?.update();
    updateUIValues();
    forceRecalculate();
    return true;
  }

  function ensurePanel() {
    if ($("chesscoach-panel")) return;

    const panel = document.createElement("div");
    panel.id = "chesscoach-panel";
    panel.setAttribute("data-work-mode", workMode);
    panel.innerHTML = `
      <div id="cc-custom-bg-layer"></div>
      <div id="cc-custom-bg-dim"></div>
      <canvas id="cc-neural-canvas"></canvas>

      <div id="chesscoach-header">
        <div class="cc-brand">
          <span class="cc-brand-dot"></span>
          <span>CHESSCOACH // CHESS.COM STEALTH</span>
          <span class="cc-badge" id="cc-elo-badge">${currentElo} ELO</span>
          <span class="cc-engine-power" id="cc-engine-power">JS CORE</span>
          <span class="cc-deep-status" id="cc-deep-status">⚡ ДОРАСЧЕТ...</span>
        </div>
        <div class="cc-header-controls">
          <button class="cc-pill-btn" id="cc-color-pill" title="Быстрое переключение вашего цвета">◈ АВТО</button>
          <button class="cc-pill-btn" id="cc-toggle-btn" title="Свернуть/Развернуть (или клавиша INSERT)">—</button>
        </div>
      </div>

      <!-- ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ CHESS.COM -->
      <div id="cc-mode-switcher-bar">
        <button class="cc-mode-btn" data-mode="hvh" style="opacity:0.35;" title="Режим HvH (Резня) заблокирован на Chess.com для 100% защиты от бана">
          🔒 HvH (БЛОК)
        </button>
        <button class="cc-mode-btn" data-mode="all" title="Расширенный Legit: открывает все тонкие настройки">
          ◈ ВСЕ LEGIT-ОПЦИИ
        </button>
        <button class="cc-mode-btn active" data-mode="legit" title="Максимальный стелс: кривые Безье, авто-лимитер T1% и живые паузы">
          🛡 STEALTH LEGIT
        </button>
      </div>

      <div id="chesscoach-workspace">
        <div class="cc-sidebar">
          <div class="cc-nav-list">
            <button class="cc-tab-btn active" data-tab="analyzer">
              <span class="cc-tab-icon">◈</span> АНАЛИЗ
            </button>
            <button class="cc-tab-btn" data-tab="automove">
              <span class="cc-tab-icon">🛡</span> LEGIT АВТО
            </button>
            <button class="cc-tab-btn" data-tab="rage">
              <span class="cc-tab-icon">⚡</span> ДВИЖОК
            </button>
            <button class="cc-tab-btn" data-tab="visuals">
              <span class="cc-tab-icon">✦</span> ВИЗУАЛ
            </button>
            <button class="cc-tab-btn" data-tab="privacy">
              <span class="cc-tab-icon">◉</span> ЗАПИСЬ
            </button>
            <button class="cc-tab-btn" data-tab="misc">
              <span class="cc-tab-icon">❖</span> БАЗА / КФГ
            </button>
          </div>

          <div class="cc-sidebar-footer">
            <div class="cc-mini-stat">
              <span>ПЛАТФОРМА</span>
              <strong style="color:#38b000;">CHESS.COM</strong>
            </div>
            <div class="cc-mini-stat">
              <span>СТИЛЬ</span>
              <strong id="cc-active-style-stat">Таль</strong>
            </div>
            <div class="cc-mini-stat">
              <span>ХОД ВРУЧНУЮ</span>
              <strong style="color:#00f5d4;">[КЛАВ. X]</strong>
            </div>
            <div class="cc-mini-stat" style="opacity:0.75;">
              <span>КАРТА ДОСКИ</span>
              <strong style="color:#c77dff;">[ALT]</strong>
            </div>
          </div>
        </div>

        <div class="cc-main-view">
          <div class="cc-tab-pane active" id="cc-pane-analyzer">
            <div id="cc-welcome-card">
              <div class="cc-welcome-top">
                <div class="cc-welcome-greeting" id="cc-welcome-greeting">🛡️ Привет, Гроссмейстер! Стелс-модуль Chess.com активен</div>
                <button class="cc-welcome-close" id="cc-welcome-close-btn" title="Скрыть приветствие">✕</button>
              </div>
              <div class="cc-welcome-sub">
                Античит-защита: <strong>Кривые Безье</strong>, <strong>Гауссов разброс</strong> и <strong>Авто-лимитер T1%</strong>. Нажми клавишу <strong>[X]</strong> для одиночного легит-хода!
              </div>
              <div class="cc-welcome-chips">
                <span class="cc-welcome-chip" id="cc-welcome-chip-mode">🛡 Профиль: Stealth Legit</span>
                <span class="cc-welcome-chip" id="cc-welcome-chip-cpu">🎯 T1-Лимитер: <= 66%</span>
                <span class="cc-welcome-chip" id="cc-welcome-chip-wasm">⚡ SF LOCAL + Безье: ВКЛ</span>
              </div>
            </div>

            <!-- РАДАР FAIR PLAY T1% И АНТИ-БАН МЕТРИКА -->
            <div class="cc-glass-card" style="border-left: 3.5px solid #38b000; padding: 8px 11px;">
              <div class="cc-section-title" style="margin-bottom:4px;">
                <span>🛡️ РАДАР АНТИЧИТА (FAIR PLAY T1% MATCH GUARD)</span>
                <span id="cc-antiban-blur-badge" style="font-size:9.5px; color:#94a3b8; font-family:monospace;">Альт-Табы: 0</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong id="cc-antiban-t1-val" style="color:#00f5d4; font-family:monospace; font-size:11px;">🟢 T1: 0% • КАЛИБРОВКА</strong>
                <span style="font-size:9.5px; color:#cbd5e1;">Норма ГМ: 52%–68%</span>
              </div>
              <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; margin-bottom:5px;">
                <div id="cc-antiban-t1-fill" style="width:0%; height:100%; background:#00f5d4; transition:width 0.3s ease;"></div>
              </div>
              <div id="cc-antiban-t1-hint" style="font-size:10px; color:#cbd5e1; line-height:1.3;">
                Авто-лимитер T1% активен: если точность по 1-й линии превысит порог, софт выберет безопасную 2-ю линию.
              </div>
            </div>

            <!-- ЖИВОЕ ПОЛОЖЕНИЕ ПАРТИИ 24/7 -->
            <div id="cc-live-telemetry-card">
              <div class="cc-tele-header">
                <span>📡 ТЕКУЩЕЕ ПОЛОЖЕНИЕ ПАРТИИ (LIVE 24/7)</span>
                <button class="cc-tele-gear-btn" id="cc-tele-gear-btn" title="Настроить отображаемые поля">⚙️ Поля</button>
              </div>
              <div id="cc-tele-settings-drawer">
                <label class="cc-tele-chk-label"><input type="checkbox" id="cc-tele-clocks-chk" checked> ⏱️ Часы игроков</label>
                <label class="cc-tele-chk-label"><input type="checkbox" id="cc-tele-engine-chk" checked> 🛰️ Статус и сервер</label>
                <label class="cc-tele-chk-label"><input type="checkbox" id="cc-tele-wdl-chk" checked> 📊 Шансы победы %</label>
                <label class="cc-tele-chk-label"><input type="checkbox" id="cc-tele-threats-chk" checked> 🪤 Ловушки и маты</label>
              </div>
              <div class="cc-tele-grid">
                <div class="cc-tele-box" id="cc-tele-box-clocks">
                  <div class="cc-tele-box-title">⏱️ ЧАСЫ (МЫ vs ВРАГ)</div>
                  <div class="cc-tele-box-val" id="cc-tele-clocks-val">--:-- vs --:--</div>
                </div>
                <div class="cc-tele-box" id="cc-tele-box-engine">
                  <div class="cc-tele-box-title">🛰️ ДВИЖОК / СТЕЛС</div>
                  <div class="cc-tele-box-val" id="cc-tele-engine-val" style="color:#c77dff;">SF LOCAL • CHESS.COM</div>
                </div>
                <div class="cc-tele-box" id="cc-tele-box-wdl" style="grid-column: span 2;">
                  <div class="cc-tele-box-title" style="display:flex; justify-content:space-between;">
                    <span>📊 ШАНСЫ НА ПОБЕДУ (WDL ПРОГНОЗ)</span>
                    <span id="cc-tele-wdl-val">Поб: 50% • Нич: 30% • Пор: 20%</span>
                  </div>
                  <div class="cc-wdl-bar">
                    <div class="cc-wdl-w" id="cc-wdl-fill-w" style="width:50%;"></div>
                    <div class="cc-wdl-d" id="cc-wdl-fill-d" style="width:30%;"></div>
                    <div class="cc-wdl-l" id="cc-wdl-fill-l" style="width:20%;"></div>
                  </div>
                </div>
                <div class="cc-tele-box" id="cc-tele-box-threats" style="grid-column: span 2;">
                  <div class="cc-tele-box-title">🪤 БЛИЖАЙШИЕ ПРОСЧИТАННЫЕ ЛОВУШКИ, УГРОЗЫ И МАТЫ</div>
                  <div class="cc-tele-box-val" id="cc-tele-threats-val" style="color:#ffbe0b; font-family:inherit;">Ожидание хода...</div>
                </div>
              </div>
            </div>

            <div id="cc-peer-detector-banner" style="display:none; background:linear-gradient(135deg, rgba(255,190,11,0.20), rgba(255,42,133,0.20)); border:1.5px solid #ffbe0b; border-radius:12px; padding:8px 12px; color:#fff;">
              <div id="cc-peer-detector-title" style="font-size:11px; font-weight:900; color:#ffbe0b; display:flex; justify-content:space-between; align-items:center;">
                <span>🕵️ ЧИТ-РАДАР: ПОДОЗРЕНИЕ НА СОФТ У СОПЕРНИКА!</span>
                <span style="background:rgba(0,0,0,0.45); padding:1px 6px; border-radius:4px; font-family:monospace;">⚠️ BOT?</span>
              </div>
              <div id="cc-peer-detector-text" style="font-size:11px; color:#f1f5f9; margin-top:2px; font-weight:600; line-height:1.35;">
                Соперник играет по 1-й линии без ошибок.
              </div>
            </div>

            <div id="cc-enemy-turn-standby">
              <div class="cc-standby-icon">⏳</div>
              <div class="cc-standby-title" id="cc-standby-title">Ход соперника...</div>
              <div class="cc-standby-sub" id="cc-standby-sub">
                Слепые премувы отключены для 100% легитности на Chess.com. Телеметрия следит за угрозами!
              </div>
            </div>

            <div id="cc-my-turn-active" style="display:flex; flex-direction:column; gap:7px; flex:1;">
              <div id="cc-mate-banner">
                <div class="cc-mate-title">
                  <span id="cc-mate-banner-title">👑💀 МАТ НА ДОСКЕ!</span>
                  <span style="font-size:16px;">😱😂</span>
                </div>
                <div class="cc-mate-sub" id="cc-mate-banner-text">
                  Соперник зевнул форсированный мат!
                </div>
              </div>

              <div class="cc-glass-card" id="cc-opening-card" style="border-left: 3.5px solid var(--cc-accent);">
                <div class="cc-section-title">
                  <span id="cc-opening-name">◈ ГОТОВ К ПАРТИИ НА CHESS.COM</span>
                  <span id="cc-turn-indicator" style="color:#94a3b8;">ОЖИДАНИЕ</span>
                </div>
                <div id="cc-opening-plan" style="font-size:11px; color:#cbd5e1; line-height:1.36;">
                  Откройте любую партию или бот-матч на Chess.com для мгновенного стелс-анализа.
                </div>
              </div>

              <div id="cc-eval-graph-card">
                <div class="cc-graph-header">
                  <span>📈 ЖИВОЙ ГРАФИК ПЕРЕВЕСА</span>
                  <span class="cc-graph-meta"><span id="cc-eval-mood-label">РАВНО</span><span id="cc-eval-graph-label">0.00</span></span>
                </div>
                <canvas id="cc-eval-graph-canvas" width="410" height="42"></canvas>
              </div>

              <div id="cc-time-sniper-banner">
                <div class="cc-time-sniper-top">
                  <span id="cc-time-sniper-badge">⏱️ СНАЙПЕРСКИЙ ТАЙМ-КОНТРОЛЬ</span>
                  <span id="cc-time-sniper-clocks" style="font-family:monospace; color:#ffbe0b;">--:-- vs --:--</span>
                </div>
                <div id="cc-time-sniper-text">Контроль темпа активен.</div>
              </div>

              <div class="cc-roast-banner" id="cc-roast-box">
                <div class="cc-roast-title">
                  <span id="cc-roast-badge">⚡ РАДАР ОШИБОК СОПЕРНИКА</span>
                  <span>💀</span>
                </div>
                <div id="cc-roast-text">Ожидание хода соперника...</div>
              </div>

              <div class="cc-move-card" id="cc-best-card" style="border-left-color:#00f5d4;">
                <div class="cc-move-header">
                  <span style="color:#00f5d4" id="cc-best-title">✦ ЛУЧШИЙ ХОД (1-Я ЛИНИЯ)</span>
                  <span class="cc-eval" id="cc-best-eval">--</span>
                </div>
                <div id="cc-best-desc">Анализ позиции...</div>
                <div id="cc-best-pv" style="margin-top:3px; font-size:10px; color:var(--cc-accent); font-family:monospace; opacity:0.92;"></div>
              </div>

              <div class="cc-move-card" id="cc-avg-card" style="border-left-color:#ffbe0b;">
                <div class="cc-move-header">
                  <span style="color:#ffbe0b">❖ СРЕДНИЙ ХОД (2-Я ЛИНИЯ • РАЗБАВКА T1%)</span>
                  <span class="cc-eval" id="cc-avg-eval">--</span>
                </div>
                <div id="cc-avg-desc">Анализ безопасной человеческой альтернативы...</div>
              </div>

              <div class="cc-move-card cc-hide-in-legit" id="cc-worst-card" style="border-left-color:#ff2a85;">
                <div class="cc-move-header">
                  <span style="color:#ff2a85">✖ ХУДШИЙ ХОД (ЗЕВОК)</span>
                  <span class="cc-eval" id="cc-worst-eval">--</span>
                </div>
                <div id="cc-worst-desc">Проверка угроз...</div>
              </div>
            </div>

            <div class="cc-actions-bar">
              <button class="cc-btn cc-btn-primary" id="cc-play-once" title="Или нажмите клавишу [X] на клавиатуре">⚡ ХОД ПО БЕЗЬЕ [X]</button>
              <button class="cc-btn" id="cc-toggle-auto">🛡 LEGIT АВТО: ВЫКЛ</button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-automove">
            <div class="cc-auto-status-box">
              <span>Статус Stealth-Автохода:</span>
              <strong id="cc-auto-live-status" style="color:#00f5d4;">Готов (Кривые Безье)</strong>
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #38b000; background: linear-gradient(135deg, rgba(56,176,0,0.16), rgba(0,245,212,0.08));">
              <div class="cc-section-title" style="color:#70e000;">
                <span>🛡️ СИСТЕМА АНТИ-БАНА CHESS.COM (FAIR PLAY BYPASS)</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <div>
                  <span style="font-weight:800; color:#fff;">🎯 Авто-лимитер совпадений T1% (Анти-Детект)</span>
                  <div style="font-size:10px; color:#cbd5e1;">Если ваш T1% превышает норму, бот сам выбирает безопасную 2-ю линию</div>
                </div>
                <input type="checkbox" id="cc-t1-limiter-chk" checked>
              </div>
              <div class="cc-control-row" style="margin-top:5px;">
                <span>Максимально допустимый T1% в партии:</span>
                <strong id="cc-t1-limit-val" style="color:#70e000;">Не выше 66%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-t1-limit-slider" min="50" max="80" step="2" value="66" style="accent-color:#38b000;">

              <div class="cc-Switch-row" style="margin-top:4px;">
                <div>
                  <span style="font-weight:800; color:#fff;">🧠 Имитация раздумий в сложной тактике</span>
                  <div style="font-size:10px; color:#cbd5e1;">Добавляет живую паузу расчета (1.5–3.2с) перед трудными ходами</div>
                </div>
                <input type="checkbox" id="cc-hesitation-chk" checked>
              </div>

              <div class="cc-Switch-row">
                <div>
                  <span style="font-weight:800; color:#fff;">⏱️ Адаптивный тайминг по часам (10+0 / 3+0 / 1+0)</span>
                  <div style="font-size:10px; color:#cbd5e1;">Плавающий человеческий ритм + быстрые очевидные перебои</div>
                </div>
                <input type="checkbox" id="cc-legit-timing-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🤖 Включить мягкий Legit-Автоход</span>
                <input type="checkbox" id="cc-auto-master-chk">
              </div>

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Базовая задержка (если выкл. авто-тайминг):</span>
                <strong id="cc-auto-delay-val" style="color:var(--cc-accent);">0.54 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-delay-slider" min="220" max="2500" step="20" value="540">

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Разброс времени руки (Humanizer):</span>
                <strong id="cc-auto-jitter-val" style="color:var(--cc-accent);">±0.26 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-jitter-slider" min="60" max="1000" step="20" value="260">

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Частота срабатывания (остальные ходы — сами):</span>
                <strong id="cc-auto-rate-val" style="color:var(--cc-accent);">85% ходов</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-rate-slider" min="20" max="100" step="5" value="85">
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #ffbe0b;">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>🎭 Подмешивать Средний ход (2-ю линию)</span>
                <input type="checkbox" id="cc-auto-avg-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Базовый шанс 2-й линии:</span>
                <strong id="cc-auto-avg-freq-val" style="color:#ffbe0b;">30%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-avg-freq-slider" min="10" max="75" step="5" value="30" style="accent-color:#ffbe0b;">

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Страховка: только 1-я линия при Мате и спасении фигур</span>
                <input type="checkbox" id="cc-auto-protect-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:5px; margin-bottom:0;">
                <span>Биометрия мыши:</span>
                <select class="cc-select" id="cc-auto-method-select" style="width:225px;">
                  <option value="bezier_click" selected>🎯 Дуга Безье + 2-Клик (Гаусс)</option>
                  <option value="bezier_drag">🖐 Дуга Безье + Перетаскивание</option>
                </select>
              </div>
            </div>

            <div class="cc-actions-bar">
              <button class="cc-btn cc-btn-primary" id="cc-auto-test-best">⚡ Сходить 1-й линией</button>
              <button class="cc-btn" id="cc-auto-test-avg" style="border-color:#ffbe0b; color:#ffbe0b;">❖ Сходить 2-й линией</button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-rage">
            <div class="cc-glass-card">
              <div class="cc-control-row">
                <span style="font-weight:800;">ЦЕЛЕВОЙ УРОВЕНЬ ИГРЫ (400 – 3000 ELO)</span>
                <strong id="cc-elo-val" style="color:var(--cc-accent);">${currentElo} ELO</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-elo-slider" min="400" max="3000" step="100" value="${currentElo}">
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>🧠 ГИБРИДНЫЙ STOCKFISH 19 LOCAL + ТЕЛЕМЕТРИЯ 24/7</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>🧠 Фоновый WebWorker Stockfish 19 Local</span>
                <input type="checkbox" id="cc-sf-wasm-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>♚ ENGINE MAX: primary SF без T1/average/humanization</span>
                <input type="checkbox" id="cc-engine-max-chk">
              </div>
              <div class="cc-Switch-row">
                <span>📡 Положение партии 24/7 (Часы, WDL%, Угрозы)</span>
                <input type="checkbox" id="cc-live-telemetry-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>🪤 Радар ловушек (Подсветка хитрых ходов)</span>
                <input type="checkbox" id="cc-trap-radar-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>🔊 Тактический аудио-радар (Пинг зевков врага и Мата)</span>
                <input type="checkbox" id="cc-audio-radar-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #00f5d4;">
              <div class="cc-section-title">
                <span>🚀 ЛИНИИ АНАЛИЗА</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>❖ Показывать и считать Средний ход (2-я линия)</span>
                <input type="checkbox" id="cc-show-avg-chk" checked>
              </div>
              <div class="cc-Switch-row cc-hide-in-legit">
                <span>✖ Показывать и считать Худший ход (Анти-зевок)</span>
                <input type="checkbox" id="cc-show-worst-chk">
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚡ ВЫБОР СТИЛЯ ИГРЫ (11 ЛЕГЕНД)</span></div>
              <div class="cc-style-grid">
                <button class="cc-style-btn" data-style="mogging"><span>⚡ Моггинг</span><small>ДОМИНАЦИЯ</small></button>
                <button class="cc-style-btn active" data-style="tal"><span>✦ Михаил Таль</span><small>ЖЕРТВЫ</small></button>
                <button class="cc-style-btn" data-style="alphazero"><span>🧠 AlphaZero</span><small>НЕЙРОСЕТЬ</small></button>
                <button class="cc-style-btn" data-style="morphy"><span>🎭 Пол Морфи</span><small>ГЕНИЙ ТЕМПА</small></button>
                <button class="cc-style-btn" data-style="hikaru"><span>🚀 Накамура</span><small>КОРОЛЬ БЛИЦА</small></button>
                <button class="cc-style-btn" data-style="kasparov"><span>▲ Каспаров</span><small>АТАКА</small></button>
                <button class="cc-style-btn" data-style="fischer"><span>◈ Фишер</span><small>ТОЧНОСТЬ</small></button>
                <button class="cc-style-btn" data-style="carlsen"><span>❖ Карлсен</span><small>ТЕХНИКА</small></button>
                <button class="cc-style-btn" data-style="solid"><span>🛡 Карпов</span><small>ЗАЖИМ</small></button>
                <button class="cc-style-btn" data-style="botvinnik"><span>🏛 Ботвинник</span><small>ПАТРИАРХ</small></button>
                <button class="cc-style-btn" data-style="balanced" style="grid-column: span 2;">
                  <span>⚙ Stockfish Cloud + Syzygy</span><small>МАКСИМУМ</small>
                </button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚙ РЕЖИМ РАБОТЫ</span></div>
              <div class="cc-control-row" style="margin-bottom:6px;">
                <span>Когда считать:</span>
                <select class="cc-select" id="cc-turn-select" style="width:200px;">
                  <option value="my" selected>Только в мой ход</option>
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
                <span>🛡 Отключать Автоход в Rated-играх (только подсказки)</span>
                <input type="checkbox" id="cc-rage-antiban-chk">
              </div>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-visuals">
            <div class="cc-glass-card" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>🖼️ СВОЕ ФОТО НА ФОН МЕНЮ (ВЫБОР ИЗ ПРОВОДНИКА)</span>
              </div>
              <div class="cc-actions-bar" style="margin-bottom:7px;">
                <button class="cc-btn cc-btn-primary" id="cc-upload-bg-btn">📂 ВЫБРАТЬ ФОТО...</button>
                <button class="cc-btn cc-btn-danger" id="cc-clear-bg-btn">🗑 СБРОСИТЬ ФОН</button>
              </div>
              <input type="file" id="cc-bg-file-input" accept="image/*" style="display:none;" />
              <div class="cc-control-row">
                <span>Затемнение фото:</span>
                <strong id="cc-bg-dim-val" style="color:#c77dff;">72%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-bg-dim-slider" min="0.2" max="0.92" step="0.04" value="0.72" style="accent-color:#c77dff;">
              <div class="cc-control-row" style="margin-top:5px;">
                <span>Размытие фона (Glass Blur):</span>
                <strong id="cc-bg-blur-val" style="color:#c77dff;">4px</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-bg-blur-slider" min="0" max="16" step="1" value="4" style="accent-color:#c77dff;">
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>✦ ТЕМА МЕНЮ (11 СТИЛЕЙ VISION GLASS)</span></div>
              <select class="cc-select" id="cc-vis-theme">
                <option value="cyberpunk">🌌 Liquid Cyan Wave (Неоновая волна)</option>
                <option value="minimal">⚪ Pure Minimal (Чистый минимализм)</option>
                <option value="aurora">🌌 Aurora 3D Glass (Северное сияние)</option>
                <option value="hologram">🔮 Hologram Violet (Голограмма)</option>
                <option value="crimson">🔥 Crimson Rose (Агрессивный рубин)</option>
                <option value="gold">👑 Royal Gold (Королевское золото)</option>
                <option value="matrix">🧪 Matrix Toxic (Кибер-Матрица)</option>
                <option value="titanium">❄️ Vision Pro Titanium (Матовый титан)</option>
                <option value="obsidian">🌑 Obsidian Stealth (Темный обсидиан)</option>
                <option value="nebula">🌠 Nebula Director (Космическая студия)</option>
                <option value="grandmaster">♛ Grandmaster Club (Изумруд и золото)</option>
              </select>
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid var(--cc-accent);">
              <div class="cc-section-title"><span>◈ ТИП УКАЗАТЕЛЯ ХОДА (16 ВАРИАЦИЙ: КВАДРАТЫ И СТРЕЛКИ)</span></div>
              <select class="cc-select" id="cc-vis-arrow-style" style="margin-bottom:7px;">
                <optgroup label="🔲 БЕЗ СТРЕЛОК (ВЫДЕЛЕНИЕ КВАДРАТИКОВ ХОДА)">
                  <option value="sq_cyber_frame">🔲 Неоновые рамки клеток (ОТКУДА ➔ КУДА)</option>
                  <option value="sq_Step_badges">🎯 Тактические метки [1: СТАРТ] ➔ [2: ЦЕЛЬ]</option>
                  <option value="sq_hologram_tiles">💠 Голографическая заливка квадратов + Прицел</option>
                  <option value="sq_minimal_dots">⚫ Стелс-точки Pro (Без стрелок)</option>
                </optgroup>
                <optgroup label="🏹 ВЕКТОРНЫЕ И 3D СТРЕЛКИ (12 СТИЛЕЙ)">
                  <option value="curved_neon">🌈 Плавная неоновая дуга с потоком</option>
                  <option value="comet_trail">☄️ Огненная комета с градиентным хвостом</option>
                  <option value="cyber_chevron">⏩ Тактический конвейер шевронов (>>>)</option>
                  <option value="quantum_portal">🌀 Квантовый телепорт (Порталы на клетках)</option>
                  <option value="tube_3d">🧊 3D Объемная трубка с падающей тенью</option>
                  <option value="plasma">⚡ Плазменная молния-зигзаг</option>
                  <option value="sniper_3d">🎯 3D Снайперский радар-прицел</option>
                  <option value="dna_wave">🧬 Двойная кибер-волна ДНК</option>
                  <option value="chroma_rgb">🌈 Chroma RGB Перелив</option>
                  <option value="laser">⚡ Прямой кибер-лазер</option>
                  <option value="classic">♟️ Классическая прямая</option>
                  <option value="dotted">✨ Тактический пунктир</option>
                </optgroup>
              </select>

              <div class="cc-control-row" style="margin-bottom:6px;">
                <span>Стиль «Мата в 1 ход»:</span>
                <select class="cc-select" id="cc-vis-mate-style" style="width:225px;">
                  <option value="phonk_skull">💀 Phonk Skull Mogging</option>
                  <option value="orbital_laser">🛸 Орбитальный Кибер-Лазер</option>
                  <option value="royal_exec">👑 Королевский Приговор</option>
                  <option value="rofl_classic">😂 Классический Рофл</option>
                </select>
              </div>

              <div class="cc-control-row">
                <span>Масштаб стрелок и рамок:</span>
                <strong id="cc-vis-scale-val" style="color:var(--cc-accent);">1.0x</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-vis-scale" min="0.6" max="1.6" step="0.1" value="1.0">

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Яркость / Прозрачность:</span>
                <strong id="cc-vis-opacity-val" style="color:var(--cc-accent);">88%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-vis-opacity" min="0.3" max="1.0" step="0.05" value="0.88">
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #ff2a85;">
              <div class="cc-section-title" style="color:#ff4d94;">
                <span>🔥 ТЕПЛОВАЯ КАРТА КОНТРОЛЯ И СПЕЦЭФФЕКТЫ</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>🗺️ Постоянная тепловая карта доски (Иначе — зажатие [Alt])</span>
                <input type="checkbox" id="cc-heatmap-always-chk">
              </div>
              <div class="cc-Switch-row">
                <span>🔥 Эдит Бриллиантовому Ходу (15 сек Phonk)</span>
                <input type="checkbox" id="cc-vis-phonk-chk">
              </div>
              <div class="cc-Switch-row">
                <span>Показывать подсказки на доске</span>
                <input type="checkbox" id="cc-vis-arrows-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Боковая шкала оценки (Eval Bar)</span>
                <input type="checkbox" id="cc-vis-eval-chk" checked>
              </div>
              <button class="cc-btn cc-btn-primary" id="cc-test-phonk-btn" style="width:100%; margin-top:6px;">
                🔥 ТЕСТ ФОНК-ЭДИТА (15 СЕК)
              </button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-privacy">
            <div class="cc-mask-hero">
              <div>
                <strong>◉ STREAMER MASK // РЕЖИМ ЗАПИСИ</strong>
                <span>Реальные данные остаются в Chess.com и только визуально скрываются на экране.</span>
              </div>
              <span id="cc-mask-status">ВЫКЛЮЧЕНА</span>
            </div>

            <div class="cc-glass-card" style="border-left:3.5px solid #67e8f9;">
              <div class="cc-Switch-row" style="padding-top:0;">
                <div>
                  <span style="font-weight:900;color:#fff;">Включить маскировку для записи</span>
                  <div style="font-size:9.5px;color:#94a3b8;">Ctrl + Shift + M — мгновенное включение/выключение</div>
                </div>
                <input type="checkbox" id="cc-mask-enabled-chk">
              </div>
              <div class="cc-control-row" style="margin-top:6px;">
                <span>Стиль карточек:</span>
                <select class="cc-select" id="cc-mask-style-select" style="width:220px;">
                  <option value="broadcast">🌌 Broadcast Neon</option>
                  <option value="royal">♛ Royal Grandmaster</option>
                  <option value="chesscom">♟ Chess.com Original</option>
                </select>
              </div>
            </div>

            <div class="cc-mask-preview" id="cc-mask-preview" data-mask-style="broadcast">
              <div class="cc-mask-preview-label">ПРЕДПРОСМОТР ТРАНСЛЯЦИИ</div>
              <div class="cc-mask-preview-player opponent">
                <img class="cc-mask-preview-avatar" id="cc-mask-preview-opponent-avatar" alt="">
                <div class="cc-mask-preview-identity"><span id="cc-mask-preview-opponent-name">GM Hikaru</span><small id="cc-mask-preview-opponent-flag">🇺🇸</small><strong id="cc-mask-preview-opponent-elo">2802</strong></div>
              </div>
              <div class="cc-mask-preview-vs">VS</div>
              <div class="cc-mask-preview-player my">
                <img class="cc-mask-preview-avatar" id="cc-mask-preview-my-avatar" alt="">
                <div class="cc-mask-preview-identity"><span id="cc-mask-preview-my-name">GM HiddenKnight</span><small id="cc-mask-preview-my-flag">♟</small><strong id="cc-mask-preview-my-elo">2400</strong></div>
              </div>
            </div>

            <div class="cc-mask-editor-grid">
              <div class="cc-glass-card cc-mask-editor-card">
                <div class="cc-section-title"><span>ВАШ ПРОФИЛЬ / АВТООПРЕДЕЛЕНИЕ</span></div>
                <select class="cc-select" id="cc-mask-my-preset">${getPrivacyProfileOptions()}</select>
                <label class="cc-mask-field">Ник<input class="cc-text-input" id="cc-mask-my-name" maxlength="32" value="HiddenKnight"></label>
                <div class="cc-mask-field-row">
                  <label class="cc-mask-field">ELO<input class="cc-text-input" type="number" id="cc-mask-my-elo" min="0" max="9999" value="2400"></label>
                  <label class="cc-mask-field">Титул<select class="cc-select" id="cc-mask-my-title"><option value="">—</option><option value="GM">GM</option><option value="IM">IM</option><option value="FM">FM</option><option value="CM">CM</option><option value="WGM">WGM</option></select></label>
                </div>
              </div>

              <div class="cc-glass-card cc-mask-editor-card">
                <div class="cc-section-title"><span>ПРОФИЛЬ СОПЕРНИКА</span></div>
                <select class="cc-select" id="cc-mask-opponent-preset">${getPrivacyProfileOptions()}</select>
                <label class="cc-mask-field">Ник<input class="cc-text-input" id="cc-mask-opponent-name" maxlength="32" value="GMHikaru"></label>
                <div class="cc-mask-field-row">
                  <label class="cc-mask-field">ELO<input class="cc-text-input" type="number" id="cc-mask-opponent-elo" min="0" max="9999" value="2802"></label>
                  <label class="cc-mask-field">Титул<select class="cc-select" id="cc-mask-opponent-title"><option value="">—</option><option value="GM">GM</option><option value="IM">IM</option><option value="FM">FM</option><option value="CM">CM</option><option value="WGM">WGM</option></select></label>
                </div>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row" style="padding-top:0;"><span>Подменять аватар, флаг и скрывать flair</span><input type="checkbox" id="cc-mask-details-chk" checked></div>
              <div class="cc-Switch-row"><span>Маскировать заголовок вкладки браузера</span><input type="checkbox" id="cc-mask-title-chk" checked></div>
              <div class="cc-Switch-row"><span>Блокировать hover-карточки реальных профилей</span><input type="checkbox" id="cc-mask-hover-chk" checked></div>
              <div class="cc-Switch-row"><span>Новый случайный GM-соперник при новой партии</span><input type="checkbox" id="cc-mask-rotate-chk"></div>
            </div>

            <div class="cc-actions-bar cc-mask-actions">
              <button class="cc-btn" id="cc-mask-random-btn">🎲 СЛУЧАЙНЫЙ GM</button>
              <button class="cc-btn" id="cc-mask-swap-btn">⇄ ПОМЕНЯТЬ МЕСТАМИ</button>
              <button class="cc-btn cc-btn-primary" id="cc-mask-reveal-btn" style="grid-column:span 2;">👁 УДЕРЖИВАТЬ: ПОКАЗАТЬ ОРИГИНАЛ</button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-misc">
            <!-- СИСТЕМА КОНФИГОВ (.CHESS) -->
            <div class="cc-glass-card" style="border-left: 3.5px solid #00f5d4; background: linear-gradient(135deg, rgba(0, 245, 212, 0.12), rgba(199, 125, 255, 0.08));">
              <div class="cc-section-title">
                <span>⚙️ СИСТЕМА КОНФИГОВ (.CHESS)</span>
                <span id="cc-cfg-status-badge" style="color:#00f5d4; font-size:9.5px;">ГОТОВ</span>
              </div>
              <div style="font-size:10.5px; color:#cbd5e1; margin-bottom:7px; line-height:1.35;">
                Сохраняйте свои Legit-настройки и обои в файл <strong>.chess</strong> или загружайте чужие конфиги:
              </div>
              <div class="cc-control-row" style="margin-bottom:6px;">
                <span>Название конфига:</span>
                <input type="text" id="cc-cfg-name-input" placeholder="Например: ChessCom_Stealth" value="ChessCom_Stealth"
                       style="width:190px; background:rgba(10,13,20,0.95); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:7px; padding:4px 8px; font-size:11px; font-weight:700; outline:none;" />
              </div>
              <div class="cc-Switch-row" style="padding:3px 0 7px 0; border:none;">
                <span style="font-size:10.5px; color:#e2e8f0;">🖼️ Вшивать текущее фото фона в файл .chess</span>
                <input type="checkbox" id="cc-cfg-include-bg-chk" checked>
              </div>
              <div class="cc-actions-bar">
                <button class="cc-btn cc-btn-primary" id="cc-export-cfg-btn">💾 СКАЧАТЬ .CHESS</button>
                <button class="cc-btn" id="cc-import-cfg-btn" style="border-color:#c77dff; color:#c77dff;">📂 ЗАГРУЗИТЬ .CHESS</button>
              </div>
              <input type="file" id="cc-import-cfg-input" style="display:none;" />
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>❖ РУЧНОЕ ОБУЧЕНИЕ БОТА</span></div>
              <div class="cc-actions-bar">
                <button class="cc-btn" id="cc-train-good">👍 ЗАКРЕПИТЬ ХОД</button>
                <button class="cc-btn cc-btn-danger" id="cc-train-bad">👎 ЗАБАНИТЬ ХОД</button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>◈ БАЗА САМООБУЧЕНИЯ (EXPERIENCE DB)</span></div>
              <div id="cc-misc-db-summary" style="font-size:11.5px; color:#e2e8f0; margin-bottom:8px;">
                Выучено позиций в памяти: 0
              </div>
              <div class="cc-actions-bar" style="margin-bottom:7px;">
                <button class="cc-btn" id="cc-export-db">📥 ЭКСПОРТ (.JSON)</button>
                <button class="cc-btn" id="cc-import-db">📤 ИМПОРТ (.JSON)</button>
              </div>
              <input type="file" id="cc-import-file-input" accept=".json" style="display:none;" />
              <button class="cc-btn cc-btn-danger" id="cc-clear-db" style="width:100%;">
                🗑 ПОЛНОСТЬЮ ОЧИСТИТЬ ПАМЯТЬ
              </button>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>👋 ПРИВЕТСТВЕННЫЙ ЭКРАН И СБРОС ПОЗИЦИИ ОКНА</span></div>
              <div class="cc-actions-bar">
                <button class="cc-btn" id="cc-restore-welcome-btn">
                  ✨ Показать приветствие
                </button>
                <button class="cc-btn" id="cc-reset-pos-btn">
                  📍 Сбросить позицию меню
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    getShadow().appendChild(panel);
    initNeuralCanvasBackground(panel);
    applyCustomBackgroundToPanel();
    applyPersistentPanelGeometry();
    updateUIValues();
    if (uiAbortController) uiAbortController.abort();
    uiAbortController = new AbortController();
    const uiSignal = uiAbortController.signal;
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
      const nx = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - ox));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - oy));
      panel.style.left = `${nx}px`;
      panel.style.top = `${ny}px`;
      panel.style.right = "auto";
      panelLeft = nx;
      panelTop = ny;
    }, { signal: uiSignal });
    window.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        saveSetting({ panelLeft, panelTop });
      }
    }, { signal: uiSignal });

    getShadow().querySelectorAll(".cc-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyWorkModePreset(btn.dataset.mode, true);
      });
    });

    getShadow().querySelectorAll(".cc-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab, true));
    });

    $("cc-toggle-btn").addEventListener("click", () => {
      panelMinimized = !panelMinimized;
      saveSetting({ panelMinimized });
      applyPersistentPanelGeometry();
    });

    window.addEventListener("keydown", (e) => {
      if (extensionInvalidated) return;
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Insert") {
        panelHidden = !panelHidden;
        saveSetting({ panelHidden });
        applyPersistentPanelGeometry();
      }
      if (e.key === "Alt" && !isAltPressed) {
        isAltPressed = true;
        const st = captureBoardState(true);
        if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      }
      // Горячая клавиша [X] / [Ч] для одиночного легит-хода по кривой Безье
      if ((e.key === "x" || e.key === "X" || e.key === "ч" || e.key === "Ч") && !isExecutingMove) {
        const st = captureBoardState(true);
        if (st && !st.animating && cachedMoves.best) {
          const picked = chooseAutoMoveOnce(cachedMoves) || { move: cachedMoves.best, typeLabel: "1-Я ЛИНИЯ" };
          setAutoStatusText(`🎯 Ход по [X]: ${picked.move.from}→${picked.move.to} (${picked.typeLabel})`, "#00f5d4");
          executeMoveOnBoard(picked.move, st, true);
        }
      }
    }, { signal: uiSignal });

    window.addEventListener("keyup", (e) => {
      if (e.key === "Alt" && isAltPressed) {
        isAltPressed = false;
        const st = captureBoardState(true);
        if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      }
    }, { signal: uiSignal });

    window.addEventListener("blur", () => {
      if (uciHistoryList.length > 0 && !gameResultRecorded) {
        legitStats.windowBlursCount++;
        updateLegitAntiBanMeterUI();
      }
      if (isAltPressed) {
        isAltPressed = false;
        const st = captureBoardState(true);
        if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      }
    }, { signal: uiSignal });

    // Управление полями Живой телеметрии 24/7
    $("cc-tele-gear-btn").addEventListener("click", () => {
      const drawer = $("cc-tele-settings-drawer");
      if (drawer) {
        drawer.style.display = drawer.style.display === "grid" ? "none" : "grid";
      }
    });

    $("cc-live-telemetry-chk").addEventListener("change", (e) => {
      liveTelemetryEnabled = e.target.checked;
      saveSetting({ liveTelemetryEnabled });
      updateLiveTelemetryUI();
    });
    $("cc-tele-clocks-chk").addEventListener("change", (e) => {
      teleShowClocks = e.target.checked;
      saveSetting({ teleShowClocks });
      updateLiveTelemetryUI();
    });
    $("cc-tele-engine-chk").addEventListener("change", (e) => {
      teleShowEngine = e.target.checked;
      saveSetting({ teleShowEngine });
      updateLiveTelemetryUI();
    });
    $("cc-tele-wdl-chk").addEventListener("change", (e) => {
      teleShowWdl = e.target.checked;
      saveSetting({ teleShowWdl });
      updateLiveTelemetryUI();
    });
    $("cc-tele-threats-chk").addEventListener("change", (e) => {
      teleShowThreats = e.target.checked;
      saveSetting({ teleShowThreats });
      updateLiveTelemetryUI();
    });

    // Загрузка кастомного фона из Проводника со сжатием через Canvas
    $("cc-upload-bg-btn").addEventListener("click", () => {
      const inp = $("cc-bg-file-input");
      if (inp) inp.click();
    });

    $("cc-bg-file-input").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxW = 900;
          const maxH = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const cnv = document.createElement("canvas");
          cnv.width = w;
          cnv.height = h;
          const ctx = cnv.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          customBgDataUrl = cnv.toDataURL("image/jpeg", 0.82);
          saveSetting({ customBgDataUrl });
          applyCustomBackgroundToPanel();
        };
        img.src = String(ev.target.result || "");
      };
      reader.readAsDataURL(file);
    });

    $("cc-clear-bg-btn").addEventListener("click", () => {
      customBgDataUrl = "";
      saveSetting({ customBgDataUrl: "" });
      applyCustomBackgroundToPanel();
    });

    $("cc-bg-dim-slider").addEventListener("input", (e) => {
      customBgDim = Number(e.target.value);
      updateUIValues();
      applyCustomBackgroundToPanel();
      saveSetting({ customBgDim });
    });

    $("cc-bg-blur-slider").addEventListener("input", (e) => {
      customBgBlur = Number(e.target.value);
      updateUIValues();
      applyCustomBackgroundToPanel();
      saveSetting({ customBgBlur });
    });

    $("cc-welcome-close-btn").addEventListener("click", () => {
      welcomeBannerHidden = true;
      saveSetting({ welcomeBannerHidden: true });
      updateUIValues();
    });

    $("cc-restore-welcome-btn").addEventListener("click", () => {
      welcomeBannerHidden = false;
      saveSetting({ welcomeBannerHidden: false });
      updateUIValues();
      switchTab("analyzer", true);
    });

    $("cc-reset-pos-btn").addEventListener("click", () => {
      panelLeft = null;
      panelTop = null;
      panelMinimized = false;
      panelHidden = false;
      panel.style.left = "auto";
      panel.style.top = "38px";
      panel.style.right = "18px";
      saveSetting({ panelLeft: null, panelTop: null, panelMinimized: false, panelHidden: false });
      applyPersistentPanelGeometry();
    });

    $("cc-color-pill").addEventListener("click", () => {
      if (forcedMyColor === "auto") forcedMyColor = "w";
      else if (forcedMyColor === "w") forcedMyColor = "b";
      else forcedMyColor = "auto";
      saveSetting({ forcedMyColor });
      updateUIValues();
      forceRecalculate();
    });

    const toggleAutoMoveMaster = (newState) => {
      autoMoveEnabled = newState;
      saveSetting({ autoMoveEnabled });
      updateUIValues();
      resetTurnDecision();
      if (autoMoveEnabled) {
        setAutoStatusText("🛡 Stealth-Автоход включен (Кривые Безье + T1 Фильтр)", "#38b000");
        forceRecalculate();
      } else {
        setAutoStatusText("Автоход выключен (Доступен ход по клавише [X])", "#94a3b8");
      }
    };

    $("cc-toggle-auto").addEventListener("click", () => toggleAutoMoveMaster(!autoMoveEnabled));
    $("cc-auto-master-chk").addEventListener("change", (e) => toggleAutoMoveMaster(e.target.checked));

    $("cc-legit-timing-chk").addEventListener("change", (e) => {
      legitAutoTiming = e.target.checked;
      saveSetting({ legitAutoTiming });
      updateUIValues();
    });

    $("cc-hesitation-chk").addEventListener("change", (e) => {
      humanHesitationEnabled = e.target.checked;
      saveSetting({ humanHesitationEnabled });
      updateUIValues();
    });

    $("cc-t1-limiter-chk").addEventListener("change", (e) => {
      autoT1LimiterEnabled = e.target.checked;
      saveSetting({ autoT1LimiterEnabled });
      updateUIValues();
    });

    $("cc-t1-limit-slider").addEventListener("input", (e) => {
      maxSafeT1Percent = Number(e.target.value);
      updateUIValues();
      saveSetting({ maxSafeT1Percent });
    });

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
      forceRecalculate();
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

    $("cc-sf-wasm-chk").addEventListener("change", (e) => {
      useStockfishWasm = e.target.checked;
      if (useStockfishWasm) StockfishWasmEngine.initWorker();
      else StockfishWasmEngine.terminate();
      saveSetting({ useStockfishWasm });
      updateUIValues();
      forceRecalculate();
    });
    $("cc-engine-max-chk").addEventListener("change", (e) => {
      engineMaxMode = e.target.checked;
      if (engineMaxMode) {
        currentElo = 3000;
        currentStyle = "balanced";
        useStockfishWasm = true;
        showAverageMove = false;
        useAverageMoveSometimes = false;
        autoT1LimiterEnabled = false;
        humanHesitationEnabled = false;
        legitAutoTiming = false;
        autoMoveTriggerRate = 100;
        StockfishWasmEngine.initWorker();
      }
      saveSetting({ engineMaxMode, elo: currentElo, style: currentStyle, useStockfishWasm, showAverageMove, useAverageMoveSometimes, autoT1LimiterEnabled, humanHesitationEnabled, legitAutoTiming, autoMoveTriggerRate });
      setAutoStatusText(engineMaxMode ? "♚ ENGINE MAX: ОЖИДАНИЕ PRIMARY STOCKFISH" : "ENGINE MAX ВЫКЛЮЧЕН", engineMaxMode ? "#64cdb9" : "#94a3b8");
      updateUIValues();
      forceRecalculate();
    });

    $("cc-trap-radar-chk").addEventListener("change", (e) => {
      trapRadarEnabled = e.target.checked;
      saveSetting({ trapRadarEnabled });
      updateUIValues();
      forceRecalculate();
    });

    $("cc-audio-radar-chk").addEventListener("change", (e) => {
      audioRadarEnabled = e.target.checked;
      saveSetting({ audioRadarEnabled });
      if (audioRadarEnabled && window.ChessFX) {
        window.ChessFX.playTacticalAudioPing("trap", "");
      }
    });

    $("cc-heatmap-always-chk").addEventListener("change", (e) => {
      heatmapAlwaysOn = e.target.checked;
      saveSetting({ heatmapAlwaysOn });
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
    });

    $("cc-show-avg-chk").addEventListener("change", (e) => {
      showAverageMove = e.target.checked;
      saveSetting({ showAverageMove });
      updateUIValues();
      forceRecalculate();
    });

    $("cc-show-worst-chk").addEventListener("change", (e) => {
      showWorstMove = e.target.checked;
      saveSetting({ showWorstMove });
      updateUIValues();
      forceRecalculate();
    });

    $("cc-play-once").addEventListener("click", () => {
      const state = captureBoardState(true);
      if (state && !state.animating && isCachedAnalysisCurrent(state)) {
        const picked = chooseAutoMoveOnce(cachedMoves) || { move: cachedMoves.best, typeLabel: "1-Я ЛИНИЯ" };
        setAutoStatusText(`🎯 Выполняем ход: ${picked.move.from}→${picked.move.to} [${picked.typeLabel}]`, "#00f5d4");
        executeMoveOnBoard(picked.move, state, true);
      }
    });

    $("cc-auto-test-best").addEventListener("click", () => {
      if (engineMaxMode && !cachedMoves.engineMeta && !cachedMoves.best?.fromSyzygy) {
        setAutoStatusText("♚ ENGINE MAX: дождитесь завершения primary Stockfish", "#d9ad58");
        return;
      }
      const state = captureBoardState(true);
      if (state && !state.animating && isCachedAnalysisCurrent(state)) {
        setAutoStatusText(`Лучший ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true);
      }
    });

    $("cc-auto-test-avg").addEventListener("click", () => {
      if (engineMaxMode) return;
      const state = captureBoardState(true);
      const move = cachedMoves.average || cachedMoves.best;
      if (state && !state.animating && move && isCachedAnalysisCurrent(state)) {
        setAutoStatusText(`Средний ход (2-я линия): ${move.from}→${move.to}`, "#ffbe0b");
        executeMoveOnBoard(move, state, true);
      }
    });

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
      saveSetting({ turnMode });
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
      updateUIValues();
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
    });

    $("cc-vis-mate-style").addEventListener("change", (e) => {
      mateStyle = e.target.value;
      saveSetting({ mateStyle });
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
    });

    $("cc-vis-scale").addEventListener("input", (e) => {
      arrowScale = Number(e.target.value);
      updateUIValues();
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      saveSetting({ arrowScale });
    });

    $("cc-vis-opacity").addEventListener("input", (e) => {
      arrowOpacity = Number(e.target.value);
      updateUIValues();
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      saveSetting({ arrowOpacity });
    });

    $("cc-vis-phonk-chk").addEventListener("change", (e) => {
      phonkEditEnabled = e.target.checked;
      saveSetting({ phonkEditEnabled });
      if (!phonkEditEnabled && window.ChessFX) {
        window.ChessFX.stopPhonkEdit(getShadow());
      }
    });

    $("cc-test-phonk-btn").addEventListener("click", () => {
      if (window.ChessFX) {
        const testMove = (cachedMoves && cachedMoves.best) ? cachedMoves.best : { from: "g5", to: "f7" };
        window.ChessFX.triggerBrilliantPhonkEdit(getShadow(), testMove, captureBoardState(true), 15000, true);
      }
    });

    $("cc-vis-arrows-chk").addEventListener("change", (e) => {
      showArrows = e.target.checked;
      saveSetting({ showArrows });
      const st = captureBoardState(true);
      if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
    });

    $("cc-vis-eval-chk").addEventListener("change", (e) => {
      showEvalBar = e.target.checked;
      saveSetting({ showEvalBar });
      const st = captureBoardState(true);
      if (st && !st.animating) renderEvalBar(st, cachedMoves.best?.whitePerspectiveEval ?? 0);
    });

    $("cc-mask-enabled-chk").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, enabled: e.target.checked });
      persistVisualMask();
    });
    $("cc-mask-style-select").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, style: e.target.value });
      persistVisualMask();
    });
    $("cc-mask-details-chk").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, maskDetails: e.target.checked });
      persistVisualMask();
    });
    $("cc-mask-title-chk").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, maskPageTitle: e.target.checked });
      persistVisualMask();
    });
    $("cc-mask-hover-chk").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, blockProfileHover: e.target.checked });
      persistVisualMask();
    });
    $("cc-mask-rotate-chk").addEventListener("change", (e) => {
      visualMask = normalizeVisualMask({ ...visualMask, autoRotateOpponent: e.target.checked });
      persistVisualMask();
    });
    $("cc-mask-my-preset").addEventListener("change", (e) => applyPrivacyPreset("my", e.target.value));
    $("cc-mask-opponent-preset").addEventListener("change", (e) => applyPrivacyPreset("opponent", e.target.value));

    const bindMaskIdentityField = (role, id, field, eventName = "input") => {
      $(id).addEventListener(eventName, (e) => {
        visualMask = normalizeVisualMask({
          ...visualMask,
          [`${role}PresetId`]: "custom",
          [role]: { ...visualMask[role], [field]: e.target.value }
        });
        previewVisualMaskAndSave();
      });
    };
    bindMaskIdentityField("my", "cc-mask-my-name", "nickname");
    bindMaskIdentityField("my", "cc-mask-my-elo", "elo");
    bindMaskIdentityField("my", "cc-mask-my-title", "title", "change");
    bindMaskIdentityField("opponent", "cc-mask-opponent-name", "nickname");
    bindMaskIdentityField("opponent", "cc-mask-opponent-elo", "elo");
    bindMaskIdentityField("opponent", "cc-mask-opponent-title", "title", "change");

    $("cc-mask-random-btn").addEventListener("click", randomizePrivacyOpponent);
    $("cc-mask-swap-btn").addEventListener("click", () => {
      visualMask = normalizeVisualMask({
        ...visualMask,
        myPresetId: visualMask.opponentPresetId,
        opponentPresetId: visualMask.myPresetId,
        my: visualMask.opponent,
        opponent: visualMask.my
      });
      persistVisualMask();
    });

    const revealButton = $("cc-mask-reveal-btn");
    const setReveal = (revealed) => {
      privacyMaskManager?.setRevealed(revealed);
      revealButton.textContent = revealed ? "👁 ОРИГИНАЛ ПОКАЗАН" : "👁 УДЕРЖИВАТЬ: ПОКАЗАТЬ ОРИГИНАЛ";
      if (!revealed) updatePrivacyMaskStatus();
    };
    revealButton.addEventListener("pointerdown", (e) => { e.preventDefault(); setReveal(true); });
    revealButton.addEventListener("pointerup", () => setReveal(false));
    revealButton.addEventListener("pointercancel", () => setReveal(false));
    revealButton.addEventListener("pointerleave", () => setReveal(false));

    $("cc-train-good").addEventListener("click", () => {
      if (!cachedMoves.best || !cachedMoves.boardKey) return;
      safeSendMessage(
        { type: "TRAIN_MOVE_MANUAL", fenKey: cachedMoves.boardKey, uci: cachedMoves.best.uci, delta: 95 },
        (res) => {
          const btn = $("cc-train-good");
          btn.textContent = "✦ ЗАКРЕПЛЕНО!";
          setTimeout(() => { btn.textContent = "👍 ЗАКРЕПИТЬ ХОД"; }, 800);
          if (res && res.positionsCount !== undefined) {
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          forceRecalculate();
        }
      );
    });

    $("cc-train-bad").addEventListener("click", () => {
      if (!cachedMoves.best || !cachedMoves.boardKey) return;
      safeSendMessage(
        { type: "TRAIN_MOVE_MANUAL", fenKey: cachedMoves.boardKey, uci: cachedMoves.best.uci, delta: -210 },
        (res) => {
          const btn = $("cc-train-bad");
          btn.textContent = "✖ ЗАБАНЕНО!";
          setTimeout(() => { btn.textContent = "👎 ЗАБАНИТЬ ХОД"; }, 800);
          if (res && res.positionsCount !== undefined) {
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          forceRecalculate();
        }
      );
    });

    $("cc-export-db").addEventListener("click", () => {
      safeSendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
        const blob = new Blob([JSON.stringify(res?.experienceDB || {}, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chesscoach-db-${Date.now()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });

    $("cc-import-db").addEventListener("click", () => {
      const inp = $("cc-import-file-input");
      if (inp) inp.click();
    });

    $("cc-import-file-input").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          safeSendMessage({ type: "IMPORT_MEMORY", data: parsed }, (res) => {
            if (res && res.positionsCount !== undefined) {
              $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
            }
          });
        } catch (err) {}
      };
      reader.readAsText(file);
    });

    $("cc-clear-db").addEventListener("click", () => {
      safeSendMessage({ type: "CLEAR_MEMORY" }, () => {
        $("cc-misc-db-summary").textContent = "Выучено позиций в памяти: 0";
      });
    });

    // ЭКСПОРТ И ИМПОРТ КОНФИГОВ (.CHESS)
    $("cc-export-cfg-btn").addEventListener("click", () => {
      const rawName = ($("cc-cfg-name-input")?.value || "ChessCom_Stealth").trim();
      const safeFileName = rawName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, "_") || "ChessCom_Cfg";
      const includeBg = Boolean($("cc-cfg-include-bg-chk")?.checked);

      const payload = buildCurrentConfigPayload(rawName, includeBg);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName}.chess`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const badge = $("cc-cfg-status-badge");
      if (badge) {
        badge.textContent = `💾 ВЫГРУЖЕН: ${safeFileName}.chess`;
        badge.style.color = "#00f5d4";
      }
    });

    $("cc-import-cfg-btn").addEventListener("click", () => {
      const inp = $("cc-import-cfg-input");
      if (inp) {
        inp.value = "";
        inp.click();
      }
    });

    $("cc-import-cfg-input").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          const ok = applyImportedChessConfig(parsed);
          const badge = $("cc-cfg-status-badge");
          if (ok) {
            const cfgTitle = parsed.name || file.name.replace(/\.chess$/i, "");
            if ($("cc-cfg-name-input")) $("cc-cfg-name-input").value = cfgTitle;
            if (badge) {
              badge.textContent = `✅ АКТИВЕН: ${cfgTitle}`;
              badge.style.color = "#38b000";
            }
            setAutoStatusText(`⚙️ Загружен конфиг: ${cfgTitle}`, "#00f5d4");
          } else if (badge) {
            badge.textContent = "❌ ОШИБКА ФАЙЛА .CHESS";
            badge.style.color = "#ff2a85";
          }
        } catch (err) {
          const badge = $("cc-cfg-status-badge");
          if (badge) {
            badge.textContent = "❌ ПОВРЕЖДЕННЫЙ ФАЙЛ";
            badge.style.color = "#ff2a85";
          }
        }
      };
      reader.readAsText(file);
    });
  }

  function isRatedGameAgainstHuman() {
    if (location.pathname.includes("/computer") || location.pathname.includes("/analysis") || location.pathname.includes("/Solo")) {
      return false;
    }
    const botBadge = document.querySelector(".board-layout-top .user-chess-title, [data-cy='bot-selection']");
    if (botBadge && (botBadge.textContent || "").includes("BOT")) return false;
    return true;
  }

  function parseChessComClock(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const raw = (el.innerText || el.textContent || "").trim().replace(/\s+/g, "");
      if (!raw) continue;
      const parts = raw.split(":");
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return mins * 60 + secs;
      }
      if (parts.length === 3) {
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseFloat(parts[2]) || 0;
        return hrs * 3600 + mins * 60 + secs;
      }
    }
    return Number.POSITIVE_INFINITY;
  }

  function getMyRemainingSeconds() {
    return parseChessComClock([
      ".board-layout-bottom .clock-time-monospace",
      ".clock-bottom .clock-time-monospace",
      ".player-bottom .clock-time-monospace",
      "[data-cy='clock-bottom'] .clock-time-monospace"
    ]);
  }

  function getEnemyRemainingSeconds() {
    return parseChessComClock([
      ".board-layout-top .clock-time-monospace",
      ".clock-top .clock-time-monospace",
      ".player-top .clock-time-monospace",
      "[data-cy='clock-top'] .clock-time-monospace"
    ]);
  }

  function formatClockMMSS(sec) {
    if (!Number.isFinite(sec)) return "--:--";
    const s = Math.max(0, sec);
    if (s >= 3600) {
      const hours = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = Math.floor(s % 60);
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    const mins = Math.floor(s / 60);
    const rem = s - mins * 60;
    if (mins === 0 && rem < 10) {
      return `0:${rem.toFixed(1).padStart(4, "0")}`;
    }
    return `${mins}:${Math.floor(rem).toString().padStart(2, "0")}`;
  }

  function updateTimeSniperBanner(res) {
    const banner = $("cc-time-sniper-banner");
    if (!banner) return;

    const mySecs = getMyRemainingSeconds();
    const enemySecs = getEnemyRemainingSeconds();
    const clocksEl = $("cc-time-sniper-clocks");
    if (clocksEl) {
      clocksEl.textContent = `МЫ ${formatClockMMSS(mySecs)} ⚡ ВРАГ ${formatClockMMSS(enemySecs)}`;
    }

    const advice = res?.timeAdvice;
    if (advice) {
      banner.style.display = "block";
      banner.style.borderColor = advice.mode === "zeitnot_attack" ? "#ffbe0b" : (advice.mode === "my_panic" ? "#ff2a85" : "rgba(0, 245, 212, 0.38)");
      if ($("cc-time-sniper-badge")) $("cc-time-sniper-badge").textContent = advice.badge;
      if ($("cc-time-sniper-text")) $("cc-time-sniper-text").textContent = advice.text;
    } else if (enemySecs < 600 || mySecs < 600) {
      banner.style.display = "block";
      banner.style.borderColor = "rgba(0, 245, 212, 0.25)";
      if ($("cc-time-sniper-badge")) $("cc-time-sniper-badge").textContent = "⏱️ LEGIT ТАЙМ-КОНТРОЛЬ CHESS.COM";
      if ($("cc-time-sniper-text")) {
        $("cc-time-sniper-text").textContent =
          enemySecs < 20
            ? "У соперника цейтнот — обостряйте игру!"
            : "Ритм ходов адаптирован под ваши часы для обхода гистограммы Fair Play.";
      }
    } else {
      banner.style.display = "none";
    }
  }

  function updateEvalMoodAndEngineBadge(state, res) {
    const panel = $("chesscoach-panel");
    const moodLabel = $("cc-eval-mood-label");
    const powerBadge = $("cc-engine-power");
    if (!state || !res?.best) {
      if (panel) panel.dataset.evalMood = "neutral";
      if (moodLabel) moodLabel.textContent = "ОЖИДАНИЕ";
      if (powerBadge) {
        powerBadge.textContent = "ENGINE IDLE";
        delete powerBadge.dataset.consensus;
      }
      return;
    }

    let whiteEval = Number(res.best.whitePerspectiveEval);
    if (!Number.isFinite(whiteEval)) {
      const sideEval = Number.parseFloat(res.best.evalPawns);
      whiteEval = Number.isFinite(sideEval) ? (state.sideToAnalyze === "w" ? sideEval : -sideEval) : 0;
    }
    const myEval = state.myColor === "w" ? whiteEval : -whiteEval;
    const mood = res.isDangerPosition || myEval <= -2.5
      ? "critical"
      : myEval >= 0.75 ? "ahead" : myEval <= -0.75 ? "behind" : "neutral";
    if (panel) panel.dataset.evalMood = mood;
    if (moodLabel) {
      moodLabel.textContent = mood === "critical" ? "КРИТИЧНО" : mood === "ahead" ? "ПЕРЕВЕС" : mood === "behind" ? "ПОД ДАВЛЕНИЕМ" : "РАВНО";
    }

    if (powerBadge) {
      const meta = res.engineMeta;
      if (meta) {
        powerBadge.textContent = `${meta.fullNnue ? "SF FULL" : "SF"} ${meta.workers || 1}C · H${meta.hashMb || "?"}M · D${meta.depth || "?"}`;
        powerBadge.title = `${meta.consensus || "primary"} · seldepth ${meta.selDepth || meta.depth || "?"} · NPS ${meta.nps ? Math.round(meta.nps / 1000) + "k" : "—"}`;
        powerBadge.dataset.consensus = meta.consensus || "primary-only";
      } else if (res.best.fromCloud) {
        powerBadge.textContent = `CLOUD · D${res.best.cloudDepth || "?"}`;
        delete powerBadge.dataset.consensus;
      } else {
        powerBadge.textContent = "JS CORE";
        delete powerBadge.dataset.consensus;
      }
    }
  }

  function recordEvalPoint(boardKey, whiteEvalPawns, dropPawns = 0) {
    if (!boardKey) return;
    const parsedEval = Number.parseFloat(whiteEvalPawns);
    const parsedDrop = Number.parseFloat(dropPawns);
    const numEval = Math.max(-10, Math.min(10, Number.isFinite(parsedEval) ? parsedEval : 0));
    const numDrop = Number.isFinite(parsedDrop) ? parsedDrop : 0;

    if (boardKey === lastRecordedGraphBoardKey && evalGraphHistory.length > 0) {
      evalGraphHistory[evalGraphHistory.length - 1] = {
        boardKey,
        evalVal: numEval,
        isBlunder: numDrop >= 1.5,
        drop: numDrop
      };
      renderLiveEvalGraph();
      return;
    }
    lastRecordedGraphBoardKey = boardKey;

    evalGraphHistory.push({
      boardKey,
      evalVal: numEval,
      isBlunder: numDrop >= 1.5,
      drop: numDrop
    });

    if (evalGraphHistory.length > 60) {
      evalGraphHistory.shift();
    }
    renderLiveEvalGraph();
  }

  function renderLiveEvalGraph() {
    const canvas = $("cc-eval-graph-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width || 410;
    const h = canvas.height || 42;
    ctx.clearRect(0, 0, w, h);

    const midY = h / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (evalGraphHistory.length === 0) {
      const emptyLabel = $("cc-eval-graph-label");
      if (emptyLabel) {
        emptyLabel.textContent = "0.00";
        delete emptyLabel.dataset.tone;
      }
      return;
    }

    const lastPt = evalGraphHistory[evalGraphHistory.length - 1];
    const lbl = $("cc-eval-graph-label");
    if (lbl && lastPt) {
      const sign = lastPt.evalVal > 0 ? "+" : "";
      lbl.textContent = `${sign}${lastPt.evalVal.toFixed(2)}`;
      lbl.dataset.tone = lastPt.evalVal >= 0 ? "positive" : "negative";
    }

    const [accent1, accent2] = THEME_ACCENT_COLORS[uiTheme] || THEME_ACCENT_COLORS.cyberpunk;
    const pts = evalGraphHistory.map((item, idx) => {
      const x = evalGraphHistory.length === 1
        ? w / 2
        : 6 + (idx / (evalGraphHistory.length - 1)) * (w - 12);
      const y = midY - (item.evalVal / 10) * (midY - 5);
      return { x, y, isBlunder: item.isBlunder, evalVal: item.evalVal };
    });

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(0, 245, 212, 0.32)");
    grad.addColorStop(0.5, "rgba(0, 187, 249, 0.04)");
    grad.addColorStop(1, "rgba(255, 42, 133, 0.30)");

    ctx.beginPath();
    ctx.moveTo(pts[0].x, midY);
    for (let i = 0; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, midY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = accent1;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = accent1;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.isBlunder) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = "#ff2a85";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (i === pts.length - 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = accent2;
        ctx.fill();
      }
    }
  }

  function hasMyPieceOnSquare(grid, myColor, sq) {
    if (!grid || !sq || sq.length < 2) return false;
    const c = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const p = grid[r][c];
    if (!p) return false;
    return myColor === "w" ? p === p.toUpperCase() : p === p.toLowerCase();
  }

  /**
   * УМНЫЙ ВЫБОР ЛЕГИТНОГО ХОДА С ФИЛЬТРОМ АНТИ-БАНА T1%:
   * Если текущий процент совпадений с 1-й линией Stockfish превышает порог (например, 66%),
   * а 2-я линия безопасна и не теряет больше 0.45 пешки — выбирается 2-я линия.
   */
  function chooseAutoMoveOnce(res) {
    if (!res || !res.best) return null;
    if (engineMaxMode) return { move: res.best, typeLabel: "♚ ENGINE MAX / PRIMARY SF", choiceKind: "engine-max" };

    if (protectCriticalMoves || res.isDangerPosition) {
      if (
        res.isDangerPosition ||
        res.best.isMateInOne ||
        res.best.isForcedMateInTwo ||
        res.best.isCheckmate ||
        res.best.fromSyzygy ||
        res.best.savedHangingPiece ||
        res.hangingSquare
      ) {
        const label = res.isDangerPosition
          ? "🛡 ЗАЩИТА КОРОЛЯ"
          : (res.best.fromSyzygy ? "🔮 SYZYGY" : "1-Я ЛИНИЯ (КРИТ.)");
        return { move: res.best, typeLabel: label, choiceKind: "best" };
      }
    }

    const avgIsSafe = Boolean(
      res.average &&
      res.average.uci !== res.best.uci &&
      !res.average.blundersMate &&
      !res.average.causesStalemate &&
      !res.average.isRepetitionDrawRisk &&
      !res.average.underDirectAttack &&
      !res.average.ignoredHangingPiece &&
      !res.average.ruinedCastling
    );

    if (avgIsSafe) {
      const bestEval = parseFloat(res.best.evalPawns) || 0;
      const avgEval = parseFloat(res.average.evalPawns) || 0;
      const evalDiff = Math.abs(bestEval - avgEval);

      // 1. Принудительное снижение T1% при превышении безопасного порога Chess.com
      if (
        autoT1LimiterEnabled &&
        legitStats.totalMyMoves >= 4 &&
        getT1MatchPercent() > maxSafeT1Percent &&
        bestEval >= avgEval &&
        evalDiff <= 0.48
      ) {
        return { move: res.average, typeLabel: `🛡 T1-ЛИМИТЕР (2-Я ЛИНИЯ)`, choiceKind: "average" };
      }

      // 2. Естественное вероятностное подмешивание 2-й линии
      if (useAverageMoveSometimes && bestEval >= avgEval && evalDiff <= 0.38) {
        if (Math.random() * 100 < averageMoveFrequency) {
          return { move: res.average, typeLabel: "❖ 2-Я ЛИНИЯ (HUMAN)", choiceKind: "average" };
        }
      }
    }

    return { move: res.best, typeLabel: "✦ 1-Я ЛИНИЯ", choiceKind: "best" };
  }

  /**
   * ГЕНЕРАТОР ЧЕЛОВЕЧЕСКИХ ТАЙМИНГОВ ДЛЯ CHESS.COM (ANTI-FLAT HISTOGRAM):
   * Исключает плоскую гистограмму времени: очевидные взятия делаются быстрее,
   * а сложные тактические позиции в миттельшпиле получают естественную паузу размышления.
   */
  function computeLegitHumanDelayMs(moveObj, mySecs, isDanger) {
    const isRecapture = Boolean(
      moveObj &&
      moveObj.captured &&
      lastRealEnemyMove &&
      moveObj.to === lastRealEnemyMove.to
    );
    const isBook = Boolean(moveObj && (moveObj.bookName || uciHistoryList.length <= 6));
    const isTactical = Boolean(
      isDanger ||
      (moveObj && (moveObj.isSacrifice || moveObj.isFork || moveObj.isPin || moveObj.isTrap || moveObj.complexityBranches >= 24))
    );

    let minMs = 380;
    let maxMs = 950;

    if (mySecs > 180) {
      // Рапид (10+0 / 5+0)
      minMs = isRecapture ? 380 : (isBook ? 480 : (isTactical ? 1150 : 680));
      maxMs = isRecapture ? 760 : (isBook ? 980 : (isTactical ? 2450 : 1580));
    } else if (mySecs > 45) {
      // Блиц (3+0 / 3+2)
      minMs = isRecapture ? 270 : (isBook ? 340 : (isTactical ? 680 : 440));
      maxMs = isRecapture ? 540 : (isBook ? 680 : (isTactical ? 1480 : 960));
    } else if (mySecs > 15) {
      // Пуля / малый остаток времени
      minMs = isRecapture ? 180 : 230;
      maxMs = isRecapture ? 350 : (isTactical ? 580 : 460);
    } else {
      // Цейтнот (< 15 сек)
      minMs = 130;
      maxMs = 260;
    }

    const r1 = Math.random();
    const r2 = Math.random();
    let baseDelay = Math.round(minMs + (r1 * 0.6 + r2 * 0.4) * (maxMs - minMs));

    // Симуляция глубокой задумчивости человека в нетривиальных позициях
    if (humanHesitationEnabled && !isRecapture && !isBook && mySecs > 35 && isTactical && Math.random() < 0.38) {
      baseDelay += Math.round(650 + Math.random() * 1100);
    }

    return baseDelay;
  }

  function scheduleAutoMoveIfNeeded() {
    if (!autoMoveEnabled || extensionInvalidated) return;
    if (isExecutingMove || Date.now() < moveCooldownUntil) return;
    if (autoMoveTimer) return;

    const state = captureBoardState(false);
    if (!state || state.animating || state.actualTurn !== state.myColor) return;
    if (boardDirty || state.positionKey !== currentPositionKey || !isCachedAnalysisCurrent(state) || cachedMoves.boardKey !== state.boardKey) return;
    if (engineMaxMode) {
      const finalized = Boolean(cachedMoves.engineMeta || cachedMoves.best.fromSyzygy || (cachedMoves.pass === "deep" && cachedMoves.pieceCount <= 7));
      if (!finalized) {
        setAutoStatusText("♚ ENGINE MAX: ЖДЕМ PRIMARY STOCKFISH...", "#64cdb9");
        return;
      }
    }

    if (currentTurnDecision.boardKey !== state.boardKey || !currentTurnDecision.decided) {
      const triggerRoll = Math.random() * 100;
      if (!engineMaxMode && autoMoveTriggerRate < 100 && triggerRoll > autoMoveTriggerRate) {
        currentTurnDecision = {
          boardKey: state.boardKey,
          decided: true,
          skip: true,
          move: null,
          typeLabel: "ПРОПУСК (САМИ)",
          totalDelay: 0,
          attempts: 0
        };
        setAutoStatusText(`🖐 Пауза автохода (${autoMoveTriggerRate}%) — сходите рукой или нажмите [X]`, "#ffbe0b");
        return;
      }

      const picked = chooseAutoMoveOnce(cachedMoves);
      if (!picked || !picked.move) return;

      const mySecs = getMyRemainingSeconds();
      let totalDelay = 540;
      if (engineMaxMode) {
        totalDelay = 130 + Math.floor(Math.random() * 46);
      } else if (legitAutoTiming) {
        totalDelay = computeLegitHumanDelayMs(picked.move, mySecs, cachedMoves.isDangerPosition);
      } else {
        const jitter = autoMoveJitterMs > 0 ? Math.round((Math.random() * 2 - 1) * autoMoveJitterMs) : 0;
        totalDelay = Math.max(200, autoMoveDelayMs + jitter);
      }

      currentTurnDecision = {
        boardKey: state.boardKey,
        sessionId: analysisSessionId,
        positionId,
        decided: true,
        skip: false,
        move: picked.move,
        typeLabel: `${picked.typeLabel} • ${(totalDelay / 1000).toFixed(2)}с`,
        choiceKind: picked.choiceKind || "policy",
        totalDelay,
        attempts: 0
      };
    }

    if (currentTurnDecision.skip) return;
    if (currentTurnDecision.attempts >= 3) {
      setAutoStatusText("Ожидание ручного хода (или нажмите [X])", "#ffbe0b");
      return;
    }

    const mv = currentTurnDecision.move;
    const delayToWait = currentTurnDecision.attempts === 0 ? currentTurnDecision.totalDelay : 340;

    setAutoStatusText(
      `🛡 Размышление: ${mv.from}→${mv.to} [${currentTurnDecision.typeLabel}]`,
      cachedMoves.isDangerPosition ? "#ffbe0b" : "#00f5d4"
    );

    const expectedBoardKey = state.boardKey;
    const expectedPositionId = positionId;

    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (!autoMoveEnabled || extensionInvalidated || boardDirty || expectedPositionId !== positionId) return;

      const fresh = captureBoardState(false);
      if (!fresh || fresh.animating) {
        scheduleAutoMoveIfNeeded();
        return;
      }
      if (fresh.actualTurn !== fresh.myColor || fresh.boardKey !== expectedBoardKey || fresh.positionKey !== currentPositionKey) {
        return;
      }

      currentTurnDecision.attempts++;
      const moveNow = currentTurnDecision.move || cachedMoves.best;
      if (!moveNow) return;

      executeMoveOnBoard(moveNow, fresh, false);
    }, delayToWait);
  }

  let cachedChessComBoardElement = null;
  let cachedChessComRoots = [];

  function getChessComBoardRoots(boardEl) {
    if (boardEl === cachedChessComBoardElement && cachedChessComRoots.length &&
        cachedChessComRoots.every(root => !root.host || root.host.isConnected)) {
      return cachedChessComRoots;
    }
    const roots = [boardEl];
    // querySelector and MutationObserver do not cross web-component shadow boundaries.
    for (let i = 0; i < roots.length; i++) {
      for (const node of [roots[i], ...roots[i].querySelectorAll("*")]) {
        if (node.shadowRoot && !roots.includes(node.shadowRoot)) roots.push(node.shadowRoot);
        if (node.tagName === "SLOT") {
          for (const assigned of node.assignedElements({ flatten: true })) {
            if (!roots.includes(assigned)) roots.push(assigned);
          }
        }
      }
    }
    if (boardEl === cachedChessComBoardElement) cachedChessComRoots = roots;
    return roots;
  }

  function normalizeVisualMask(raw) {
    const api = window.ChessCoachPrivacyMask;
    const source = raw && typeof raw === "object" ? raw : {};
    const base = DEFAULT_VISUAL_MASK || source;
    const normalized = api?.normalizeConfig ? api.normalizeConfig({
      enabled: typeof source.enabled === "boolean" ? source.enabled : base.enabled,
      style: source.style || base.style,
      maskDetails: typeof source.maskDetails === "boolean" ? source.maskDetails : base.maskDetails,
      maskPageTitle: typeof source.maskPageTitle === "boolean" ? source.maskPageTitle : base.maskPageTitle,
      blockProfileHover: typeof source.blockProfileHover === "boolean" ? source.blockProfileHover : base.blockProfileHover,
      my: source.my || base.my,
      opponent: source.opponent || base.opponent
    }) : {
      enabled: Boolean(source.enabled),
      style: source.style === "royal" ? "royal" : "broadcast",
      maskDetails: source.maskDetails !== false,
      maskPageTitle: source.maskPageTitle !== false,
      blockProfileHover: source.blockProfileHover !== false,
      my: { ...(source.my || base.my) },
      opponent: { ...(source.opponent || base.opponent) }
    };
    const profileIds = new Set((api?.profiles || []).map(profile => profile.id));
    const validPreset = (value, fallback) => profileIds.size === 0 || profileIds.has(value) ? value : fallback;
    const myPresetId = validPreset(source.myPresetId || base.myPresetId, "custom");
    const opponentPresetId = validPreset(source.opponentPresetId || base.opponentPresetId, "custom");
    const fillPresetAssets = (identity, presetId) => {
      const profile = api?.getProfile?.(presetId);
      if (!profile || profile.id === "custom") return identity;
      return {
        ...identity,
        countryCode: identity.countryCode || profile.countryCode || "",
        avatarUrl: profile.avatarUrl || identity.avatarUrl || ""
      };
    };
    return {
      version: 1,
      ...normalized,
      my: fillPresetAssets(normalized.my, myPresetId),
      opponent: fillPresetAssets(normalized.opponent, opponentPresetId),
      myPresetId,
      opponentPresetId,
      autoRotateOpponent: Boolean(source.autoRotateOpponent)
    };
  }

  function getPrivacyProfileOptions() {
    const profiles = window.ChessCoachPrivacyMask?.profiles || [
      { id: "custom", label: "Свой профиль" },
      { id: "anonymous", label: "Анонимный стример" }
    ];
    return profiles.map(profile => `<option value="${profile.id}">${profile.label}</option>`).join("");
  }

  function updatePrivacyMaskStatus() {
    const badge = $("cc-mask-status");
    if (badge) {
      badge.textContent = visualMask.enabled
        ? (privacyMaskFoundPlayers === 2 ? "АКТИВНА • 2/2 КАРТОЧКИ" : `ПОИСК КАРТОЧЕК • ${privacyMaskFoundPlayers}/2`)
        : "ВЫКЛЮЧЕНА";
      badge.style.color = visualMask.enabled && privacyMaskFoundPlayers === 2 ? "#6ee7b7" : (visualMask.enabled ? "#f8d477" : "#94a3b8");
    }
  }

  function ensurePrivacyMaskManager() {
    if (privacyMaskManager || !window.ChessCoachPrivacyMask) return;
    privacyMaskManager = window.ChessCoachPrivacyMask.create({
      getConfig: () => visualMask,
      getBoardElement: () => findChessComBoardElement(),
      onToggle: enabled => {
        visualMask = normalizeVisualMask({ ...visualMask, enabled });
        saveSetting({ chesscomVisualMaskV1: visualMask });
        privacyMaskManager?.update();
        updateUIValues();
      },
      onStatus: status => {
        privacyMaskFoundPlayers = status.foundPlayers;
        updatePrivacyMaskStatus();
      }
    });
  }

  function persistVisualMask() {
    visualMask = normalizeVisualMask(visualMask);
    saveSetting({ chesscomVisualMaskV1: visualMask });
    ensurePrivacyMaskManager();
    privacyMaskManager?.update();
    updateUIValues();
  }

  function previewVisualMaskAndSave() {
    visualMask = normalizeVisualMask(visualMask);
    ensurePrivacyMaskManager();
    privacyMaskManager?.update();
    updateUIValues();
    clearTimeout(privacySaveTimer);
    privacySaveTimer = setTimeout(() => {
      privacySaveTimer = null;
      saveSetting({ chesscomVisualMaskV1: visualMask });
    }, 180);
  }

  function applyPrivacyPreset(role, presetId) {
    const profile = window.ChessCoachPrivacyMask?.getProfile(presetId);
    visualMask = normalizeVisualMask({
      ...visualMask,
      [`${role}PresetId`]: presetId,
      [role]: profile && profile.id !== "custom"
        ? { nickname: profile.nickname, elo: profile.elo, title: profile.title, countryCode: profile.countryCode || "", avatarUrl: profile.avatarUrl || "" }
        : visualMask[role]
    });
    persistVisualMask();
  }

  function randomizePrivacyOpponent() {
    const profile = window.ChessCoachPrivacyMask?.randomProfile([visualMask.myPresetId, visualMask.opponentPresetId]);
    if (!profile) return;
    visualMask = normalizeVisualMask({
      ...visualMask,
      opponentPresetId: profile.id,
      opponent: { nickname: profile.nickname, elo: profile.elo, title: profile.title, countryCode: profile.countryCode || "", avatarUrl: profile.avatarUrl || "" }
    });
    persistVisualMask();
  }

  function handleStorageChanges(changes, areaName) {
    if (areaName !== "local") return;
    if (typeof changes.activeTabId?.newValue === "string") activeTabId = changes.activeTabId.newValue;
    if (!changes.chesscomVisualMaskV1) return;
    visualMask = normalizeVisualMask(changes.chesscomVisualMaskV1.newValue || DEFAULT_VISUAL_MASK);
    ensurePrivacyMaskManager();
    privacyMaskManager?.update();
    updateUIValues();
  }

  function queryChessComBoard(boardEl, selector) {
    return Array.from(new Set(getChessComBoardRoots(boardEl).flatMap((root, i) => [
      ...(i > 0 && root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ])));
  }

  function findChessComBoardElement() {
    if (cachedChessComBoardElement?.isConnected) {
      const rect = cachedChessComBoardElement.getBoundingClientRect();
      const style = getComputedStyle(cachedChessComBoardElement);
      const hasPieces = queryChessComBoard(cachedChessComBoardElement, ".piece").some(piece => {
        const cls = piece.getAttribute("class") || "";
        return /\b[wb][pnbrqk]\b/i.test(cls) && /\bsquare-[1-8][1-8]\b/.test(cls);
      });
      if (hasPieces && rect.width >= 120 && rect.height >= 120 && style.display !== "none" && style.visibility !== "hidden") {
        return cachedChessComBoardElement;
      }
    }
    cachedChessComBoardElement = null;
    cachedChessComRoots = [];
    const selector = "wc-chess-board, chess-board, #board-single, #board-play-computer, #board-vs-personalities, .board-layout-chessboard .board, .board";
    const candidates = new Set(document.querySelectorAll(selector));
    if (!candidates.size) {
      for (const node of queryChessComBoard(document, selector)) candidates.add(node);
    }
    for (const node of candidates) {
      for (const inner of queryChessComBoard(node, selector)) candidates.add(inner);
    }
    const visibleBoards = [];
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width < 120 || rect.height < 120 ||
          rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight ||
          style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") continue;
      if (node.checkVisibility && !node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (!queryChessComBoard(node, ".piece").some(piece => {
        const cls = piece.getAttribute("class") || "";
        return /\b[wb][pnbrqk]\b/i.test(cls) && /\bsquare-[1-8][1-8]\b/.test(cls);
      })) continue;
      visibleBoards.push(node);
    }

    let bestBoard = null;
    let maxArea = 0;

    for (const node of visibleBoards) {
      // Prefer the actual inner playing surface over a larger component/container.
      if (queryChessComBoard(node, selector).some(inner => visibleBoards.includes(inner))) continue;
      const rect = node.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        bestBoard = node;
      }
    }
    cachedChessComBoardElement = bestBoard;
    cachedChessComRoots = [];
    return bestBoard;
  }

  /**
   * БИОМЕТРИЧЕСКИЙ STEALTH-ДВИЖОК МЫШИ ДЛЯ CHESS.COM:
   * 1. Гауссово смещение точки клика внутри клетки (никогда не бьет в центр 0.5, 0.5).
   * 2. Генерация кривой Безье из промежуточных pointermove/mousemove событий.
   * 3. Время полета курсора по Закону Фиттса + живое удержание кнопки (68–135 мс).
   */
  function executeMoveOnBoard(moveObj, state, manualClick = false) {
    if (!moveObj || !moveObj.from || !moveObj.to || !state || !state.grid) return;
    if (boardDirty || state.positionId !== positionId || state.positionKey !== currentPositionKey) return;

    if (!manualClick && safeAntiBanGuard && isRatedGameAgainstHuman()) {
      setAutoStatusText("🛡 Автоход заблокирован в Rated-игре (нажмите [X] или сходите сами)", "#ffbe0b");
      return;
    }

    const fromSq = moveObj.from;
    const toSq = moveObj.to;

    if (!hasMyPieceOnSquare(state.grid, state.myColor, fromSq)) {
      return;
    }

    const boardEl = findChessComBoardElement();
    if (!boardEl || (state.boardElement && state.boardElement !== boardEl)) return;

    const r = boardEl.getBoundingClientRect();
    if (r.width < 50) return;

    const isPromotion = moveObj.piece === "p" && (toSq[1] === "8" || toSq[1] === "1");
    const promoPiece = isPromotion ? (moveObj.promo || "q") : null;

    lastOurExecutedMove = moveObj;
    isExecutingMove = true;
    moveCooldownUntil = Date.now() + 450;

    const cellW = r.width / 8;
    const cellH = r.height / 8;
    const isBlack = state.isBlackOrientation;

    // Нормальное распределение вокруг центра клетки (±22% от ширины поля)
    const gaussianShift = () => ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 0.44;

    const sqToHumanPoint = (sq) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return {
        col,
        row,
        x: Math.round(r.left + (col + 0.5 + gaussianShift()) * cellW),
        y: Math.round(r.top + (row + 0.5 + gaussianShift()) * cellH)
      };
    };

    const p1 = sqToHumanPoint(fromSq);
    const p2 = sqToHumanPoint(toSq);

    performBezierStealthMove(boardEl, p1, p2, promoPiece, state.myColor, () => {
      isExecutingMove = false;
      setAutoStatusText(`✅ Сделан легит-ход: ${fromSq} → ${toSq}`, "#38b000");
      triggerDebouncedCycle();
    });
  }

  function performBezierStealthMove(boardEl, p1, p2, promoPiece, myColor, onDone) {
    const actionPositionId = positionId;
    const actionStillCurrent = () => !extensionInvalidated && boardEl.isConnected && positionId === actionPositionId;
    const firePointerAndMouse = (type, x, y, buttons) => {
      if (!actionStillCurrent()) return;
      let target = document.elementFromPoint(x, y) || boardEl;
      while (target.shadowRoot?.elementFromPoint) {
        const inner = target.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === target) break;
        target = inner;
      }
      const evInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y + 70,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      };
      const pointerType = type
        .replace("mousedown", "pointerdown")
        .replace("mousemove", "pointermove")
        .replace("mouseup", "pointerup");
      try {
        target.dispatchEvent(new PointerEvent(pointerType, evInit));
      } catch (e) {}
      target.dispatchEvent(new MouseEvent(type, evInit));
    };

    // Расчет времени движения мыши между клетками по Закону Фиттса
    const distCells = Math.hypot(p2.col - p1.col, p2.row - p1.row);
    const travelMs = Math.round(135 + distCells * 42 + Math.random() * 85);
    const hold1Ms = Math.round(68 + Math.random() * 58);
    const hold2Ms = Math.round(72 + Math.random() * 64);

    // Контрольная точка для дуги Безье (естественный изгиб кисти руки)
    const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 48;
    const midY = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 48;

    const animateBezierCurve = (stepsCount, durationMs, buttonsDuringMove, onCurveFinished) => {
      let step = 1;
      const stepInterval = Math.max(14, Math.round(durationMs / stepsCount));
      const stepTimer = setInterval(() => {
        if (!actionStillCurrent()) {
          clearInterval(stepTimer);
          if (onDone) onDone();
          return;
        }
        const t = step / stepsCount;
        const inv = 1 - t;
        const bx = Math.round(inv * inv * p1.x + 2 * inv * t * midX + t * t * p2.x + (Math.random() - 0.5) * 1.6);
        const by = Math.round(inv * inv * p1.y + 2 * inv * t * midY + t * t * p2.y + (Math.random() - 0.5) * 1.6);
        firePointerAndMouse("mousemove", bx, by, buttonsDuringMove);
        step++;
        if (step > stepsCount) {
          clearInterval(stepTimer);
          if (onCurveFinished) onCurveFinished();
        }
      }, stepInterval);
    };

    const handlePromotionIfNeeded = () => {
      if (!promoPiece) {
        if (onDone) onDone();
        return;
      }
      setTimeout(() => {
        if (!actionStillCurrent()) {
          if (onDone) onDone();
          return;
        }
        const colChar = myColor === "b" ? "b" : "w";
        const pChar = promoPiece.toLowerCase();
        const selector = `.promotion-window .promotion-piece.${colChar}${pChar}, .promotion-menu [data-piece='${colChar}${pChar}'], .promotion-piece.${colChar}${pChar}`;
        const root = boardEl.getRootNode();
        const promoNode = queryChessComBoard(root.host ? root : boardEl, selector)[0] || document.querySelector(selector);
        if (promoNode) {
          const pr = promoNode.getBoundingClientRect();
          const px = Math.round(pr.left + pr.width / 2 + (Math.random() - 0.5) * 6);
          const py = Math.round(pr.top + pr.height / 2 + (Math.random() - 0.5) * 6);
          firePointerAndMouse("mousedown", px, py, 1);
          setTimeout(() => {
            firePointerAndMouse("mouseup", px, py, 0);
            if (!extensionInvalidated && boardEl.isConnected && promoNode.isConnected) promoNode.click();
            if (onDone) onDone();
          }, 65);
        } else if (onDone) {
          onDone();
        }
      }, 95);
    };

    // Наведение на стартовую фигуру и нажатие
    firePointerAndMouse("mousemove", p1.x - 4, p1.y - 3, 0);
    firePointerAndMouse("mousedown", p1.x, p1.y, 1);

    if (autoClickMethod === "bezier_drag") {
      // Вариант 1: Плавное перетаскивание фигуры по кривой Безье
      setTimeout(() => {
        animateBezierCurve(7, travelMs, 1, () => {
          const slipX = p2.x + (Math.random() > 0.5 ? 1 : -1);
          const slipY = p2.y + (Math.random() > 0.5 ? 1 : -1);
          firePointerAndMouse("mouseup", slipX, slipY, 0);
          handlePromotionIfNeeded();
        });
      }, 35);
    } else {
      // Вариант 2: Биометрический 2-Клик с полетом курсора по дуге Безье
      setTimeout(() => {
        firePointerAndMouse("mouseup", p1.x + (Math.random() > 0.5 ? 1 : -1), p1.y, 0);
        animateBezierCurve(6, travelMs, 0, () => {
          firePointerAndMouse("mousedown", p2.x, p2.y, 1);
          setTimeout(() => {
            firePointerAndMouse("mouseup", p2.x + (Math.random() > 0.5 ? 1 : -1), p2.y + (Math.random() > 0.5 ? 1 : -1), 0);
            handlePromotionIfNeeded();
          }, hold2Ms);
        });
      }, hold1Ms);
    }
  }

  function detectRealMoveBetweenGrids(prevGrid, currGrid) {
    if (!prevGrid || !currGrid) return null;

    for (const color of ["w", "b"]) {
      const isCol = (p) => p && (color === "w" ? p === p.toUpperCase() : p === p.toLowerCase());
      let fromSq = null;
      let toSq = null;
      let oldPiece = null;
      let newPiece = null;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const pOld = prevGrid[r][c];
          const pNew = currGrid[r][c];
          if (isCol(pOld) && !isCol(pNew)) {
            if (!fromSq || pOld.toLowerCase() === "k") {
              fromSq = `${FILES[c]}${8 - r}`;
              oldPiece = pOld.toLowerCase();
            }
          }
          if (isCol(pNew) && !isCol(pOld)) {
            if (!toSq || pNew.toLowerCase() === "k") {
              toSq = `${FILES[c]}${8 - r}`;
              newPiece = pNew.toLowerCase();
            }
          }
        }
      }

      if (fromSq && toSq) {
        const promo = (oldPiece === "p" && newPiece && newPiece !== "p") ? newPiece : "";
        const toCol = FILES.indexOf(toSq[0]);
        const toRow = 8 - parseInt(toSq[1], 10);
        const capturedOnTarget = prevGrid[toRow]?.[toCol];
        const isCapture = Boolean(capturedOnTarget && !isCol(capturedOnTarget)) || (oldPiece === "p" && fromSq[0] !== toSq[0]);
        return {
          uci: `${fromSq}${toSq}${promo}`,
          from: fromSq,
          to: toSq,
          piece: oldPiece || "p",
          color,
          isCapture
        };
      }
    }
    return null;
  }

  function updateCastlingEpAndRealHistory(grid, boardPart, myColor) {
    const startFenBoard = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    const isNewUrl = location.pathname !== lastPathname;
    const isFreshStartBoard =
      boardPart === startFenBoard &&
      prevBoardPartForHistory !== "" &&
      prevBoardPartForHistory !== startFenBoard;

    if (isNewUrl || isFreshStartBoard) {
      analysisRequestId++;
      activeEngineBoardKey = "";
      StockfishWasmEngine.cancel?.();
      lastPathname = location.pathname;
      castlingRights = {
        K: boardPart === startFenBoard,
        Q: boardPart === startFenBoard,
        k: boardPart === startFenBoard,
        q: boardPart === startFenBoard
      };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      halfmoveClock = 0;
      fullmoveNumber = 1;
      lastRealEnemyMove = null;
      lastOurExecutedMove = null;
      sessionMoveHistory = [];
      uciHistoryList = [];
      recentPositionHistory = boardPart === startFenBoard ? [`${boardPart} w KQkq -`] : [];
      gameStartedFromInitial = (boardPart === startFenBoard);
      evalGraphHistory = [];
      lastRecordedGraphBoardKey = "";
      renderLiveEvalGraph();
      lastTelemetryData = null;
      updateEvalMoodAndEngineBadge(null, null);
      gameResultRecorded = false;
      suspectEngineStreak = 0;

      // Сброс счетчика T1% на новую партию
      legitStats = {
        totalMyMoves: 0,
        top1Matches: 0,
        secondLineMatches: 0,
        windowBlursCount: 0,
        lastBestUciOnMyTurn: "",
        lastAvgUciOnMyTurn: ""
      };
      updateLegitAntiBanMeterUI();

      const peerBanner = $("cc-peer-detector-banner");
      if (peerBanner) peerBanner.style.display = "none";
      if (visualMask.enabled && visualMask.autoRotateOpponent) randomizePrivacyOpponent();
      return;
    }

    if (!prevGridState) {
      castlingRights = {
        K: boardPart === startFenBoard,
        Q: boardPart === startFenBoard,
        k: boardPart === startFenBoard,
        q: boardPart === startFenBoard
      };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      halfmoveClock = 0;
      fullmoveNumber = 1;
      recentPositionHistory = boardPart === startFenBoard ? [`${boardPart} w KQkq -`] : [];
      gameStartedFromInitial = (boardPart === startFenBoard);
      return;
    }

    let diffCount = 0;
    let epFound = "-";

    for (let c = 0; c < 8; c++) {
      if (prevGridState[6][c] === "P" && !grid[6][c] && !grid[5][c] && grid[4][c] === "P") {
        epFound = `${FILES[c]}3`;
      }
      if (prevGridState[1][c] === "p" && !grid[1][c] && !grid[2][c] && grid[3][c] === "p") {
        epFound = `${FILES[c]}6`;
      }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (prevGridState[r][c] !== grid[r][c]) diffCount++;
      }
    }

    if (diffCount > 0 && diffCount <= 4) {
      if (grid[7][4] !== "K") { castlingRights.K = false; castlingRights.Q = false; }
      if (grid[7][7] !== "R") castlingRights.K = false;
      if (grid[7][0] !== "R") castlingRights.Q = false;

      if (grid[0][4] !== "k") { castlingRights.k = false; castlingRights.q = false; }
      if (grid[0][7] !== "r") castlingRights.k = false;
      if (grid[0][0] !== "r") castlingRights.q = false;

      currentEpSquare = epFound;

      const realMove = detectRealMoveBetweenGrids(prevGridState, grid);
      const isSingleCastling = Boolean(realMove?.piece === "k" && Math.abs(FILES.indexOf(realMove.from[0]) - FILES.indexOf(realMove.to[0])) === 2);
      const isSingleEnPassant = Boolean(realMove?.piece === "p" && realMove.from[0] !== realMove.to[0] && diffCount === 3);
      if ((diffCount === 4 && !isSingleCastling) || (diffCount === 3 && !isSingleEnPassant)) {
        gameStartedFromInitial = false;
        uciHistoryList = [];
        currentEpSquare = "-";
        halfmoveClock = 0;
        prevGridState = grid.map(r => r.slice());
        prevBoardPartForHistory = boardPart;
        return;
      }
      if (realMove && realMove.uci) {
        halfmoveClock = realMove.piece === "p" || realMove.isCapture ? 0 : halfmoveClock + 1;
        if (realMove.color === "b") fullmoveNumber++;
        const nextTurn = realMove.color === "w" ? "b" : "w";
        const repetitionKey = `${boardPart} ${nextTurn} ${getCastlingString()} ${currentEpSquare}`;
        if (recentPositionHistory[recentPositionHistory.length - 1] !== repetitionKey) {
          recentPositionHistory.push(repetitionKey);
          if (recentPositionHistory.length > 80) recentPositionHistory.shift();
        }
        if (uciHistoryList[uciHistoryList.length - 1] !== realMove.uci) {
          uciHistoryList.push(realMove.uci);
        }
        if (realMove.color === myColor && prevBoardPartForHistory) {
          const prevFenKey = `${prevBoardPartForHistory} ${myColor}`;
          sessionMoveHistory.push({ fenKey: prevFenKey, uci: realMove.uci });
          lastOurExecutedMove = realMove;
          lastRealEnemyMove = null;

          // Учет нашего хода в статистике Fair Play T1%
          legitStats.totalMyMoves++;
          if (legitStats.lastBestUciOnMyTurn && realMove.uci === legitStats.lastBestUciOnMyTurn) {
            legitStats.top1Matches++;
          } else if (legitStats.lastAvgUciOnMyTurn && realMove.uci === legitStats.lastAvgUciOnMyTurn) {
            legitStats.secondLineMatches++;
          }
          updateLegitAntiBanMeterUI();
        } else if (realMove.color !== myColor) {
          lastRealEnemyMove = {
            from: realMove.from,
            to: realMove.to,
            piece: realMove.piece,
            color: realMove.color,
            epTarget: epFound !== "-" ? epFound : null
          };
        }
      }

      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
    } else if (diffCount > 4) {
      if (grid[7][4] !== "K") { castlingRights.K = false; castlingRights.Q = false; }
      if (grid[7][7] !== "R") castlingRights.K = false;
      if (grid[7][0] !== "R") castlingRights.Q = false;
      if (grid[0][4] !== "k") { castlingRights.k = false; castlingRights.q = false; }
      if (grid[0][7] !== "r") castlingRights.k = false;
      if (grid[0][0] !== "r") castlingRights.q = false;
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      gameStartedFromInitial = false;
      uciHistoryList = [];
      currentEpSquare = "-";
      halfmoveClock = 0;
      fullmoveNumber = 1;
      recentPositionHistory = [];
    }
  }

  function getCastlingString() {
    let s = "";
    if (castlingRights.K) s += "K";
    if (castlingRights.Q) s += "Q";
    if (castlingRights.k) s += "k";
    if (castlingRights.q) s += "q";
    return s || "-";
  }

  /**
   * ПАРСЕР СОСТОЯНИЯ ДОСКИ CHESS.COM (<wc-chess-board>):
   * Считывает классы вида "piece wp square-54", ориентацию .flipped и чей сейчас ход.
   */
  function captureBoardState(allowCachedDuringAnim = false) {
    const boardEl = findChessComBoardElement();
    if (!boardEl) return null;

    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width < 50 || boardRect.height < 50) return null;

    if (!allowCachedDuringAnim && !isExecutingMove && queryChessComBoard(boardEl, ".piece.dragging").length) {
      if (!animRetryTimer) {
        animRetryTimer = setTimeout(() => {
          animRetryTimer = null;
          runCycle(false);
        }, 30);
      }
      return { animating: true };
    }

    let isBlackOrientation = false;
    for (let node = boardEl; node; node = node.parentElement || node.getRootNode().host) {
      if (node.classList.contains("flipped") || node.getAttribute("orientation") === "black") {
        isBlackOrientation = true;
        break;
      }
    }
    const bottomColor = isBlackOrientation ? "b" : "w";
    const myColor = forcedMyColor === "w" || forcedMyColor === "b" ? forcedMyColor : bottomColor;
    const topColor = bottomColor === "w" ? "b" : "w";

    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    let pieceCount = 0;

    const pieces = queryChessComBoard(boardEl, ".piece");
    pieces.forEach((p) => {
      const cls = p.getAttribute("class") || "";
      const typeMatch = cls.match(/\b([wb])([pnbrqk])\b/i);
      const sqMatch = cls.match(/\bsquare-(\d)(\d)\b/);
      if (!typeMatch || !sqMatch) return;

      const color = typeMatch[1].toLowerCase();
      const sym = typeMatch[2].toLowerCase();
      const col = parseInt(sqMatch[1], 10) - 1;
      const row = 8 - parseInt(sqMatch[2], 10);

      if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
        grid[row][col] = color === "w" ? sym.toUpperCase() : sym;
        pieceCount++;
      }
    });

    if (pieceCount === 0 || !grid.some(row => row.includes("K")) || !grid.some(row => row.includes("k"))) return null;

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

    const boardPart = fenRows.join("/");
    if (!allowCachedDuringAnim) updateCastlingEpAndRealHistory(grid, boardPart, myColor);

    // Определение очередности хода на Chess.com
    let actualTurn = "w";
    if (boardPart === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") {
      actualTurn = "w";
    } else {
      let detectedByHighlight = null;
      const highlights = queryChessComBoard(boardEl, ".highlight");
      for (const hl of highlights) {
        const sqM = (hl.getAttribute("class") || "").match(/\bsquare-(\d)(\d)\b/);
        if (!sqM) continue;
        const c = parseInt(sqM[1], 10) - 1;
        const r = 8 - parseInt(sqM[2], 10);
        const pieceHere = grid[r]?.[c];
        if (pieceHere) {
          const movedColor = pieceHere === pieceHere.toUpperCase() ? "w" : "b";
          detectedByHighlight = movedColor === "w" ? "b" : "w";
          break;
        }
      }

      if (document.querySelector(".board-layout-bottom .clock-player-turn, .clock-bottom.clock-player-turn")) {
        actualTurn = bottomColor;
      } else if (document.querySelector(".board-layout-top .clock-player-turn, .clock-top.clock-player-turn")) {
        actualTurn = topColor;
      } else if (detectedByHighlight) {
        actualTurn = detectedByHighlight;
      } else if (uciHistoryList.length > 0) {
        actualTurn = uciHistoryList.length % 2 === 0 ? "w" : "b";
      }
    }

    let sideToAnalyze = actualTurn;
    if (turnMode === "w") sideToAnalyze = "w";
    else if (turnMode === "b") sideToAnalyze = "b";

    const castlingStr = getCastlingString();
    const state = {
      animating: false,
      grid,
      pieceCount,
      fen: `${boardPart} ${sideToAnalyze} ${castlingStr} ${currentEpSquare} ${halfmoveClock} ${fullmoveNumber}`,
      actualFen: `${boardPart} ${actualTurn} ${castlingStr} ${currentEpSquare} ${halfmoveClock} ${fullmoveNumber}`,
      boardKey: `${boardPart} ${sideToAnalyze} ${castlingStr} ${currentEpSquare}`,
      positionKey: `${boardPart} ${actualTurn} ${castlingStr} ${currentEpSquare}`,
      sessionId: analysisSessionId,
      positionId,
      boardElement: boardEl,
      boardRect,
      isBlackOrientation,
      myColor,
      actualTurn,
      sideToAnalyze
    };
    window.__CHESSCOACH_BOARD_STATE__ = {
      grid: grid.map(row => row.slice()),
      fen: state.actualFen,
      positionKey: state.positionKey,
      positionId,
      actualTurn,
      myColor,
      isBlackOrientation,
      boardElement: boardEl,
      timestamp: Date.now()
    };
    return state;
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

    if (!showEvalBar || !state || !state.boardRect || (state.boardElement && !state.boardElement.isConnected)) {
      bar.style.display = "none";
      return;
    }

    const r = state.boardElement ? state.boardElement.getBoundingClientRect() : state.boardRect;
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
    if (svg) {
      svg.innerHTML = "";
      svg.style.display = "none";
    }
  }

  function buildHeatmapCellsSVG(heatmapList, sqToXY) {
    if (!Array.isArray(heatmapList) || heatmapList.length === 0) return "";
    let out = "";
    for (const cell of heatmapList) {
      const p = sqToXY(cell.sq);
      const x = p.x - 48;
      const y = p.y - 48;
      const op = Math.min(0.62, Math.max(0.18, (cell.intensity || 0.4) * 0.65));

      if (cell.zone === "king_danger") {
        out += `
          <rect x="${x}" y="${y}" width="96" height="96" rx="8"
                fill="rgba(255, 0, 55, ${(op * 0.85).toFixed(2)})"
                stroke="#ff0037" stroke-width="3" stroke-opacity="0.9"
                class="cc-sq-anim" />
          <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" fill="#ffffff"
                font-family="monospace" font-weight="900" font-size="11" opacity="0.9">⚠️${cell.enCount}</text>
        `;
      } else if (cell.zone === "my") {
        out += `
          <rect x="${x}" y="${y}" width="96" height="96" rx="6"
                fill="rgba(0, 245, 212, ${(op * 0.55).toFixed(2)})"
                stroke="#00f5d4" stroke-width="1.5" stroke-opacity="${(op * 0.8).toFixed(2)}" />
        `;
      } else if (cell.zone === "enemy") {
        out += `
          <rect x="${x}" y="${y}" width="96" height="96" rx="6"
                fill="rgba(255, 42, 133, ${(op * 0.52).toFixed(2)})"
                stroke="#ff2a85" stroke-width="1.5" stroke-opacity="${(op * 0.75).toFixed(2)}" />
        `;
      }
    }
    return out;
  }

  function renderArrowsOverlay(state, res) {
    const tokenMismatch = currentPositionKey && (boardDirty || (res.positionId !== undefined && res.positionId !== positionId) || state?.positionKey !== currentPositionKey);
    if (!state || !res || tokenMismatch) {
      hideArrows();
      return;
    }
    if (!state || state.animating || !state.boardRect || (state.boardElement && !state.boardElement.isConnected)) {
      hideArrows();
      return;
    }
    let svg = $("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      svg.setAttribute("preserveAspectRatio", "none");
      getShadow().appendChild(svg);
    }

    const showHeatmapNow = Boolean(isAltPressed || heatmapAlwaysOn);
    const waitingForFinalNnue = Boolean(
      engineMaxMode &&
      useStockfishWasm &&
      res?.best &&
      !res.engineMeta &&
      res.pass !== "deep" &&
      !res.best.fromSyzygy &&
      !res.best.isMateInOne
    );
    const canRenderMoveArrows = showArrows && !waitingForFinalNnue;
    const analysisMatches = !res?.boardKey || res.boardKey === state.boardKey;
    const heatmapMatches = analysisMatches || res?.heatmapBoardKey === state.boardKey;

    if (turnMode === "my" && state && state.actualTurn !== state.myColor && !showHeatmapNow) {
      hideArrows();
      return;
    }

    if (!showHeatmapNow && (!canRenderMoveArrows || !analysisMatches || !res || !res.best)) {
      svg.innerHTML = "";
      svg.style.display = "none";
      return;
    }

    const r = state.boardElement ? state.boardElement.getBoundingClientRect() : state.boardRect;
    if (r.width <= 0 || r.height <= 0) {
      hideArrows();
      return;
    }
    svg.style.display = "block";
    svg.style.position = "fixed";
    svg.style.left = `${r.left}px`;
    svg.style.top = `${r.top}px`;
    svg.style.width = `${r.width}px`;
    svg.style.height = `${r.height}px`;
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";
    svg.style.zIndex = "2147483645";
    svg.style.animation = arrowStyle === "chroma_rgb" ? "cc-chroma-shift 2.5s linear infinite" : "none";
    svg.setAttribute("data-cc-orientation", state.isBlackOrientation ? "black" : "white");
    svg.setAttribute("data-cc-board-key", state.boardKey);

    const isBlack = state.isBlackOrientation;
    const sqToXY = (sq) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return { x: col * 100 + 50, y: row * 100 + 50 };
    };

    const heatmapSVG = showHeatmapNow && heatmapMatches ? buildHeatmapCellsSVG(res?.heatmap || cachedMoves.heatmap, sqToXY) : "";
    if (!analysisMatches || !res || !res.best || !canRenderMoveArrows || (turnMode === "my" && state.actualTurn !== state.myColor)) {
      svg.innerHTML = heatmapSVG;
      return;
    }

    const { best, average, worst, hangingSquare, lastOpponentMove, enemyKingSquare } = res;

    const drawSquareHighlightMove = (m, solidColor, baseOp, roleLabel = "best") => {
      if (!m || !m.from || !m.to) return "";
      const p1 = sqToXY(m.from);
      const p2 = sqToXY(m.to);
      const op = Math.min(1, baseOp * (arrowOpacity / 0.85));
      const isBest = roleLabel === "best";
      const sw = (isBest ? 4.5 : 3) * arrowScale;

      if (arrowStyle === "sq_cyber_frame") {
        const cornerBrackets = (x, y, s, col, w) => `
          <path d="M ${x - s} ${y - s + 18} L ${x - s} ${y - s} L ${x - s + 18} ${y - s}
                   M ${x + s - 18} ${y - s} L ${x + s} ${y - s} L ${x + s} ${y - s + 18}
                   M ${x - s} ${y + s - 18} L ${x - s} ${y + s} L ${x - s + 18} ${y + s}
                   M ${x + s - 18} ${y + s} L ${x + s} ${y + s} L ${x + s} ${y + s - 18}"
                fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-opacity="${op}" />
        `;
        return `
          <rect x="${p1.x - 45}" y="${p1.y - 45}" width="90" height="90" rx="10"
                fill="${solidColor}" fill-opacity="${op * 0.14}"
                stroke="${solidColor}" stroke-width="${sw * 0.65}" stroke-dasharray="10 6" stroke-opacity="${op * 0.85}" />
          <rect x="${p2.x - 45}" y="${p2.y - 45}" width="90" height="90" rx="12"
                fill="${solidColor}" fill-opacity="${op * (isBest ? 0.28 : 0.16)}" />
          ${cornerBrackets(p2.x, p2.y, 44, solidColor, sw * 1.15)}
          ${isBest ? `
            <rect x="${p1.x - 32}" y="${p1.y + 24}" width="64" height="17" rx="5" fill="rgba(8,10,16,0.9)" stroke="${solidColor}" stroke-width="1.5" />
            <text x="${p1.x}" y="${p1.y + 36}" text-anchor="middle" fill="${solidColor}" font-family="monospace" font-weight="900" font-size="10">СТАРТ</text>
            <rect x="${p2.x - 38}" y="${p2.y + 24}" width="76" height="18" rx="5" fill="rgba(8,10,16,0.94)" stroke="${solidColor}" stroke-width="1.8" />
            <text x="${p2.x}" y="${p2.y + 36.5}" text-anchor="middle" fill="#ffffff" font-family="monospace" font-weight="900" font-size="10.5">➔ ${m.to.toUpperCase()}</text>
          ` : ""}
        `;
      }

      if (arrowStyle === "sq_Step_badges") {
        const tag = isBest ? "ЛУЧШИЙ" : (roleLabel === "avg" ? "2-Я ЛИНИЯ" : "ЗЕВОК");
        return `
          <rect x="${p1.x - 44}" y="${p1.y - 44}" width="88" height="88" rx="14"
                fill="none" stroke="${solidColor}" stroke-width="${sw * 0.75}" stroke-dasharray="12 6" stroke-opacity="${op * 0.85}" />
          <rect x="${p2.x - 44}" y="${p2.y - 44}" width="88" height="88" rx="14"
                fill="${solidColor}" fill-opacity="${op * 0.22}" stroke="${solidColor}" stroke-width="${sw}" stroke-opacity="${op}"
                style="filter: drop-shadow(0 0 10px ${solidColor});" />
          ${isBest ? `
            <g style="animation: cc-marker-float 1.3s ease-in-out infinite;">
              <rect x="${p1.x - 36}" y="${p1.y - 42}" width="72" height="20" rx="6" fill="rgba(7,9,15,0.94)" stroke="${solidColor}" stroke-width="2" />
              <text x="${p1.x}" y="${p1.y - 28}" text-anchor="middle" fill="${solidColor}" font-family="monospace" font-weight="900" font-size="10.5">1: БЕРИ</text>
              <rect x="${p2.x - 42}" y="${p2.y - 42}" width="84" height="22" rx="6" fill="${solidColor}" />
              <text x="${p2.x}" y="${p2.y - 27}" text-anchor="middle" fill="#05070c" font-family="monospace" font-weight="900" font-size="11">2: СЮДА!</text>
            </g>
          ` : `
            <rect x="${p2.x - 34}" y="${p2.y + 23}" width="68" height="17" rx="5" fill="rgba(7,9,15,0.9)" stroke="${solidColor}" stroke-width="1.5" />
            <text x="${p2.x}" y="${p2.y + 35}" text-anchor="middle" fill="${solidColor}" font-family="monospace" font-weight="800" font-size="9.5">${tag}</text>
          `}
        `;
      }

      if (arrowStyle === "sq_hologram_tiles") {
        return `
          <rect x="${p1.x - 46}" y="${p1.y - 46}" width="92" height="92" rx="8"
                fill="${solidColor}" fill-opacity="${op * 0.18}" stroke="${solidColor}" stroke-width="2" stroke-opacity="${op * 0.7}" />
          <rect x="${p2.x - 46}" y="${p2.y - 46}" width="92" height="92" rx="8"
                fill="${solidColor}" fill-opacity="${op * 0.34}" stroke="${solidColor}" stroke-width="${sw}" stroke-opacity="${op}"
                style="filter: drop-shadow(0 0 12px ${solidColor});" />
          <g style="transform-origin: ${p2.x}px ${p2.y}px; animation: cc-sniper-rotate 4.5s linear infinite;">
            <circle cx="${p2.x}" cy="${p2.y}" r="${28 * arrowScale}" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="12 8" stroke-opacity="${op * 0.9}" />
          </g>
          <circle cx="${p2.x}" cy="${p2.y}" r="${7 * arrowScale}" fill="#ffffff" fill-opacity="${op}" />
        `;
      }

      return `
        <circle cx="${p1.x}" cy="${p1.y}" r="${40 * arrowScale}" fill="none"
                stroke="${solidColor}" stroke-width="${sw * 0.85}" stroke-opacity="${op * 0.85}" />
        <circle cx="${p2.x}" cy="${p2.y}" r="${(isBest ? 17 : 12) * arrowScale}"
                fill="${solidColor}" fill-opacity="${op * 0.92}"
                style="filter: drop-shadow(0 0 8px ${solidColor});" />
        ${isBest ? `<circle cx="${p2.x}" cy="${p2.y}" r="${32 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="2.5" stroke-dasharray="8 6" stroke-opacity="${op * 0.75}" />` : ""}
      `;
    };

    const drawSingleArrow = (m, gradId, solidColor, markerId, curveOffset, baseOp, isBest = false, roleLabel = "best") => {
      if (!m || !m.from || !m.to) return "";
      if (arrowStyle.startsWith("sq_")) {
        return drawSquareHighlightMove(m, solidColor, baseOp, roleLabel);
      }

      const p1 = sqToXY(m.from);
      const p2 = sqToXY(m.to);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = -dy / len;
      const ny = dx / len;
      const tx = p2.x - (dx / len) * 24;
      const ty = p2.y - (dy / len) * 24;

      const width = (isBest ? 14 : 10.5) * arrowScale;
      const op = Math.min(1, baseOp * (arrowOpacity / 0.85));

      if (arrowStyle === "comet_trail") {
        const cx = (p1.x + tx) / 2 + nx * curveOffset * 0.7;
        const cy = (p1.y + ty) / 2 + ny * curveOffset * 0.7;
        const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${6 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.45}" />
          <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 1.25}" stroke-linecap="round"
                stroke-opacity="${op}" style="filter: drop-shadow(0 0 12px ${solidColor});" marker-end="url(#${markerId})" />
          <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${width * 0.35}" stroke-dasharray="22 12"
                stroke-linecap="round" stroke-opacity="0.9" class="cc-best-flow" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${35 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.16}"
                  stroke="${solidColor}" stroke-width="${3.2 * arrowScale}" stroke-opacity="${op}" />
        `;
      }

      if (arrowStyle === "cyber_chevron") {
        const steps = Math.max(3, Math.floor(len / 55));
        let chevrons = "";
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 0.6);
          const qx = p1.x + dx * t;
          const qy = p1.y + dy * t;
          const sc = (0.75 + 0.35 * t) * arrowScale;
          chevrons += `
            <path d="M -10 -12 L 4 0 L -10 12" fill="none" stroke="${i === steps ? "#ffffff" : solidColor}"
                  stroke-width="${4.2 * sc}" stroke-linecap="round" stroke-linejoin="round"
                  stroke-opacity="${op}" transform="translate(${qx.toFixed(1)}, ${qy.toFixed(1)}) rotate(${angleDeg.toFixed(1)})"
                  style="filter: drop-shadow(0 0 6px ${solidColor});" />
          `;
        }
        return `
          <rect x="${p1.x - 42}" y="${p1.y - 42}" width="84" height="84" rx="12" fill="none"
                stroke="${solidColor}" stroke-width="${2.5 * arrowScale}" stroke-dasharray="10 6" stroke-opacity="${op * 0.7}" />
          <rect x="${p2.x - 42}" y="${p2.y - 42}" width="84" height="84" rx="12"
                fill="${solidColor}" fill-opacity="${op * 0.18}" stroke="${solidColor}" stroke-width="${3.5 * arrowScale}" stroke-opacity="${op}" />
          ${chevrons}
        `;
      }

      if (arrowStyle === "quantum_portal") {
        const lineD = `M ${p1.x} ${p1.y} L ${tx} ${ty}`;
        return `
          <g style="transform-origin: ${p1.x}px ${p1.y}px; animation: cc-sniper-rotate 3.2s linear infinite;">
            <circle cx="${p1.x}" cy="${p1.y}" r="${34 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3 * arrowScale}" stroke-dasharray="14 8" stroke-opacity="${op * 0.85}" />
          </g>
          <g style="transform-origin: ${p2.x}px ${p2.y}px; animation: cc-sniper-rotate 2.2s linear reverse infinite;">
            <circle cx="${p2.x}" cy="${p2.y}" r="${38 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.20}" stroke="${solidColor}" stroke-width="${4 * arrowScale}" stroke-dasharray="18 7" stroke-opacity="${op}" />
            <circle cx="${p2.x}" cy="${p2.y}" r="${22 * arrowScale}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-dasharray="8 6" stroke-opacity="0.85" />
          </g>
          <path d="${lineD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 0.55}" stroke-dasharray="12 10"
                stroke-linecap="round" stroke-opacity="${op * 0.85}" class="cc-best-flow" marker-end="url(#${markerId})" />
        `;
      }

      if (arrowStyle === "tube_3d") {
        const cx = (p1.x + tx) / 2 + nx * curveOffset;
        const cy = (p1.y + ty) / 2 + ny * curveOffset;
        const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;
        const shadowD = `M ${p1.x + 6} ${p1.y + 10} Q ${cx + 6} ${cy + 10} ${tx + 6} ${ty + 10}`;
        return `
          <circle cx="${p2.x + 5}" cy="${p2.y + 8}" r="${33 * arrowScale}" fill="rgba(0,0,0,0.42)" />
          <path d="${shadowD}" fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="${width * 1.15}" stroke-linecap="round" />
          <circle cx="${p1.x}" cy="${p1.y}" r="${10 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${34 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.5 * arrowScale}" stroke-opacity="${op * 0.9}" />
          <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 1.15}" stroke-linecap="round" stroke-opacity="${op}" marker-end="url(#${markerId})" />
          <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${width * 0.3}" stroke-linecap="round" stroke-opacity="0.78" />
        `;
      }

      if (arrowStyle === "plasma") {
        const z1x = (p1.x + dx * 0.25 + nx * 18).toFixed(1);
        const z1y = (p1.y + dy * 0.25 + ny * 18).toFixed(1);
        const z2x = (p1.x + dx * 0.52 - nx * 18).toFixed(1);
        const z2y = (p1.y + dy * 0.52 - ny * 18).toFixed(1);
        const z3x = (p1.x + dx * 0.76 + nx * 14).toFixed(1);
        const z3y = (p1.y + dy * 0.76 + ny * 14).toFixed(1);
        const boltD = `M ${p1.x} ${p1.y} L ${z1x} ${z1y} L ${z2x} ${z2y} L ${z3x} ${z3y} L ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${11 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${33 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3 * arrowScale}" stroke-dasharray="10 6" stroke-opacity="${op}" />
          <path d="${boltD}" fill="none" stroke="url(#${gradId})" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"
                stroke-opacity="${op}" style="filter: drop-shadow(0 0 8px ${solidColor});" marker-end="url(#${markerId})" />
          <path d="${boltD}" fill="none" stroke="#ffffff" stroke-width="${width * 0.32}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.85" />
        `;
      }

      if (arrowStyle === "sniper_3d") {
        const lineD = `M ${p1.x} ${p1.y} L ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${9 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <path d="${lineD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 0.82}" stroke-dasharray="16 8"
                stroke-linecap="round" stroke-opacity="${op}" style="filter: drop-shadow(0 0 6px ${solidColor});" marker-end="url(#${markerId})" />
          <path d="${lineD}" fill="none" stroke="#ffffff" stroke-width="${2.2 * arrowScale}" stroke-opacity="0.7" />
          <g style="transform-origin: ${p2.x}px ${p2.y}px; animation: cc-sniper-rotate 4.2s linear infinite;">
            <circle cx="${p2.x}" cy="${p2.y}" r="${36 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3 * arrowScale}" stroke-dasharray="18 10" stroke-opacity="${op * 0.95}" />
            <line x1="${p2.x - 42 * arrowScale}" y1="${p2.y}" x2="${p2.x - 24 * arrowScale}" y2="${p2.y}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x + 24 * arrowScale}" y1="${p2.y}" x2="${p2.x + 42 * arrowScale}" y2="${p2.y}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x}" y1="${p2.y - 42 * arrowScale}" x2="${p2.x}" y2="${p2.y - 24 * arrowScale}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x}" y1="${p2.y + 24 * arrowScale}" x2="${p2.x}" y2="${p2.y + 42 * arrowScale}" stroke="${solidColor}" stroke-width="3" />
          </g>
        `;
      }

      if (arrowStyle === "dna_wave") {
        const c1x = (p1.x + tx) / 2 + nx * 32;
        const c1y = (p1.y + ty) / 2 + ny * 32;
        const c2x = (p1.x + tx) / 2 - nx * 32;
        const c2y = (p1.y + ty) / 2 - ny * 32;
        const w1 = `M ${p1.x} ${p1.y} Q ${c1x} ${c1y} ${tx} ${ty}`;
        const w2 = `M ${p1.x} ${p1.y} Q ${c2x} ${c2y} ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${10 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.75}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${34 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.2 * arrowScale}" stroke-opacity="${op * 0.85}" />
          <path d="${w1}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 0.78}" stroke-linecap="round" stroke-opacity="${op}" marker-end="url(#${markerId})" />
          <path d="${w2}" fill="none" stroke="#ffffff" stroke-width="${width * 0.45}" stroke-dasharray="14 9" stroke-linecap="round" stroke-opacity="${op * 0.75}" class="cc-best-flow" />
        `;
      }

      const actualCurve = (arrowStyle === "curved_neon" || arrowStyle === "chroma_rgb") ? curveOffset : 0;
      const cx = (p1.x + tx) / 2 + nx * actualCurve;
      const cy = (p1.y + ty) / 2 + ny * actualCurve;
      const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;
      const dashAttr = arrowStyle === "dotted" ? `stroke-dasharray="14 10"` : "";
      const glowFilter = arrowStyle === "classic" ? "" : `style="filter: drop-shadow(0 0 9px ${solidColor});"`;

      return `
        <circle cx="${p1.x}" cy="${p1.y}" r="${10 * arrowScale}" fill="${solidColor}" fill-opacity="${op * 0.7}" />
        <circle cx="${p2.x}" cy="${p2.y}" r="${34 * arrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.2 * arrowScale}" stroke-opacity="${op * 0.82}" />
        <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width}"
              stroke-linecap="round" stroke-opacity="${op}" ${dashAttr} ${glowFilter}
              marker-end="url(#${markerId})" />
        ${isBest && arrowStyle !== "classic" ? `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${3.4 * arrowScale}" stroke-linecap="round" stroke-opacity="0.62" class="cc-best-flow" />` : ""}
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

    const drawTrapBannerOnSquare = (sq, trapChance) => {
      if (!sq) return "";
      const p = sqToXY(sq);
      const by = Math.max(24, p.y - 42);
      return `
        <g style="animation: cc-marker-float 1.3s ease-in-out infinite;">
          <rect x="${p.x - 48}" y="${by - 12}" width="96" height="24" rx="7"
                fill="rgba(14, 10, 22, 0.96)" stroke="#ffbe0b" stroke-width="2" />
          <text x="${p.x}" y="${by + 4}" text-anchor="middle" fill="#ffbe0b"
                font-family="monospace" font-weight="900" font-size="11">🪤 ЛОВУШКА ${trapChance}%</text>
        </g>
      `;
    };

    const drawMateInOneSpectacle = (mateSq, kingSq) => {
      const pm = sqToXY(mateSq);
      const pk = kingSq ? sqToXY(kingSq) : pm;
      if (window.ChessFX && window.ChessFX.renderMateSpectacleByStyle) {
        return window.ChessFX.renderMateSpectacleByStyle(mateStyle, pm, pk);
      }
      return "";
    };

    const avgCurve = (best && average && best.from === average.from) ? 42 : 18;
    const worstCurve = (best && worst && best.from === worst.from) ? -42 : -18;

    let markersHTML = "";
    if (best.isMateInOne || best.isForcedMateInTwo) {
      markersHTML += drawMateInOneSpectacle(best.to, enemyKingSquare);
    } else {
      if (hangingSquare) markersHTML += drawHudMarkerOnSquare(hangingSquare, "!", "#ff2a85");
      if (best && best.isTrap && best.trapChance >= 75) {
        markersHTML += drawTrapBannerOnSquare(best.to, best.trapChance);
      } else if (isStrictBrilliantMove(best)) {
        markersHTML += drawHudMarkerOnSquare(best.to, "💎", "#00f5d4");
      } else if (best && best.fromSyzygy) {
        markersHTML += drawHudMarkerOnSquare(best.to, "🔮", "#c77dff");
      } else if (best && best.isSacrifice) {
        markersHTML += drawHudMarkerOnSquare(best.to, "⚡", "#ff4d94");
      } else if (best && best.isFork) {
        markersHTML += drawHudMarkerOnSquare(best.to, "⚔", "#00f5d4");
      } else if (best && best.isPin) {
        markersHTML += drawHudMarkerOnSquare(best.to, "◈", "#00bbf9");
      } else if (res.isDangerPosition) {
        markersHTML += drawHudMarkerOnSquare(best.to, "🛡", "#ffbe0b");
      }

      if ((roflMode || currentStyle === "mogging") && currentRoast && lastOpponentMove && lastOpponentMove.to) {
        markersHTML += drawHudMarkerOnSquare(lastOpponentMove.to, currentRoast.emoji, "#ffbe0b", true);
      }
    }

    const bestGrad = (best.isMateInOne || best.isForcedMateInTwo) ? "grad-mate" : "grad-best";
    const bestGlow = (best.isMateInOne || best.isForcedMateInTwo) ? "#ffbe0b" : "#00f5d4";

    svg.innerHTML = `
      <defs>
        <linearGradient id="grad-best" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#00bbf9" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="grad-mate" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#ff2a85" />
          <stop offset="50%" stop-color="#ffbe0b" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="grad-avg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#ff9e00" />
          <stop offset="100%" stop-color="#ffbe0b" />
        </linearGradient>
        <linearGradient id="grad-worst" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#b5179e" />
          <stop offset="100%" stop-color="#ff2a85" />
        </linearGradient>
        <marker id="m-best" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="${bestGlow}" fill-opacity="0.96"/>
        </marker>
        <marker id="m-avg" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="#ffbe0b" fill-opacity="0.88"/>
        </marker>
        <marker id="m-worst" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="#ff2a85" fill-opacity="0.82"/>
        </marker>
      </defs>
      ${heatmapSVG}
      ${!best.isMateInOne && showWorstMove && workMode === "all" ? drawSingleArrow(worst, "grad-worst", "#ff2a85", "m-worst", worstCurve, 0.45, false, "worst") : ""}
      ${!best.isMateInOne && showAverageMove ? drawSingleArrow(average, "grad-avg", "#ffbe0b", "m-avg", avgCurve, 0.62, false, "avg") : ""}
      ${drawSingleArrow(best, bestGrad, bestGlow, "m-best", 0, 0.92, true, "best")}
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

    const modalEl = document.querySelector(
      ".game-over-modal-content, .board-modal-container-container, [data-cy='game-over-modal']"
    );
    if (!modalEl) return;
    const text = (modalEl.innerText || "").toLowerCase();

    const whiteWon = text.includes("white won") || text.includes("белые победили");
    const blackWon = text.includes("black won") || text.includes("черные победили");
    const youWon = text.includes("you won") || text.includes("вы победили");
    const isDraw = text.includes("draw") || text.includes("ничья") || text.includes("stalemate") || text.includes("пат");

    if (!whiteWon && !blackWon && !youWon && !isDraw) return;

    gameResultRecorded = true;
    let outcome = "draw";
    if (youWon) outcome = "win";
    else if (whiteWon) outcome = myColor === "w" ? "win" : "loss";
    else if (blackWon) outcome = myColor === "b" ? "win" : "loss";

    safeSendMessage(
      { type: "RECORD_GAME_RESULT", history: sessionMoveHistory, result: outcome },
      (res) => {
        if (res && res.ok) {
          if ($("cc-misc-db-summary")) {
            $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
          }
          $("cc-opening-name").textContent =
            outcome === "win" ? "👑 ПОБЕДА ЗАПИСАНА В БАЗУ" : "◈ ОШИБКИ ПАРТИИ ИЗУЧЕНЫ";
        }
      }
    );
  }

  function updateBehavioralCheatDetector(res) {
    if (!res || !res.lastOpponentMove) return;
    if (uciHistoryList.length < 8) return;

    const drop = parseFloat(res.opponentEvalDropPawns) || 0;
    if (drop <= 0.08) {
      suspectEngineStreak++;
    } else if (drop >= 0.45) {
      suspectEngineStreak = Math.max(0, suspectEngineStreak - 2);
    }

    const banner = $("cc-peer-detector-banner");
    if (banner && suspectEngineStreak >= 5) {
      banner.style.display = "block";
      $("cc-peer-detector-text").textContent =
        `Соперник сделал ${suspectEngineStreak} ходов подряд по 1-й линии без потери оценки (0.00 CP Loss). Высокая вероятность софта!`;
    }
  }

  function mergeWasmAnalysisIntoResult(baseRes, wasmOut, state) {
    if (!baseRes || !baseRes.best || !wasmOut || !wasmOut.lines || !wasmOut.lines[1]) {
      return baseRes;
    }
    if (
      baseRes.syzygyActive ||
      baseRes.best.fromSyzygy ||
      baseRes.best.isMateInOne ||
      (!engineMaxMode && baseRes.best.isForcedMateInTwo)
    ) {
      return baseRes;
    }

    const safeSet = !engineMaxMode && Array.isArray(baseRes.safeNonRepeatingUcis) && baseRes.safeNonRepeatingUcis.length > 0
      ? new Set(baseRes.safeNonRepeatingUcis)
      : null;
    const legalSet = Array.isArray(baseRes.legalUcis) && baseRes.legalUcis.length > 0 ? new Set(baseRes.legalUcis) : null;
    const hardRejectedSet = !engineMaxMode && Array.isArray(baseRes.hardRejectedUcis) ? new Set(baseRes.hardRejectedUcis) : null;

    let chosenLine = null;
    const engineCandidates = [wasmOut.primaryLine, wasmOut.lines[1], wasmOut.lines[2], wasmOut.lines[3]]
      .filter((candidate, index, all) => candidate && all.findIndex(item => item?.uci === candidate.uci) === index);
    for (const candidate of engineCandidates) {
      if (!candidate || !candidate.uci) continue;
      if (legalSet && !legalSet.has(candidate.uci)) continue;
      if (hardRejectedSet?.has(candidate.uci)) continue;
      if (candidate.isMate && candidate.mateIn > 0) {
        chosenLine = candidate;
        break;
      }
      const isPrimary = candidate === engineCandidates[0];
      if (engineMaxMode || isPrimary || !safeSet || safeSet.has(candidate.uci)) {
        if (candidate === engineCandidates[0] || candidate.scoreCp >= -40 || candidate.scoreCp >= (wasmOut.lines[1].scoreCp - 110)) {
          chosenLine = candidate;
          break;
        }
      }
    }

    if (!chosenLine) {
      return baseRes;
    }

    if (
      !engineMaxMode &&
      baseRes.best.fromCloud &&
      baseRes.best.uci !== chosenLine.uci &&
      Number(baseRes.best.cloudDepth) >= Number(chosenLine.depth || 0)
    ) {
      return baseRes;
    }

    if (
      !engineMaxMode &&
      trapRadarEnabled &&
      baseRes.best.isTrap &&
      baseRes.best.trapChance >= 84 &&
      (currentStyle === "tal" || currentStyle === "mogging" || currentStyle === "hikaru") &&
      baseRes.best.pureSearchScore >= -45 &&
      !chosenLine.isMate
    ) {
      return baseRes;
    }

    const pieceAtSq = (sq) => {
      if (!state || !state.grid || !sq || sq.length < 2) return "p";
      const c = FILES.indexOf(sq[0]);
      const r = 8 - parseInt(sq[1], 10);
      const p = state.grid[r]?.[c];
      return p ? p.toLowerCase() : "p";
    };

    const capturedAtSq = (sq, fromSq = null) => {
      if (!state || !state.grid || !sq || sq.length < 2) return null;
      const c = FILES.indexOf(sq[0]);
      const r = 8 - parseInt(sq[1], 10);
      const p = state.grid[r]?.[c];
      if (p) return p.toLowerCase();
      if (fromSq && pieceAtSq(fromSq) === "p" && fromSq[0] !== sq[0]) return "p";
      return null;
    };

    const isMateIn1 = Boolean(chosenLine.isMate && chosenLine.mateIn === 1);
    const isMateIn2 = Boolean(chosenLine.isMate && chosenLine.mateIn === 2);
    const sameAsBase = chosenLine.uci === baseRes.best.uci;
    const evalPawnsStr = chosenLine.isMate
      ? (chosenLine.mateIn > 0 ? `МАТ #${chosenLine.mateIn}` : `-МАТ #${Math.abs(chosenLine.mateIn)}`)
      : (chosenLine.scoreCp / 100).toFixed(2);
    const whiteEval = chosenLine.isMate
      ? (state.sideToAnalyze === "w" ? (chosenLine.mateIn > 0 ? 10 : -10) : (chosenLine.mateIn > 0 ? -10 : 10))
      : ((state.sideToAnalyze === "w" ? chosenLine.scoreCp : -chosenLine.scoreCp) / 100).toFixed(2);

    const updatedBest = {
      ...baseRes.best,
      uci: chosenLine.uci,
      from: chosenLine.from,
      to: chosenLine.to,
      promo: chosenLine.promo || null,
      piece: pieceAtSq(chosenLine.from),
      captured: capturedAtSq(chosenLine.to, chosenLine.from),
      isEnPassant: pieceAtSq(chosenLine.from) === "p" && chosenLine.from[0] !== chosenLine.to[0] && !capturedAtSq(chosenLine.to),
      fromWasm: true,
      fromCloud: sameAsBase ? baseRes.best.fromCloud : false,
      fromExplorer: sameAsBase ? baseRes.best.fromExplorer : false,
      cloudDepth: sameAsBase ? baseRes.best.cloudDepth : 0,
      isMateInOne: isMateIn1,
      isForcedMateInTwo: isMateIn2,
      isCheckmate: Boolean(chosenLine.isMate && chosenLine.mateIn > 0),
      blundersMate: false,
      causesStalemate: false,
      isRepetitionDrawRisk: false,
      underDirectAttack: sameAsBase ? baseRes.best.underDirectAttack : false,
      ignoredHangingPiece: sameAsBase ? baseRes.best.ignoredHangingPiece : false,
      ruinedCastling: sameAsBase ? baseRes.best.ruinedCastling : false,
      bookName: sameAsBase ? baseRes.best.bookName : null,
      savedHangingPiece: sameAsBase ? baseRes.best.savedHangingPiece : null,
      isSacrifice: sameAsBase ? baseRes.best.isSacrifice : false,
      isFork: sameAsBase ? baseRes.best.isFork : false,
      isPin: sameAsBase ? baseRes.best.isPin : false,
      trueScore: chosenLine.scoreCp,
      pvLine: chosenLine.pvChain || baseRes.best.pvLine,
      pureSearchScore: chosenLine.scoreCp,
      evalPawns: evalPawnsStr,
      whitePerspectiveEval: whiteEval,
      isTrap: sameAsBase ? baseRes.best.isTrap : false,
      engineHashMb: wasmOut.hashMb || 0,
      engineWorkers: wasmOut.workers || 1,
      engineDepth: chosenLine.depth || 0,
      engineConsensus: wasmOut.consensus || "primary-only",
      engineNps: chosenLine.nps || 0,
      engineHashFull: chosenLine.hashFull || 0
    };

    let updatedAvg = baseRes.average;
    const averageLine = [1, 2, 3]
      .map(index => wasmOut.lines[index])
      .find(line => line && line.uci !== updatedBest.uci && (!safeSet || safeSet.has(line.uci)));
    if (showAverageMove && averageLine) {
      const l2 = averageLine;
      if (!safeSet || safeSet.has(l2.uci)) {
        updatedAvg = {
          ...(baseRes.average || baseRes.best),
          uci: l2.uci,
          from: l2.from,
          to: l2.to,
          promo: l2.promo || null,
          piece: pieceAtSq(l2.from),
          captured: capturedAtSq(l2.to, l2.from),
          fromWasm: true,
          isMateInOne: false,
          isForcedMateInTwo: false,
          isCheckmate: Boolean(l2.isMate && l2.mateIn > 0),
          blundersMate: false,
          causesStalemate: false,
          isRepetitionDrawRisk: false,
          underDirectAttack: false,
          ignoredHangingPiece: false,
          ruinedCastling: false,
          savedHangingPiece: null,
          isSacrifice: false,
          isFork: false,
          isPin: false,
          trueScore: l2.scoreCp,
          pvLine: l2.pvChain,
          pureSearchScore: l2.scoreCp,
          evalPawns: l2.isMate
            ? (l2.mateIn > 0 ? `МАТ #${l2.mateIn}` : `-МАТ #${Math.abs(l2.mateIn)}`)
            : (l2.scoreCp / 100).toFixed(2),
          whitePerspectiveEval: l2.isMate
            ? (state.sideToAnalyze === "w" ? (l2.mateIn > 0 ? 10 : -10) : (l2.mateIn > 0 ? -10 : 10))
            : ((state.sideToAnalyze === "w" ? l2.scoreCp : -l2.scoreCp) / 100).toFixed(2)
        };
      }
    }

    const workerCount = wasmOut.workers || 1;
    const consensusLabel = workerCount > 1
      ? (wasmOut.consensus === "strong" ? "CONSENSUS" : wasmOut.consensus === "weak" ? "VERIFY" : "SPLIT")
      : "PRIMARY";
    const engineLabel = wasmOut.resources?.fullNnue || wasmOut.backend?.includes("full") ? "SF FULL" : "SF LOCAL";
    const updatedTelemetry = baseRes.telemetry
      ? {
          ...baseRes.telemetry,
          serverSource: `${engineLabel} ${workerCount}C • H${wasmOut.hashMb || "?"}M • D${chosenLine.depth || 12} • ${consensusLabel}`,
          nearestThreatText: isMateIn1
            ? `👑 МАТ В 1 ХОД: ${updatedBest.from}→${updatedBest.to}#`
            : (isMateIn2
                ? `👑 ФОРС. МАТ В 2 ХОДА: ${updatedBest.from}→${updatedBest.to}+`
                : `План SF LOCAL: ${updatedBest.from}→${updatedBest.to} (${evalPawnsStr})`)
        }
      : null;

    return {
      ...baseRes,
      best: updatedBest,
      average: updatedAvg,
      engineMeta: {
        workers: workerCount,
        hashMb: wasmOut.hashMb || 0,
        depth: chosenLine.depth || 0,
        selDepth: chosenLine.selDepth || chosenLine.depth || 0,
        nps: chosenLine.nps || 0,
        hashFull: chosenLine.hashFull || 0,
        consensus: wasmOut.consensus || "primary-only",
        backend: wasmOut.backend || "stockfish-19-lite-asm",
        fullNnue: Boolean(wasmOut.resources?.fullNnue || wasmOut.backend?.includes("full"))
      },
      telemetry: updatedTelemetry
    };
  }

  function applyAnalysisResult(state, res, isDeepPass = false, prevBestUci = "") {
    if (!res || res.error) return;
    const resultMeta = res.meta || null;
    if (resultMeta && !isCurrentAnalysisMeta(resultMeta)) return;
    const qualityRank = res.best?.fromSyzygy ? 60 : res.engineMeta ? 50 : isDeepPass ? 30 : 10;
    if (cachedMoves?.positionId === positionId && Number(cachedMoves.qualityRank || 0) > qualityRank) return;
    if (!isDeepPass && res.lastOpponentMove) {
      updateBehavioralCheatDetector(res);
    }
    cachedMoves = { ...res, meta: resultMeta, sessionId: analysisSessionId, positionId, positionKey: currentPositionKey, qualityRank };

    // Запоминаем лучший и средний ход на наш ход, чтобы отслеживать T1% даже при ручной игре мышкой
    if (state.actualTurn === state.myColor) {
      if (res.best && res.best.uci) legitStats.lastBestUciOnMyTurn = res.best.uci;
      if (res.average && res.average.uci) legitStats.lastAvgUciOnMyTurn = res.average.uci;
    }

    if (res.telemetry) {
      lastTelemetryData = res.telemetry;
    }
    updateLiveTelemetryUI();
    updateTimeSniperBanner(res);
    updateEvalMoodAndEngineBadge(state, res);

    if (res.best) {
      recordEvalPoint(state.boardKey, res.best.whitePerspectiveEval ?? res.best.evalPawns, res.opponentEvalDropPawns);
    }

    if (audioRadarEnabled && window.ChessFX && state.actualTurn === state.myColor) {
      const dropVal = parseFloat(res.opponentEvalDropPawns) || 0;
      if (res.best && (res.best.isMateInOne || res.best.isForcedMateInTwo || res.best.isCheckmate)) {
        window.ChessFX.playTacticalAudioPing("mate_lock", state.boardKey);
      } else if (!isDeepPass && dropVal >= 2.0) {
        window.ChessFX.playTacticalAudioPing("blunder", state.boardKey);
      } else if (res.best && res.best.isTrap && res.best.trapChance >= 85) {
        window.ChessFX.playTacticalAudioPing("trap", state.boardKey);
      }
    }

    if (isDeepPass && currentTurnDecision.boardKey === state.boardKey && !currentTurnDecision.skip) {
      if (currentTurnDecision.choiceKind === "average" && !res.isDangerPosition && res.average) currentTurnDecision.move = res.average;
      else if (res.best) currentTurnDecision.move = res.best;
    }

    if (res.positionsCount !== undefined && $("cc-misc-db-summary")) {
      $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
    }

    const mateBanner = $("cc-mate-banner");
    if (mateBanner) {
      if (res.best && (res.best.isMateInOne || res.best.isForcedMateInTwo)) {
        mateBanner.style.display = "block";
        const mateTitleEl = $("cc-mate-banner-title");
        if (mateTitleEl) {
          mateTitleEl.textContent = res.best.isMateInOne
            ? "👑💀 МАТ В 1 ХОД НА ДОСКЕ!"
            : "👑⚡ ФОРСИРОВАННЫЙ МАТ В 2 ХОДА!";
        }
        $("cc-mate-banner-text").textContent = res.best.isMateInOne
          ? `Ход ${res.best.from} → ${res.best.to}# ставит чистый мат в 1 ход!`
          : `Ход ${res.best.from} → ${res.best.to}+ ставит форсированный мат в 2 хода!`;
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
        Boolean(res.best && (res.best.isMateInOne || res.best.isForcedMateInTwo))
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
      const isBrilliant = isStrictBrilliantMove(res.best);
      const isTrap = Boolean(res.best.isTrap && res.best.trapChance >= 75);
      const isSyzygy = Boolean(res.best.fromSyzygy);
      const bestCard = $("cc-best-card");
      if (bestCard) {
        bestCard.classList.toggle("cc-brilliant-card", isBrilliant);
        bestCard.classList.toggle("cc-trap-card", !isBrilliant && isTrap);
      }

      const styleLabel = ALL_STYLE_NAMES[currentStyle] || "✦ Таль";
      if ($("cc-best-title")) {
        let badgesHtml = "";
        if (isSyzygy) badgesHtml += `<span class="cc-syzygy-badge">🔮 SYZYGY БОГ</span>`;
        if (isBrilliant) badgesHtml += `<span class="cc-brilliant-badge">💎 БРИЛЛИАНТ !!</span>`;
        if (isTrap) badgesHtml += `<span class="cc-trap-badge">🪤 ЛОВУШКА (${res.best.trapChance}%)</span>`;
        $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД (1-Я ЛИНИЯ) • ${styleLabel}${badgesHtml}`;
      }

      if ((isDeepPass || res.best.isMateInOne) && isBrilliant && phonkEditEnabled && state.actualTurn === state.myColor && window.ChessFX) {
        window.ChessFX.triggerBrilliantPhonkEdit(getShadow(), res.best, state, 15000, false);
      }

      const improvedByDeep = isDeepPass && prevBestUci && prevBestUci !== res.best.uci;
      const evalPrefix = (!res.best.isMateInOne && !res.best.isForcedMateInTwo && !res.best.fromSyzygy && parseFloat(res.best.evalPawns) > 0) ? "+" : "";
      $("cc-best-eval").textContent = `${evalPrefix}${res.best.evalPawns}`;
      $("cc-best-desc").textContent =
        (improvedByDeep ? "✦ [УЛУЧШЕНО ГЛУБИНОЙ] " : "") + explainWithModule(res.best, "best", state.fen);
      $("cc-best-pv").textContent = res.best.pvLine ? `◈ Вариант: ${res.best.pvLine}` : "";

      const openingCard = $("cc-opening-card");
      const detectedOpening = window.ChessOpenings ? window.ChessOpenings.detect(uciHistoryList) : null;

      if (res.syzygyActive && res.best.fromSyzygy) {
        if (openingCard) openingCard.style.borderLeftColor = "#c77dff";
        $("cc-opening-name").textContent = `🔮 ТАБЛИЦА SYZYGY (${res.pieceCount} ФИГУР НА ДОСКЕ)`;
        $("cc-opening-plan").textContent = `${res.best.syzygyBadge || "100% точность эндшпиля"}.`;
      } else if (res.isDangerPosition && !res.best.isMateInOne) {
        if (openingCard) openingCard.style.borderLeftColor = "#ff2a85";
        $("cc-opening-name").textContent = `🛡 АНТИ-МАТ РАДАР: ${res.dangerReason || "УГРОЗА КОРОЛЮ"}!`;
        $("cc-opening-plan").textContent = `Обнаружена угроза вашему королю — рекомендуем защиту ${res.best.from} → ${res.best.to}.`;
      } else if (res.hangingSquare && !res.best.isMateInOne) {
        if (openingCard) openingCard.style.borderLeftColor = "#ffbe0b";
        $("cc-opening-name").textContent = `⚠️ ВНИМАНИЕ: ПОЛЕ ${res.hangingSquare.toUpperCase()} ПОД БОЕМ!`;
        $("cc-opening-plan").textContent = `Фигура на ${res.hangingSquare} атакована — защитите или уведите её!`;
      } else {
        if (openingCard) openingCard.style.borderLeftColor = "var(--cc-accent)";
        if (res.best.bookName) {
          $("cc-opening-name").textContent = `◈ ДЕБЮТ: ${res.best.bookName.split("—")[0].trim()}`;
          $("cc-opening-plan").textContent = detectedOpening?.plan || res.best.bookName;
        } else if (detectedOpening) {
          $("cc-opening-name").textContent = `◈ ${detectedOpening.name.toUpperCase()}`;
          $("cc-opening-plan").textContent = detectedOpening.plan;
        }
      }

      renderEvalBar(state, res.best.whitePerspectiveEval ?? res.best.evalPawns);

      if (autoMoveEnabled && state.actualTurn === state.myColor) {
        const mySecs = getMyRemainingSeconds();
        const isExtremePanicTime = mySecs <= 5;
        const needsDeepVerification = Boolean(
          (res.isDangerPosition || res.hangingSquare) &&
          !res.best.isMateInOne &&
          !res.best.isForcedMateInTwo &&
          !res.best.fromSyzygy
        );
        if (!isDeepPass && needsDeepVerification && !isExtremePanicTime) {
          setAutoStatusText(`🛡 Глубокая проверка тактической угрозы...`, "#ffbe0b");
        } else {
          scheduleAutoMoveIfNeeded();
        }
      }
    }

    if (showAverageMove && res.average) {
      if ($("cc-avg-card")) $("cc-avg-card").style.display = "block";
      const avgPref = parseFloat(res.average.evalPawns) > 0 ? "+" : "";
      $("cc-avg-eval").textContent = `${avgPref}${res.average.evalPawns}`;
      $("cc-avg-desc").textContent = explainWithModule(res.average, "avg", state.fen);
    } else if ($("cc-avg-card")) {
      $("cc-avg-card").style.display = "none";
    }

    if (showWorstMove && workMode === "all" && res.worst) {
      if ($("cc-worst-card")) $("cc-worst-card").style.display = "block";
      const wstPref = parseFloat(res.worst.evalPawns) > 0 ? "+" : "";
      $("cc-worst-eval").textContent = `${wstPref}${res.worst.evalPawns}`;
      $("cc-worst-desc").textContent = explainWithModule(res.worst, "worst", state.fen);
    } else if ($("cc-worst-card")) {
      $("cc-worst-card").style.display = "none";
    }

    renderArrowsOverlay(state, cachedMoves);
  }

  function getStockfishMoveTimeMs(fastRes) {
    if (!engineMaxMode) {
      const base = currentElo >= 2800 ? 620 : (currentElo >= 2400 ? 420 : 300);
      return base + (fastRes.isDangerPosition || fastRes.hangingSquare ? 240 : 0);
    }
    const seconds = getMyRemainingSeconds();
    const danger = Boolean(fastRes.isDangerPosition || fastRes.hangingSquare);
    let budget = !Number.isFinite(seconds) ? 2200
      : seconds >= 300 ? 2600
      : seconds >= 120 ? 1900
      : seconds >= 45 ? 1200
      : seconds >= 15 ? 550
      : seconds >= 5 ? 220 : 80;
    if (danger) budget = Math.round(budget * 1.3);
    if (Number.isFinite(seconds)) {
      const reserve = Math.max(1200, seconds * 50);
      budget = Math.min(budget, Math.max(70, seconds * 1000 - reserve - 850));
    }
    return Math.max(70, Math.min(3600, Math.round(budget)));
  }

  function runCycle(forceByButton = false) {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }

    ensurePanel();
    updateLiveTelemetryUI();

    const state = captureBoardState(false);
    if (!state) {
      if (currentPositionKey) markBoardDirty("NO_BOARD");
      if (activeEngineBoardKey) {
        analysisRequestId++;
        activeEngineBoardKey = "";
        StockfishWasmEngine.cancel?.();
      }
      hideArrows();
      renderEvalBar(null, 0);
      updateEvalMoodAndEngineBadge(null, null);
      return;
    }
    if (state.animating) return;
    adoptPositionState(state);
    if (!forceByButton && (isExecutingMove || Date.now() < moveCooldownUntil)) return;
    if (activeEngineBoardKey && activeEngineBoardKey !== state.boardKey) {
      analysisRequestId++;
      activeEngineBoardKey = "";
      StockfishWasmEngine.cancel?.();
    }

    checkGameEndAndLearn(state.myColor);

    const standbyBox = $("cc-enemy-turn-standby");
    const activeBox = $("cc-my-turn-active");
    const deepBadge = $("cc-deep-status");

    if (!forceByButton && turnMode === "my" && state.actualTurn !== state.myColor) {
      resetTurnDecision();
      if (deepBadge) deepBadge.style.display = "none";
      if (standbyBox) {
        standbyBox.style.display = "flex";
        const mySideText = state.myColor === "w" ? "вы за Белых ⚪" : "вы за Черных ⚫";
        $("cc-standby-title").textContent = `Ход соперника (${mySideText})`;
      }
      if (activeBox) activeBox.style.display = "none";
      if (autoMoveEnabled) {
        setAutoStatusText("Ждем ответа соперника на Chess.com...", "#94a3b8");
      }
      committedBoardKey = "";

      if (committedEnemyBoardKey !== state.boardKey) {
        committedEnemyBoardKey = state.boardKey;
        hideArrows();
        if (isAltPressed || heatmapAlwaysOn) {
          safeSendMessage({ type: "GET_BOARD_HEATMAP", fen: state.fen, myColor: state.myColor }, (hmRes) => {
            if (hmRes && Array.isArray(hmRes.heatmap)) {
              const fresh = captureBoardState(true);
              if (!fresh || fresh.animating || fresh.boardElement !== state.boardElement || fresh.boardKey !== state.boardKey) return;
              cachedMoves.heatmap = hmRes.heatmap;
              cachedMoves.heatmapBoardKey = state.boardKey;
              cachedMoves.boardKey = state.boardKey;
              cachedMoves.positionId = positionId;
              cachedMoves.positionKey = currentPositionKey;
              renderArrowsOverlay(fresh, cachedMoves);
            }
          });
        }
      }
      return;
    }

    if (standbyBox) standbyBox.style.display = "none";
    if (activeBox) activeBox.style.display = "flex";

    if (!forceByButton && state.boardKey === committedBoardKey) {
      if (
        autoMoveEnabled &&
        state.actualTurn === state.myColor &&
        !autoMoveTimer &&
        !currentTurnDecision.skip &&
        cachedMoves.best &&
        cachedMoves.boardKey === state.boardKey &&
        (!(cachedMoves.isDangerPosition || cachedMoves.hangingSquare) || cachedMoves.pass === "deep")
      ) {
        scheduleAutoMoveIfNeeded();
      }
      return;
    }

    committedBoardKey = state.boardKey;
    committedEnemyBoardKey = "";
    resetTurnDecision();

    const myReqId = ++analysisRequestId;
    const cycleAnalysisId = ++positionAnalysisId;
    const fastMeta = createAnalysisMeta(state, "fast", cycleAnalysisId);
    const deepMeta = createAnalysisMeta(state, "deep", cycleAnalysisId);
    activeEngineBoardKey = state.boardKey;
    const sideText = state.sideToAnalyze === "w" ? "ХОД БЕЛЫХ ⚪" : "ХОД ЧЕРНЫХ ⚫";
    if ($("cc-turn-indicator")) $("cc-turn-indicator").textContent = sideText;

    const mySecs = getMyRemainingSeconds();
    const enemySecs = getEnemyRemainingSeconds();
    const needAvg = Boolean(!engineMaxMode && (showAverageMove || useAverageMoveSometimes || autoT1LimiterEnabled));
    const needWorst = Boolean(!engineMaxMode && showWorstMove && workMode === "all");

    safeSendMessage(
      {
        type: "ANALYZE_POSITION",
        fen: state.fen,
        elo: currentElo,
        style: currentStyle,
        pass: "fast",
        lastEnemyMove: lastRealEnemyMove,
        bulletTurbo: false,
        calcAverage: needAvg,
        calcWorst: needWorst,
        myColor: state.myColor,
        mySeconds: mySecs,
        enemySeconds: enemySecs,
        trapRadarEnabled,
        recentPositions: recentPositionHistory,
        lastOurMove: lastOurExecutedMove,
        uciHistory: uciHistoryList,
        historyTrusted: gameStartedFromInitial,
        meta: fastMeta
      },
      (fastRes) => {
        const responseMeta = fastRes?.meta || fastMeta;
        if (myReqId !== analysisRequestId || !isCurrentAnalysisMeta(responseMeta)) return;
        if (!fastRes || !fastRes.best || fastRes.error) {
          activeEngineBoardKey = "";
          clearPositionPresentation(fastRes?.error ? "ОШИБКА АНАЛИЗА • ПОВТОР..." : "МАТ / ПАТ • НЕТ ХОДОВ");
          committedBoardKey = fastRes?.error ? "" : state.boardKey;
          if (fastRes?.error && analysisRetryCount < 5) {
            const retryDelay = Math.min(3000, 180 * (2 ** analysisRetryCount++));
            setTimeout(triggerDebouncedCycle, retryDelay);
          }
          else boardDirty = false;
          if (fastRes?.error && analysisRetryCount >= 5) committedBoardKey = state.boardKey;
          return;
        }
        fastRes.meta = responseMeta;
        analysisRetryCount = 0;
        applyAnalysisResult(state, fastRes, false, "");

        if (fastRes.best && (fastRes.best.isMateInOne || (!engineMaxMode && fastRes.best.isForcedMateInTwo) || fastRes.best.fromSyzygy)) {
          if (deepBadge) deepBadge.style.display = "none";
          if (myReqId === analysisRequestId) activeEngineBoardKey = "";
          return;
        }

        if (deepBadge) {
          deepBadge.textContent = fastRes.isDangerPosition
            ? "🛡 ПОИСК ЗАЩИТЫ..."
            : (useStockfishWasm ? "🧠 SF LOCAL + CLOUD..." : "⚡ ДОРАСЧЕТ...");
          deepBadge.style.display = "inline-block";
        }
        const firstBestUci = fastRes.best ? fastRes.best.uci : "";

        const shouldRunWasm = Boolean(useStockfishWasm && (engineMaxMode || currentElo >= 1800) && state.pieceCount > 7);
        const wasmMovetime = getStockfishMoveTimeMs(fastRes);
        const wasmPromise = shouldRunWasm
          ? StockfishWasmEngine.analyze(state.fen, wasmMovetime, needAvg ? 3 : 1, uciHistoryList, gameStartedFromInitial, { ...deepMeta, engineMaxMode, isDangerPosition: Boolean(fastRes.isDangerPosition || fastRes.hangingSquare), needAverage: needAvg })
          : Promise.resolve(null);

        safeSendMessage(
          {
            type: "ANALYZE_POSITION",
            fen: state.fen,
            elo: currentElo,
            style: currentStyle,
            pass: "deep",
            lastEnemyMove: lastRealEnemyMove,
            bulletTurbo: false,
            calcAverage: needAvg,
            calcWorst: needWorst,
            myColor: state.myColor,
            mySeconds: mySecs,
            enemySeconds: enemySecs,
            trapRadarEnabled,
            recentPositions: recentPositionHistory,
            lastOurMove: lastOurExecutedMove,
            uciHistory: uciHistoryList,
            historyTrusted: gameStartedFromInitial,
            meta: deepMeta
          },
          async (deepRes) => {
            const responseMeta = deepRes?.meta || deepMeta;
            if (myReqId !== analysisRequestId || !isCurrentAnalysisMeta(responseMeta)) return;
            const backgroundDeepOk = Boolean(deepRes && !deepRes.error && deepRes.best);
            let finalDeep = backgroundDeepOk ? deepRes : fastRes;
            let wasmApplied = false;
            if (shouldRunWasm) {
              try {
                const wasmOut = await wasmPromise;
                if (myReqId !== analysisRequestId || !isCurrentAnalysisMeta(deepMeta)) return;
                if (wasmOut) {
                  finalDeep = mergeWasmAnalysisIntoResult(finalDeep, wasmOut, state);
                  wasmApplied = Boolean(finalDeep?.engineMeta);
                }
              } catch (e) {}
            }

            if (!backgroundDeepOk && !wasmApplied) {
              if (deepBadge) deepBadge.style.display = "none";
              if (myReqId === analysisRequestId) activeEngineBoardKey = "";
              return;
            }

            if (deepBadge) deepBadge.style.display = "none";

            finalDeep.meta = deepMeta;
            applyAnalysisResult(state, finalDeep, true, firstBestUci);
            if (myReqId === analysisRequestId) activeEngineBoardKey = "";
          }
        );
      }
    );
  }

  let rafPending = false;
  function triggerDebouncedCycle() {
    if (extensionInvalidated || rafPending || isExecutingMove || Date.now() < moveCooldownUntil) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      runCycle(false);
    });
  }

  let observedBoardNode = null;
  let observedBoardRoots = [];
  const domObserver = new MutationObserver((mutations) => {
    if (mutations.some(mutation => mutation.type === "childList")) cachedChessComRoots = [];
    const touchesPiece = mutations.some(mutation => {
      const target = mutation.target;
      if (target?.matches?.(".piece, piece")) return true;
      return [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])].some(node =>
        node?.matches?.(".piece, piece") || node?.querySelector?.(".piece, piece")
      );
    });
    if (touchesPiece) markBoardDirty("MOVE");
    syncVisualPosition();
    triggerDebouncedCycle();
  });
  const boardResizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => syncVisualPosition()) : null;

  function ensureObserversAttached() {
    if (extensionInvalidated || !isContextValid()) return;
    const boardEl = findChessComBoardElement();
    const roots = boardEl ? getChessComBoardRoots(boardEl) : [];
    if (boardEl !== observedBoardNode || roots.length !== observedBoardRoots.length || roots.some((root, i) => root !== observedBoardRoots[i])) {
      domObserver.disconnect();
      if (boardResizeObserver) boardResizeObserver.disconnect();
      if (boardEl !== observedBoardNode) {
        markBoardDirty("BOARD_REPLACED");
      }
      observedBoardNode = boardEl;
      observedBoardRoots = roots;
      for (const root of roots) {
        domObserver.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "orientation"]
        });
      }
      if (boardEl && boardResizeObserver) boardResizeObserver.observe(boardEl);
      syncVisualPosition();
      triggerDebouncedCycle();
    }
  }

  const syncVisualPosition = () => {
    if (extensionInvalidated || !isContextValid()) return;
    ensureObserversAttached();
    const state = captureBoardState(true);
    if (!state || state.animating || !isCachedAnalysisCurrent(state) || (!cachedMoves.best && !isAltPressed && !heatmapAlwaysOn)) {
      hideArrows();
      renderEvalBar(null, 0);
      if (!state) updateEvalMoodAndEngineBadge(null, null);
      return;
    }
    renderEvalBar(state, cachedMoves.best?.whitePerspectiveEval ?? cachedMoves.best?.evalPawns ?? 0);
    const svg = $("chesscoach-screen-svg");
    const r = state.boardRect;
    if (!svg || svg.style.display === "none" || svg.style.left !== `${r.left}px` || svg.style.top !== `${r.top}px` ||
        svg.style.width !== `${r.width}px` || svg.style.height !== `${r.height}px` ||
        svg.getAttribute("data-cc-orientation") !== (state.isBlackOrientation ? "black" : "white") ||
        svg.getAttribute("data-cc-board-key") !== state.boardKey) {
      renderArrowsOverlay(state, cachedMoves);
    }
  };

  try { chrome.storage?.onChanged?.addListener(handleStorageChanges); } catch (e) {}
  loadSettings();
  ensureObserversAttached();

  mainIntervalId = setInterval(() => {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }
    syncVisualPosition();
    if (!isExecutingMove && Date.now() >= moveCooldownUntil) {
      runCycle(false);
    }
  }, 260);

  window.addEventListener("scroll", syncVisualPosition, { passive: true, capture: true });
  window.addEventListener("resize", syncVisualPosition, { passive: true });
  document.addEventListener?.("visibilitychange", handleEngineVisibilityChange);
  window.addEventListener("pagehide", handleEngineVisibilityChange);
})();
