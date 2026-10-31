(function () {
  console.log("[ChessCoach REWORK v15.0 — HvH/All/Legit Modes, Live Telemetry 24/7 & Custom BG] Запущен!");

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

  const stealthChannelName = "cc_" + Math.random().toString(36).slice(2, 12) + "_" + Date.now().toString(36);
  try {
    document.documentElement.setAttribute("data-cc-hs", stealthChannelName);
    window.dispatchEvent(new CustomEvent("cc-hs-init"));
    document.documentElement.removeAttribute("data-cc-hs");
  } catch (e) {}

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

  const PREMOVE_RISK_LABELS = {
    1: "🛡 Ур. 1: 100% Форсаж (Честный перебой / 1 ход)",
    2: "⚡ Ур. 2: Форсаж + Надежная теория",
    3: "🎯 Ур. 3: Умный Блиц (Мульти-ветки SEE)",
    4: "🔥 Ур. 4: Резня 1+0 (Максимум премувов)"
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
    obsidian: ["#f8fafc", "#94a3b8"]
  };

  const DUBIOUS_GAMBIT_KEYWORDS = [
    "Инопланетный",
    "Хэллоуин",
    "Теннисона",
    "ICBM",
    "Нахмансона",
    "Стаффорда",
    "Тракслера",
    "Энглунда",
    "Блэкберна",
    "Кохрена"
  ];

  const FILES = "abcdefgh";

  // Режим работы меню: "all" | "hvh" | "legit"
  let workMode = "all";
  let activeTabId = "analyzer";
  let panelLeft = null;
  let panelTop = null;
  let panelMinimized = false;
  let panelHidden = false;

  // Пользовательский фон из проводника
  let customBgDataUrl = "";
  let customBgDim = 0.72;
  let customBgBlur = 4;

  // Живая телеметрия 24/7 (работает даже в ход соперника)
  let liveTelemetryEnabled = true;
  let teleShowClocks = true;
  let teleShowEngine = true;
  let teleShowWdl = true;
  let teleShowThreats = true;
  let lastTelemetryData = {
    serverSource: "ГОТОВ",
    pingMs: 0,
    myWin: 50,
    draw: 30,
    enemyWin: 20,
    nearestThreatText: "Ожидание начала партии..."
  };

  let currentElo = 2000;
  let currentStyle = "tal";
  let showArrows = true;
  let showEvalBar = true;
  let showAverageMove = true;
  let showWorstMove = true;
  let turnMode = "my";
  let forcedMyColor = "auto";

  let useStockfishWasm = true;
  let trapRadarEnabled = true;
  let audioRadarEnabled = true;
  let heatmapAlwaysOn = false;
  let isAltPressed = false;

  let autoMoveEnabled = false;
  let bulletTurboMode = false;
  let legitAutoTiming = true;
  let autoMoveDelayMs = 180;
  let autoMoveJitterMs = 60;
  let autoMoveTriggerRate = 100;
  let useAverageMoveSometimes = false;
  let averageMoveFrequency = 20;
  let protectCriticalMoves = true;
  let autoClickMethod = "hybrid";

  let premoveEnabled = false;
  let premoveRiskLevel = 3;
  let premoveOpeningMode = "auto";
  let showPremoveArrows = true;

  let uiTheme = "cyberpunk";
  let arrowStyle = "curved_neon";
  let arrowScale = 1.0;
  let arrowOpacity = 0.88;
  let enable3DPiecesShadow = true;
  let phonkEditEnabled = true;
  let mateStyle = "phonk_skull";
  let roflMode = true;
  let safeAntiBanGuard = false;
  let welcomeBannerHidden = false;

  let castlingRights = { K: true, Q: true, k: true, q: true };
  let prevGridState = null;
  let prevBoardPartForHistory = "";
  let currentEpSquare = "-";
  let lastPathname = location.pathname;
  let lastRealEnemyMove = null;
  let lastOurExecutedMove = null;

  let committedBoardKey = "";
  let committedEnemyBoardKey = "";
  let lastPremoveSentBoardKey = "";
  let analysisRequestId = 0;
  let premoveReqId = 0;
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
  let preparedLookahead = null;
  let openingBookDeviated = false;
  let currentRoast = null;

  let evalGraphHistory = [];
  let lastRecordedGraphBoardKey = "";
  let recentPositionHistory = [];
  let gameStartedFromInitial = false;

  let autoMoveTimer = null;
  let premoveTimer = null;
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
  let peerExtensionDetected = false;
  let suspectEngineStreak = 0;
  let lastBeaconCheckTime = 0;
  let uciHistoryList = [];
  let gameResultRecorded = false;

  let shadowRoot = null;
  let extensionInvalidated = false;
  let mainIntervalId = null;
  let neuralCanvasRafId = null;

  const StockfishWasmEngine = (function () {
    let worker = null;
    let isReady = false;
    let isInitializing = false;
    let activeJob = null;
    let awaitingReadySync = false;

    async function initWorker() {
      if (worker || isInitializing || extensionInvalidated || !isContextValid()) return;
      isInitializing = true;
      try {
        const scriptUrl = chrome.runtime.getURL("lib/stockfish-local.js");
        const resp = await fetch(scriptUrl);
        if (!resp.ok) throw new Error("Не удалось загрузить stockfish-local.js");
        const codeText = await resp.text();
        const blob = new Blob([codeText], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);

        worker = new Worker(blobUrl);
        worker.onmessage = (e) => handleEngineLine(String(e.data || ""));
        worker.onerror = () => {
          isReady = false;
          isInitializing = false;
        };

        worker.postMessage("uci");
        worker.postMessage("setoption name Threads value 1");
        worker.postMessage("setoption name Hash value 16");
        worker.postMessage("setoption name MultiPV value 3");
        worker.postMessage("isready");
      } catch (err) {
        isInitializing = false;
        worker = null;
      }
    }

    function handleEngineLine(line) {
      if (!line) return;
      if (line.includes("uciok")) {
        isReady = true;
        isInitializing = false;
        return;
      }
      if (line.includes("readyok")) {
        isReady = true;
        isInitializing = false;
        if (awaitingReadySync && activeJob) {
          awaitingReadySync = false;
          try {
            worker.postMessage(`setoption name MultiPV value ${activeJob.multiPv}`);
            if (activeJob.useStartposMoves && activeJob.uciMoves && activeJob.uciMoves.length > 0) {
              worker.postMessage(`position startpos moves ${activeJob.uciMoves.join(" ")}`);
            } else {
              worker.postMessage(`position fen ${activeJob.fen}`);
            }
            worker.postMessage(`go movetime ${activeJob.movetimeMs}`);
          } catch (e) {}
        }
        return;
      }

      if (!activeJob || awaitingReadySync) return;

      if (line.startsWith("info ") && line.includes(" pv ")) {
        const depthMatch = line.match(/\bdepth\s+(\d+)/);
        const mpvMatch = line.match(/\bmultipv\s+(\d+)/);
        const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
        const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
        const pvSplit = line.split(" pv ");

        if (pvSplit.length > 1) {
          const moves = pvSplit[1].trim().split(/\s+/);
          const firstUci = moves[0] || "";
          if (firstUci.length >= 4) {
            const mpvIdx = mpvMatch ? parseInt(mpvMatch[1], 10) : 1;
            const depth = depthMatch ? parseInt(depthMatch[1], 10) : 1;
            let scoreCp = 0;
            let isMate = false;
            let mateIn = null;

            if (mateMatch) {
              mateIn = parseInt(mateMatch[1], 10);
              isMate = true;
              scoreCp = mateIn > 0 ? (30000 - mateIn * 20) : (-30000 - mateIn * 20);
            } else if (cpMatch) {
              scoreCp = parseInt(cpMatch[1], 10);
            }

            activeJob.lines[mpvIdx] = {
              uci: firstUci,
              from: firstUci.slice(0, 2),
              to: firstUci.slice(2, 4),
              promo: firstUci.length > 4 ? firstUci[4].toLowerCase() : null,
              depth,
              scoreCp,
              isMate,
              mateIn,
              pvChain: moves.slice(0, 4).map(u => `${u.slice(0, 2)}→${u.slice(2, 4)}`).join(" ➔ ")
            };
          }
        }
      } else if (line.startsWith("bestmove ")) {
        const job = activeJob;
        activeJob = null;
        if (job.timer) clearTimeout(job.timer);
        const parts = line.split(/\s+/);
        const bestUci = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
        job.resolve({
          bestUci,
          lines: job.lines
        });
      }
    }

    function analyze(fen, movetimeMs = 190, multiPv = 3, uciMoves = [], useStartposMoves = false) {
      return new Promise((resolve) => {
        if (!useStockfishWasm || extensionInvalidated) {
          resolve(null);
          return;
        }
        if (!worker) {
          initWorker();
          resolve(null);
          return;
        }
        if (!isReady) {
          resolve(null);
          return;
        }

        if (activeJob) {
          if (activeJob.timer) clearTimeout(activeJob.timer);
          activeJob.resolve(null);
          activeJob = null;
        }

        const job = {
          fen,
          movetimeMs,
          multiPv,
          uciMoves: Array.isArray(uciMoves) ? uciMoves.slice() : [],
          useStartposMoves: Boolean(useStartposMoves),
          lines: {},
          resolve,
          timer: setTimeout(() => {
            if (activeJob === job) {
              try { worker.postMessage("stop"); } catch (e) {}
              activeJob = null;
              awaitingReadySync = false;
              resolve({ bestUci: job.lines[1]?.uci || null, lines: job.lines });
            }
          }, movetimeMs + 160)
        };

        activeJob = job;
        awaitingReadySync = true;
        try {
          worker.postMessage("stop");
          worker.postMessage("isready");
        } catch (e) {
          clearTimeout(job.timer);
          activeJob = null;
          awaitingReadySync = false;
          resolve(null);
        }
      });
    }

    function terminate() {
      if (worker) {
        try { worker.terminate(); } catch (e) {}
        worker = null;
        isReady = false;
      }
    }

    return {
      initWorker,
      analyze,
      terminate,
      isReady: () => isReady
    };
  })();

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function shutdownOrphanedScript() {
    extensionInvalidated = true;
    StockfishWasmEngine.terminate();
    if (mainIntervalId) { clearInterval(mainIntervalId); mainIntervalId = null; }
    if (neuralCanvasRafId) { cancelAnimationFrame(neuralCanvasRafId); neuralCanvasRafId = null; }
    if (autoMoveTimer) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
    if (premoveTimer) { clearTimeout(premoveTimer); premoveTimer = null; }
    if (animRetryTimer) { clearTimeout(animRetryTimer); animRetryTimer = null; }
    if (window.ChessFX && shadowRoot) {
      window.ChessFX.stopPhonkEdit(shadowRoot);
    }
    const pageStyle = document.getElementById("cc-lichess-board-3d-style");
    if (pageStyle) pageStyle.remove();
    window.removeEventListener("scroll", syncVisualPosition);
    window.removeEventListener("resize", syncVisualPosition);
    try {
      if (domObserver) domObserver.disconnect();
    } catch (e) {}
  }

  function safeSendMessage(payload, callback) {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }
    try {
      chrome.runtime.sendMessage(payload, (res) => {
        try {
          if (chrome.runtime.lastError) return;
          if (callback) callback(res);
        } catch (err) {
          shutdownOrphanedScript();
        }
      });
    } catch (err) {
      shutdownOrphanedScript();
    }
  }

  function getShadow() {
    if (shadowRoot) return shadowRoot;
    const host = document.createElement("div");
    host.setAttribute("data-layer", "cc-rework-hud");
    host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483646;";
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "closed" });

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

  function applySafeBoardDepth() {
    let pageStyle = document.getElementById("cc-lichess-board-3d-style");
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = "cc-lichess-board-3d-style";
      document.head.appendChild(pageStyle);
    }

    let css = "";
    if (enable3DPiecesShadow) {
      css += `
        .main-board .cg-wrap, .round__app__board .cg-wrap {
          box-shadow:
            0 8px 0 #181c26,
            0 18px 38px rgba(0, 0, 0, 0.82),
            0 0 22px rgba(0, 245, 212, 0.10) !important;
          border-radius: 6px !important;
        }
        cg-board piece {
          filter: drop-shadow(0 5px 5px rgba(0, 0, 0, 0.62)) !important;
        }
      `;
    }
    css += `
      cg-board square.current-premove {
        background-color: rgba(199, 125, 255, 0.48) !important;
        box-shadow: inset 0 0 14px rgba(0, 245, 212, 0.65) !important;
      }
    `;
    pageStyle.textContent = css;
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

  function applyWorkModePreset(mode, triggerSave = true) {
    workMode = mode;
    const panel = $("chesscoach-panel");
    if (panel) {
      panel.setAttribute("data-work-mode", mode);
    }

    if (mode === "hvh") {
      // Режим HvH: 3000 ELO, Стокфиш 3000 + Syzygy, отключены средний и худший ход, Резня 1+0 ВКЛ
      currentElo = 3000;
      currentStyle = "balanced";
      useStockfishWasm = true;
      showAverageMove = false;
      showWorstMove = false;
      useAverageMoveSometimes = false;
      protectCriticalMoves = true;
      bulletTurboMode = true;
      legitAutoTiming = false;
      autoMoveEnabled = true;
      premoveEnabled = true;
      showPremoveArrows = true;
      premoveRiskLevel = 3;
      autoMoveDelayMs = 42;
      autoMoveJitterMs = 15;
      autoMoveTriggerRate = 100;
      StockfishWasmEngine.initWorker();

      if (triggerSave) {
        saveSetting({
          workMode: "hvh",
          elo: 3000,
          style: "balanced",
          useStockfishWasm: true,
          showAverageMove: false,
          showWorstMove: false,
          useAverageMoveSometimes: false,
          protectCriticalMoves: true,
          bulletTurboMode: true,
          legitAutoTiming: false,
          autoMoveEnabled: true,
          premoveEnabled: true,
          showPremoveArrows: true,
          premoveRiskLevel: 3,
          autoMoveDelayMs: 42,
          autoMoveJitterMs: 15,
          autoMoveTriggerRate: 100
        });
      }
      setAutoStatusText("⚡ ПРОФИЛЬ HvH АКТИВЕН (3000 ELO • РЕЗНЯ + ПРЕМУВ)", "#ff2a85");
    } else if (mode === "legit") {
      // Режим Legit: 3000 ELO, профиль Таль, отключен слабый ход, Резня 1+0 ВЫКЛ, адаптивный живой тайминг с джиттером
      currentElo = 3000;
      currentStyle = "tal";
      useStockfishWasm = true;
      showAverageMove = true;
      showWorstMove = false;
      bulletTurboMode = false;
      premoveEnabled = false;
      showPremoveArrows = false;
      legitAutoTiming = true;
      protectCriticalMoves = true;
      useAverageMoveSometimes = true;
      averageMoveFrequency = 15;
      autoMoveDelayMs = 460;
      autoMoveJitterMs = 220;
      StockfishWasmEngine.initWorker();

      if (triggerSave) {
        saveSetting({
          workMode: "legit",
          elo: 3000,
          style: "tal",
          useStockfishWasm: true,
          showAverageMove: true,
          showWorstMove: false,
          bulletTurboMode: false,
          premoveEnabled: false,
          showPremoveArrows: false,
          legitAutoTiming: true,
          protectCriticalMoves: true,
          useAverageMoveSometimes: true,
          averageMoveFrequency: 15,
          autoMoveDelayMs: 460,
          autoMoveJitterMs: 220
        });
      }
      setAutoStatusText("🛡 ПРОФИЛЬ LEGIT АКТИВЕН (3000 ELO • ТАЛЬ • ЖИВОЙ ДЖИТТЕР)", "#38b000");
    } else {
      // Режим "ВСЕ": полный доступ ко всем функциям
      if (triggerSave) {
        saveSetting({ workMode: "all" });
      }
      setAutoStatusText("◈ ПОЛНЫЙ РЕЖИМ «ВСЕ ФУНКЦИИ» АКТИВЕН", "#00f5d4");
    }

    updateUIValues();
    if (triggerSave) {
      forceRecalculate();
    }
  }

  function detectPlayerDisplayName() {
    const tagEl = document.querySelector("#user_tag, .dasher .toggle, .ruser-bottom .user-link");
    if (tagEl && tagEl.textContent) {
      const clean = tagEl.textContent.trim().replace(/\s+/g, " ").split(" ")[0];
      if (clean && clean.length >= 2 && clean.length <= 22) return clean;
    }
    return "Гроссмейстер";
  }

  function getDynamicGreetingText() {
    const hour = new Date().getHours();
    const user = detectPlayerDisplayName();
    if (hour >= 5 && hour < 12) return `☀️ Доброе утро, ${user}! Готов разрывать Lichess?`;
    if (hour >= 12 && hour < 18) return `⚡ Привет, ${user}! Тактический радар заряжен на 100%`;
    if (hour >= 18 && hour < 23) return `🌌 Добрый вечер, ${user}! Время жесткого доминирования`;
    return `🌙 Ночная катка, ${user}? Движок в максимальном фокусе!`;
  }

  function initNeuralCanvasBackground(panel) {
    const canvas = $("cc-neural-canvas");
    if (!canvas || !panel) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const particles = Array.from({ length: 26 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.8 + 0.9
    }));

    const renderFrame = () => {
      if (extensionInvalidated) return;
      if (panel.classList.contains("cc-minimized") || panel.style.display === "none") {
        neuralCanvasRafId = requestAnimationFrame(renderFrame);
        return;
      }

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
            "elo", "style", "showArrows", "showEvalBar", "showAverageMove", "showWorstMove",
            "useStockfishWasm", "trapRadarEnabled", "audioRadarEnabled", "heatmapAlwaysOn",
            "uiTheme", "arrowStyle", "arrowScale", "arrowOpacity", "enable3DPiecesShadow",
            "phonkEditEnabled", "mateStyle", "roflMode", "safeAntiBanGuard", "welcomeBannerHidden",
            "autoMoveEnabled", "bulletTurboMode", "legitAutoTiming", "autoMoveDelayMs", "autoMoveJitterMs", "autoMoveTriggerRate",
            "useAverageMoveSometimes", "averageMoveFrequency", "protectCriticalMoves", "autoClickMethod",
            "premoveEnabled", "premoveRiskLevel", "premoveOpeningMode", "showPremoveArrows"
          ],
          (res) => {
            if (!isContextValid() || !res) return;
            if (res.workMode) workMode = res.workMode;
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
            if (typeof res.useStockfishWasm === "boolean") useStockfishWasm = res.useStockfishWasm;
            if (typeof res.trapRadarEnabled === "boolean") trapRadarEnabled = res.trapRadarEnabled;
            if (typeof res.audioRadarEnabled === "boolean") audioRadarEnabled = res.audioRadarEnabled;
            if (typeof res.heatmapAlwaysOn === "boolean") heatmapAlwaysOn = res.heatmapAlwaysOn;

            if (res.uiTheme) uiTheme = res.uiTheme;
            if (res.arrowStyle) arrowStyle = res.arrowStyle;
            if (res.arrowScale) arrowScale = Number(res.arrowScale);
            if (res.arrowOpacity) arrowOpacity = Number(res.arrowOpacity);
            if (typeof res.enable3DPiecesShadow === "boolean") enable3DPiecesShadow = res.enable3DPiecesShadow;
            if (typeof res.phonkEditEnabled === "boolean") phonkEditEnabled = res.phonkEditEnabled;
            if (res.mateStyle) mateStyle = res.mateStyle;
            if (typeof res.roflMode === "boolean") roflMode = res.roflMode;
            if (typeof res.safeAntiBanGuard === "boolean") safeAntiBanGuard = res.safeAntiBanGuard;
            if (typeof res.welcomeBannerHidden === "boolean") welcomeBannerHidden = res.welcomeBannerHidden;

            if (typeof res.autoMoveEnabled === "boolean") autoMoveEnabled = res.autoMoveEnabled;
            if (typeof res.bulletTurboMode === "boolean") bulletTurboMode = res.bulletTurboMode;
            if (typeof res.legitAutoTiming === "boolean") legitAutoTiming = res.legitAutoTiming;
            if (res.autoMoveDelayMs !== undefined) autoMoveDelayMs = Number(res.autoMoveDelayMs);
            if (res.autoMoveJitterMs !== undefined) autoMoveJitterMs = Number(res.autoMoveJitterMs);
            if (res.autoMoveTriggerRate !== undefined) autoMoveTriggerRate = Number(res.autoMoveTriggerRate);
            if (typeof res.useAverageMoveSometimes === "boolean") useAverageMoveSometimes = res.useAverageMoveSometimes;
            if (res.averageMoveFrequency !== undefined) averageMoveFrequency = Number(res.averageMoveFrequency);
            if (typeof res.protectCriticalMoves === "boolean") protectCriticalMoves = res.protectCriticalMoves;
            if (res.autoClickMethod) autoClickMethod = res.autoClickMethod;

            if (typeof res.premoveEnabled === "boolean") premoveEnabled = res.premoveEnabled;
            if (res.premoveRiskLevel !== undefined) premoveRiskLevel = Number(res.premoveRiskLevel);
            if (res.premoveOpeningMode !== undefined) premoveOpeningMode = res.premoveOpeningMode;
            if (typeof res.showPremoveArrows === "boolean") showPremoveArrows = res.showPremoveArrows;

            if (useStockfishWasm) {
              StockfishWasmEngine.initWorker();
            }

            ensurePanel();
            applySafeBoardDepth();
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

  function buildOpeningOptionsHTML() {
    let html = `
      <option value="auto">🤖 Авто-распознавание (Надежная теория 2000+ ELO)</option>
      <option value="off">⛔ Без книжных премувов (только тактика/форсаж)</option>
    `;
    if (window.ChessOpenings && Array.isArray(window.ChessOpenings.database)) {
      window.ChessOpenings.database.forEach((op, idx) => {
        html += `<option value="db_${idx}">${op.name}</option>`;
      });
    }
    return html;
  }

  function updateLiveTelemetryUI() {
    const card = $("cc-live-telemetry-card");
    if (!card) return;
    card.style.display = liveTelemetryEnabled ? "flex" : "none";
    if (!liveTelemetryEnabled) return;

    const mySecs = getMyRemainingSeconds();
    const enSecs = getEnemyRemainingSeconds();
    const diffSecs = (mySecs < 900 && enSecs < 900) ? Math.round(mySecs - enSecs) : 0;
    const diffStr = diffSecs > 0 ? `+${diffSecs}с` : `${diffSecs}с`;

    const boxClocks = $("cc-tele-box-clocks");
    if (boxClocks) {
      boxClocks.style.display = teleShowClocks ? "block" : "none";
      const valEl = $("cc-tele-clocks-val");
      if (valEl) {
        valEl.innerHTML = `<span style="color:#00f5d4;">${formatClockMMSS(mySecs)}</span> vs <span style="color:#ff4d94;">${formatClockMMSS(enSecs)}</span> <small style="color:#ffbe0b;">(${diffStr})</small>`;
      }
    }

    const boxEngine = $("cc-tele-box-engine");
    if (boxEngine) {
      boxEngine.style.display = teleShowEngine ? "block" : "none";
      const valEl = $("cc-tele-engine-val");
      if (valEl) {
        const wasmBadge = useStockfishWasm ? "SF WASM" : "JS CORE";
        valEl.textContent = `${wasmBadge} • ${lastTelemetryData.serverSource || "OK"}`;
      }
    }

    const boxWdl = $("cc-tele-box-wdl");
    if (boxWdl) {
      boxWdl.style.display = teleShowWdl ? "block" : "none";
      const w = lastTelemetryData.myWin ?? 50;
      const d = lastTelemetryData.draw ?? 30;
      const l = lastTelemetryData.enemyWin ?? 20;
      const valEl = $("cc-tele-wdl-val");
      if (valEl) {
        valEl.innerHTML = `<span style="color:#00f5d4;">Поб: ${w}%</span> • <span style="color:#cbd5e1;">Нич: ${d}%</span> • <span style="color:#ff4d94;">Пор: ${l}%</span>`;
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
        valEl.textContent = lastTelemetryData.nearestThreatText || "Угроз не обнаружено";
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

    const allThemes = [
      "theme-minimal", "theme-cyberpunk", "theme-aurora", "theme-hologram",
      "theme-crimson", "theme-gold", "theme-matrix", "theme-titanium", "theme-obsidian"
    ];
    allThemes.forEach((cls) => panel.classList.remove(cls));
    panel.classList.add(`theme-${uiTheme}`);

    const welcomeCard = $("cc-welcome-card");
    if (welcomeCard) {
      welcomeCard.style.display = welcomeBannerHidden ? "none" : "block";
      const greetEl = $("cc-welcome-greeting");
      if (greetEl) greetEl.textContent = getDynamicGreetingText();
      const modeChip = $("cc-welcome-chip-mode");
      if (modeChip) {
        const modeMap = { hvh: "⚡ Режим: HvH (Резня)", legit: "🛡 Режим: Legit (Беспалевный)", all: "◈ Режим: Все функции" };
        modeChip.textContent = modeMap[workMode] || modeMap.all;
      }
      const cpuChip = $("cc-welcome-chip-cpu");
      if (cpuChip) {
        const lightCpu = !showAverageMove && !showWorstMove;
        cpuChip.textContent = lightCpu ? "🚀 CPU: Турбо (1-я линия)" : "🧠 CPU: Мульти-анализ";
      }
      const wasmChip = $("cc-welcome-chip-wasm");
      if (wasmChip) {
        wasmChip.textContent = useStockfishWasm ? "⚡ SF WASM + Syzygy: ВКЛ" : "⚙ Локальный JS + Syzygy";
      }
    }

    if ($("cc-elo-slider")) $("cc-elo-slider").value = currentElo;
    if ($("cc-elo-val")) $("cc-elo-val").textContent = `${currentElo} ELO`;
    if ($("cc-elo-badge")) $("cc-elo-badge").textContent = `${currentElo} ELO`;

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
      $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД • ${styleLabel}${badgesHtml}`;
    }
    if ($("cc-active-style-stat")) {
      $("cc-active-style-stat").textContent = styleLabel.replace(/^[^\s]+\s/, "");
    }

    if ($("cc-avg-card")) {
      $("cc-avg-card").style.display = (showAverageMove && workMode !== "hvh") ? "block" : "none";
    }
    if ($("cc-worst-card")) {
      $("cc-worst-card").style.display = (showWorstMove && workMode === "all") ? "block" : "none";
    }
    if ($("cc-show-avg-chk")) $("cc-show-avg-chk").checked = showAverageMove;
    if ($("cc-show-worst-chk")) $("cc-show-worst-chk").checked = showWorstMove;

    if ($("cc-sf-wasm-chk")) $("cc-sf-wasm-chk").checked = useStockfishWasm;
    if ($("cc-trap-radar-chk")) $("cc-trap-radar-chk").checked = trapRadarEnabled;
    if ($("cc-audio-radar-chk")) $("cc-audio-radar-chk").checked = audioRadarEnabled;
    if ($("cc-heatmap-always-chk")) $("cc-heatmap-always-chk").checked = heatmapAlwaysOn;

    if ($("cc-live-telemetry-chk")) $("cc-live-telemetry-chk").checked = liveTelemetryEnabled;
    if ($("cc-tele-clocks-chk")) $("cc-tele-clocks-chk").checked = teleShowClocks;
    if ($("cc-tele-engine-chk")) $("cc-tele-engine-chk").checked = teleShowEngine;
    if ($("cc-tele-wdl-chk")) $("cc-tele-wdl-chk").checked = teleShowWdl;
    if ($("cc-tele-threats-chk")) $("cc-tele-threats-chk").checked = teleShowThreats;
    updateLiveTelemetryUI();

    if ($("cc-color-pill")) {
      const labels = { auto: "◈ АВТО", w: "⚪ БЕЛЫЕ", b: "⚫ ЧЕРНЫЕ" };
      $("cc-color-pill").textContent = labels[forcedMyColor] || "◈ АВТО";
    }

    const autoText = autoMoveEnabled
      ? (bulletTurboMode ? "🔥 РЕЗНЯ 1+0: ВКЛ" : (workMode === "legit" ? "🛡 LEGIT АВТО: ВКЛ" : "🤖 АВТОХОД: ВКЛ"))
      : "🤖 АВТОХОД: ВЫКЛ";
    if ($("cc-toggle-auto")) {
      $("cc-toggle-auto").textContent = autoText;
      $("cc-toggle-auto").style.borderColor = autoMoveEnabled ? "var(--cc-accent)" : "rgba(255,255,255,0.14)";
      $("cc-toggle-auto").style.color = autoMoveEnabled ? "var(--cc-accent)" : "#e2e8f0";
    }
    if ($("cc-auto-master-chk")) $("cc-auto-master-chk").checked = autoMoveEnabled;
    if ($("cc-bullet-turbo-chk")) $("cc-bullet-turbo-chk").checked = bulletTurboMode;
    if ($("cc-legit-timing-chk")) $("cc-legit-timing-chk").checked = legitAutoTiming;
    if ($("cc-auto-delay-slider")) $("cc-auto-delay-slider").value = autoMoveDelayMs;
    if ($("cc-auto-delay-val")) $("cc-auto-delay-val").textContent = `${(autoMoveDelayMs / 1000).toFixed(2)} сек`;
    if ($("cc-auto-jitter-slider")) $("cc-auto-jitter-slider").value = autoMoveJitterMs;
    if ($("cc-auto-jitter-val")) $("cc-auto-jitter-val").textContent = `±${(autoMoveJitterMs / 1000).toFixed(2)} сек`;
    if ($("cc-auto-rate-slider")) $("cc-auto-rate-slider").value = autoMoveTriggerRate;
    if ($("cc-auto-rate-val")) $("cc-auto-rate-val").textContent = `${autoMoveTriggerRate}% ходов`;

    if ($("cc-premove-chk")) $("cc-premove-chk").checked = premoveEnabled;
    if ($("cc-premove-risk-slider")) $("cc-premove-risk-slider").value = premoveRiskLevel;
    if ($("cc-premove-risk-val")) {
      $("cc-premove-risk-val").textContent = PREMOVE_RISK_LABELS[premoveRiskLevel] || PREMOVE_RISK_LABELS[3];
    }
    setSelectSafe($("cc-premove-opening-select"), premoveOpeningMode, "auto");
    if ($("cc-premove-arrows-chk")) $("cc-premove-arrows-chk").checked = showPremoveArrows;

    if ($("cc-auto-avg-chk")) $("cc-auto-avg-chk").checked = useAverageMoveSometimes;
    if ($("cc-auto-avg-freq-slider")) $("cc-auto-avg-freq-slider").value = averageMoveFrequency;
    if ($("cc-auto-avg-freq-val")) $("cc-auto-avg-freq-val").textContent = `${averageMoveFrequency}%`;
    if ($("cc-auto-protect-chk")) $("cc-auto-protect-chk").checked = protectCriticalMoves;
    setSelectSafe($("cc-auto-method-select"), autoClickMethod, "hybrid");

    setSelectSafe($("cc-vis-theme"), uiTheme, "cyberpunk");
    setSelectSafe($("cc-vis-arrow-style"), arrowStyle, "curved_neon");
    setSelectSafe($("cc-vis-mate-style"), mateStyle, "phonk_skull");
    if ($("cc-vis-scale")) $("cc-vis-scale").value = arrowScale;
    if ($("cc-vis-scale-val")) $("cc-vis-scale-val").textContent = `${arrowScale.toFixed(1)}x`;
    if ($("cc-vis-opacity")) $("cc-vis-opacity").value = arrowOpacity;
    if ($("cc-vis-opacity-val")) $("cc-vis-opacity-val").textContent = `${Math.round(arrowOpacity * 100)}%`;
    if ($("cc-vis-arrows-chk")) $("cc-vis-arrows-chk").checked = showArrows;
    if ($("cc-vis-eval-chk")) $("cc-vis-eval-chk").checked = showEvalBar;
    if ($("cc-vis-shadow-chk")) $("cc-vis-shadow-chk").checked = enable3DPiecesShadow;
    if ($("cc-vis-phonk-chk")) $("cc-vis-phonk-chk").checked = phonkEditEnabled;
    if ($("cc-rage-rofl-chk")) $("cc-rage-rofl-chk").checked = roflMode;
    if ($("cc-rage-antiban-chk")) $("cc-rage-antiban-chk").checked = safeAntiBanGuard;

    if ($("cc-bg-dim-slider")) $("cc-bg-dim-slider").value = customBgDim;
    if ($("cc-bg-dim-val")) $("cc-bg-dim-val").textContent = `${Math.round(customBgDim * 100)}%`;
    if ($("cc-bg-blur-slider")) $("cc-bg-blur-slider").value = customBgBlur;
    if ($("cc-bg-blur-val")) $("cc-bg-blur-val").textContent = `${customBgBlur}px`;

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
    clearTimeout(premoveTimer);
    premoveTimer = null;
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
    committedEnemyBoardKey = "";
    lastPremoveSentBoardKey = "";
    preparedLookahead = null;
    resetTurnDecision();
    runCycle(true);
  }

  function switchTab(tabId, saveToStorage = true) {
    activeTabId = tabId;
    getShadow().querySelectorAll(".cc-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    getShadow().querySelectorAll(".cc-tab-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `cc-pane-${tabId}`);
    });
    if (saveToStorage) {
      saveSetting({ activeTabId: tabId });
    }
    if (tabId === "analyzer") {
      renderLiveEvalGraph();
    }
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
          <span>CHESSCOACH // VISION v15</span>
          <span class="cc-badge" id="cc-elo-badge">${currentElo} ELO</span>
          <span class="cc-deep-status" id="cc-deep-status">⚡ ДОРАСЧЕТ...</span>
        </div>
        <div class="cc-header-controls">
          <button class="cc-pill-btn" id="cc-color-pill" title="Быстрое переключение вашего цвета">◈ АВТО</button>
          <button class="cc-pill-btn" id="cc-toggle-btn" title="Свернуть/Развернуть (или клавиша INSERT)">—</button>
        </div>
      </div>

      <!-- ТРОЙНОЙ ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ: HvH — ВСЕ — LEGIT -->
      <div id="cc-mode-switcher-bar">
        <button class="cc-mode-btn" data-mode="hvh" title="Профиль HvH: 3000 ELO, Стокфиш + Syzygy, Резня 1+0, отключены средний/худший ходы">
          ⚡ HvH (РЕЗНЯ)
        </button>
        <button class="cc-mode-btn active" data-mode="all" title="Показывать абсолютно все настройки и вкладки">
          ◈ ВСЕ ФУНКЦИИ
        </button>
        <button class="cc-mode-btn" data-mode="legit" title="Профиль Legit: 3000 ELO, стиль Таль, без Резни, умный живой джиттер под время часов">
          🛡 LEGIT (СТЕЛС)
        </button>
      </div>

      <div id="chesscoach-workspace">
        <div class="cc-sidebar">
          <div class="cc-nav-list">
            <button class="cc-tab-btn active" data-tab="analyzer">
              <span class="cc-tab-icon">◈</span> АНАЛИЗ
            </button>
            <button class="cc-tab-btn" data-tab="automove">
              <span class="cc-tab-icon">🤖</span> АВТОХОД v2
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
            <div class="cc-mini-stat" style="opacity:0.75;">
              <span>КАРТА ДОСКИ</span>
              <strong style="color:#c77dff;">[ALT]</strong>
            </div>
            <div class="cc-mini-stat" style="opacity:0.65;">
              <span>СКРЫТЬ HUD</span>
              <span>[INS]</span>
            </div>
          </div>
        </div>

        <div class="cc-main-view">
          <div class="cc-tab-pane active" id="cc-pane-analyzer">
            <div id="cc-welcome-card">
              <div class="cc-welcome-top">
                <div class="cc-welcome-greeting" id="cc-welcome-greeting">⚡ Привет, Гроссмейстер! Тактический радар заряжен</div>
                <button class="cc-welcome-close" id="cc-welcome-close-btn" title="Скрыть приветствие">✕</button>
              </div>
              <div class="cc-welcome-sub">
                Переключай <strong>HvH / Все / Legit</strong> сверху. Позиция меню и скрытие сохраняются автоматически!
              </div>
              <div class="cc-welcome-chips">
                <span class="cc-welcome-chip" id="cc-welcome-chip-mode">◈ Режим: Все функции</span>
                <span class="cc-welcome-chip" id="cc-welcome-chip-cpu">🧠 CPU: Мульти-анализ</span>
                <span class="cc-welcome-chip" id="cc-welcome-chip-wasm">⚡ SF WASM + Syzygy: ВКЛ</span>
              </div>
            </div>

            <!-- ЖИВОЕ ПОЛОЖЕНИЕ ПАРТИИ 24/7 (РАБОТАЕТ ДАЖЕ В ХОД СОПЕРНИКА) -->
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
                  <div class="cc-tele-box-title">🛰️ ДВИЖОК / СЕРВЕР</div>
                  <div class="cc-tele-box-val" id="cc-tele-engine-val" style="color:#c77dff;">SF WASM • ГОТОВ</div>
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

            <div id="cc-peer-detector-banner" style="display:none; background:linear-gradient(135deg, rgba(0,245,212,0.20), rgba(199,125,255,0.24)); border:1.5px solid #00f5d4; border-radius:12px; padding:8px 12px; color:#fff; box-shadow:0 0 20px rgba(0,245,212,0.28);">
              <div id="cc-peer-detector-title" style="font-size:11px; font-weight:900; color:#00f5d4; display:flex; justify-content:space-between; align-items:center;">
                <span>👁️ РАДАР СВОИХ: ОБНАРУЖЕН CHESSCOACH!</span>
                <span style="background:rgba(0,0,0,0.45); padding:1px 6px; border-radius:4px; font-family:monospace;">⚡ HVH</span>
              </div>
              <div id="cc-peer-detector-text" style="font-size:11px; color:#f1f5f9; margin-top:2px; font-weight:600; line-height:1.35;">
                У вашего соперника установлено это же расширение!
              </div>
            </div>

            <div id="cc-enemy-turn-standby">
              <div class="cc-standby-icon">⏳</div>
              <div class="cc-standby-title" id="cc-standby-title">Ход соперника...</div>
              <div class="cc-standby-sub" id="cc-standby-sub">
                Старые метки очищены. Живая телеметрия выше продолжает следить за часами и угрозами!
              </div>
            </div>

            <div id="cc-my-turn-active" style="display:flex; flex-direction:column; gap:7px; flex:1;">
              <div id="cc-mate-banner">
                <div class="cc-mate-title">
                  <span id="cc-mate-banner-title">👑💀 АХАХАХ! МАТ НА ДОСКЕ!</span>
                  <span style="font-size:16px;">😱😂</span>
                </div>
                <div class="cc-mate-sub" id="cc-mate-banner-text">
                  Соперник зевнул прямое фаталити! Жми «Сделать ход» и отправляй его в лобби!
                </div>
              </div>

              <div class="cc-glass-card" id="cc-opening-card" style="border-left: 3.5px solid var(--cc-accent);">
                <div class="cc-section-title">
                  <span id="cc-opening-name">◈ ГОТОВ К ПАРТИИ</span>
                  <span id="cc-turn-indicator" style="color:#94a3b8;">ОЖИДАНИЕ</span>
                </div>
                <div id="cc-opening-plan" style="font-size:11px; color:#cbd5e1; line-height:1.36;">
                  Сделайте ход на доске Lichess для мгновенного расчета.
                </div>
              </div>

              <div id="cc-eval-graph-card">
                <div class="cc-graph-header">
                  <span>📈 ЖИВОЙ ГРАФИК ПЕРЕВЕСА</span>
                  <span id="cc-eval-graph-label" style="color:var(--cc-accent); font-family:monospace;">0.00</span>
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
                  <span style="color:#00f5d4" id="cc-best-title">✦ ЛУЧШИЙ ХОД</span>
                  <span class="cc-eval" id="cc-best-eval">--</span>
                </div>
                <div id="cc-best-desc">Анализ позиции...</div>
                <div id="cc-best-pv" style="margin-top:3px; font-size:10px; color:var(--cc-accent); font-family:monospace; opacity:0.92;"></div>
              </div>

              <div class="cc-move-card cc-hide-in-hvh" id="cc-avg-card" style="border-left-color:#ffbe0b;">
                <div class="cc-move-header">
                  <span style="color:#ffbe0b">❖ СРЕДНИЙ ХОД (2-Я ЛИНИЯ)</span>
                  <span class="cc-eval" id="cc-avg-eval">--</span>
                </div>
                <div id="cc-avg-desc">Анализ альтернативы...</div>
              </div>

              <div class="cc-move-card cc-hide-in-hvh cc-hide-in-legit" id="cc-worst-card" style="border-left-color:#ff2a85;">
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

          <div class="cc-tab-pane" id="cc-pane-automove">
            <div class="cc-auto-status-box">
              <span>Статус Автохода v2:</span>
              <strong id="cc-auto-live-status" style="color:#00f5d4;">Готов к работе</strong>
            </div>

            <div class="cc-glass-card cc-hide-in-legit" style="border-left: 3.5px solid #ff2a85; background: linear-gradient(135deg, rgba(255,42,133,0.14), rgba(199,125,255,0.10));">
              <div class="cc-Switch-row" style="padding:0; border:none;">
                <div>
                  <span style="font-weight:900; color:#ff4d94; font-size:11.5px;">🔥 РЕЖИМ РЕЗНИ 1+0 (BULLET TURBO)</span>
                  <div style="font-size:10px; color:#cbd5e1; margin-top:2px;">
                    Мгновенные ходы за 35 мс + умные SEE-премувы без патов и подстав
                  </div>
                </div>
                <input type="checkbox" id="cc-bullet-turbo-chk">
              </div>
            </div>

            <div class="cc-glass-card cc-hide-in-hvh" style="border-left: 3.5px solid #38b000; background: linear-gradient(135deg, rgba(56,176,0,0.14), rgba(0,245,212,0.08));">
              <div class="cc-Switch-row" style="padding:0; border:none;">
                <div>
                  <span style="font-weight:900; color:#70e000; font-size:11.5px;">🛡 АДАПТИВНЫЙ LEGIT-ТАЙМИНГ (АВТО-ДЖИТТЕР ПО ЧАСАМ)</span>
                  <div style="font-size:10px; color:#cbd5e1; margin-top:2px;">
                    Сам считывает контроль времени (10+0 / 3+0 / 1+0) и плавно меняет задержку хода с живым разбросом, исключая палевные минимальные тайминги
                  </div>
                </div>
                <input type="checkbox" id="cc-legit-timing-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card cc-hide-in-legit" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>⚡ УМНЫЕ ПРЕМУВЫ НА ДОСКЕ (SEE PREMOVE v2)</span>
                <span id="cc-premove-book-status" style="font-size:10px; color:#00f5d4;">📖 ТЕОРИЯ АКТИВНА</span>
              </div>

              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🔮 Выставлять премувы на доске Lichess</span>
                <input type="checkbox" id="cc-premove-chk">
              </div>

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Сила и частота премувов:</span>
                <strong id="cc-premove-risk-val" style="color:#c77dff; font-size:10.5px;">🎯 Ур. 3: Умный Блиц</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-premove-risk-slider" min="1" max="4" step="1" value="3" style="accent-color:#c77dff;">

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Дебютная линия премувов:</span>
              </div>
              <select class="cc-select" id="cc-premove-opening-select">
                ${buildOpeningOptionsHTML()}
              </select>

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Показывать прогноз премува в ход врага</span>
                <input type="checkbox" id="cc-premove-arrows-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🤖 Включить автоматический ход</span>
                <input type="checkbox" id="cc-auto-master-chk">
              </div>

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Базовая скорость / задержка хода:</span>
                <strong id="cc-auto-delay-val" style="color:var(--cc-accent);">0.18 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-delay-slider" min="20" max="2500" step="20" value="180">

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Случайный разброс времени (Humanizer):</span>
                <strong id="cc-auto-jitter-val" style="color:var(--cc-accent);">±0.06 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-jitter-slider" min="0" max="1000" step="20" value="60">

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Частота срабатывания автохода:</span>
                <strong id="cc-auto-rate-val" style="color:var(--cc-accent);">100% ходов</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-rate-slider" min="10" max="100" step="10" value="100">
            </div>

            <div class="cc-glass-card cc-hide-in-hvh" style="border-left: 3.5px solid #ffbe0b;">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>Иногда делать Средний ход (2-я линия)</span>
                <input type="checkbox" id="cc-auto-avg-chk">
              </div>

              <div class="cc-control-row" style="margin-top:5px;">
                <span>Шанс Среднего хода:</span>
                <strong id="cc-auto-avg-freq-val" style="color:#ffbe0b;">20%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-avg-freq-slider" min="0" max="100" step="5" value="20" style="accent-color:#ffbe0b;">

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Страховка: только Лучший ход при Мате в 1 и угрозах</span>
                <input type="checkbox" id="cc-auto-protect-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:5px; margin-bottom:0;">
                <span>Канал отправки:</span>
                <select class="cc-select" id="cc-auto-method-select" style="width:210px;">
                  <option value="hybrid" selected>⚡ MAIN WebSocket + 2-Клик</option>
                  <option value="twoclick">🎯 Чистый 2-Клик по доске</option>
                  <option value="drag">🖐 Перетаскивание (Drag & Drop)</option>
                </select>
              </div>
            </div>

            <div class="cc-actions-bar">
              <button class="cc-btn cc-btn-primary" id="cc-auto-test-best">⚡ Сходить Лучшим</button>
              <button class="cc-btn cc-hide-in-hvh" id="cc-auto-test-avg" style="border-color:#ffbe0b; color:#ffbe0b;">❖ Сходить Средним</button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-rage">
            <div class="cc-glass-card">
              <div class="cc-control-row">
                <span style="font-weight:800;">СИЛА ДВИЖКА (400 – 3000 ELO)</span>
                <strong id="cc-elo-val" style="color:var(--cc-accent);">${currentElo} ELO</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-elo-slider" min="400" max="3000" step="100" value="${currentElo}">
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>🧠 ГИБРИДНЫЙ STOCKFISH WASM + ТЕЛЕМЕТРИЯ 24/7</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>🧠 Фоновый WebWorker Stockfish WASM (Честные 3000+ ELO)</span>
                <input type="checkbox" id="cc-sf-wasm-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>📡 Положение партии 24/7 (Часы, WDL%, Сервер в ход врага)</span>
                <input type="checkbox" id="cc-live-telemetry-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>🪤 Радар ловушек (Подсветка ходов с шансом ошибки врага)</span>
                <input type="checkbox" id="cc-trap-radar-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>🔊 Тактический аудио-радар (Пинг зевков врага и Мата)</span>
                <input type="checkbox" id="cc-audio-radar-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card cc-hide-in-hvh" style="border-left: 3.5px solid #00f5d4;">
              <div class="cc-section-title">
                <span>🚀 РАЗГРУЗКА ДВИЖКА (ОПТИМИЗАЦИЯ CPU)</span>
              </div>
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>❖ Показывать и считать Средний ход (2-я линия)</span>
                <input type="checkbox" id="cc-show-avg-chk" checked>
              </div>
              <div class="cc-Switch-row cc-hide-in-legit">
                <span>✖ Показывать и считать Худший ход (Анти-зевок)</span>
                <input type="checkbox" id="cc-show-worst-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚡ ВЫБОР СТИЛЯ ИГРЫ (11 ЛЕГЕНД)</span></div>
              <div class="cc-style-grid">
                <button class="cc-style-btn" data-style="mogging"><span>⚡ Моггинг</span><small>ДОМИНАЦИЯ</small></button>
                <button class="cc-style-btn active" data-style="tal"><span>✦ Михаил Таль</span><small>ЖЕРТВЫ</small></button>
                <button class="cc-style-btn" data-style="alphazero"><span>🧠 AlphaZero</span><small>НЕЙРОСЕТЬ</small></button>
                <button class="cc-style-btn" data-style="morphy"><span>🎭 Пол Морфи</span><small>ГЕНИЙ ТЕМПА</small></button>
                <button class="cc-style-btn" data-style="hikaru"><span>🚀 Накамура</span><small>КОРОЛЬ ПУЛЬКИ</small></button>
                <button class="cc-style-btn" data-style="kasparov"><span>▲ Каспаров</span><small>АТАКА</small></button>
                <button class="cc-style-btn" data-style="fischer"><span>◈ Фишер</span><small>ТОЧНОСТЬ</small></button>
                <button class="cc-style-btn" data-style="carlsen"><span>❖ Карлсен</span><small>ТЕХНИКА</small></button>
                <button class="cc-style-btn" data-style="solid"><span>🛡 Карпов</span><small>ЗАЖИМ</small></button>
                <button class="cc-style-btn" data-style="botvinnik"><span>🏛 Ботвинник</span><small>ПАТРИАРХ</small></button>
                <button class="cc-style-btn" data-style="balanced" style="grid-column: span 2;">
                  <span>⚙ Stockfish 3000 Cloud + Syzygy</span><small>ЧИСТЫЙ МАКСИМУМ</small>
                </button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚙ РЕЖИМ РАБОТЫ</span></div>
              <div class="cc-control-row" style="margin-bottom:6px;">
                <span>Когда считать:</span>
                <select class="cc-select" id="cc-turn-select" style="width:200px;">
                  <option value="my" selected>Только в мой ход (+ Премув)</option>
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

          <div class="cc-tab-pane" id="cc-pane-visuals">
            <!-- КАСТОМНЫЙ ФОН МЕНЮ ИЗ ПРОВОДНИКА -->
            <div class="cc-glass-card" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>🖼️ СВОЕ ФОТО НА ФОН МЕНЮ (ВЫБОР ИЗ ПРОВОДНИКА)</span>
              </div>
              <div style="font-size:10.5px; color:#cbd5e1; margin-bottom:7px; line-height:1.35;">
                Выберите любое фото с компьютера — расширение само сожмет его под размер окна (900×800) и сохранит в память:
              </div>
              <div class="cc-actions-bar" style="margin-bottom:7px;">
                <button class="cc-btn cc-btn-primary" id="cc-upload-bg-btn">📂 ВЫБРАТЬ ФОТО...</button>
                <button class="cc-btn cc-btn-danger" id="cc-clear-bg-btn">🗑 СБРОСИТЬ ФОН</button>
              </div>
              <input type="file" id="cc-bg-file-input" accept="image/*" style="display:none;" />
              <div class="cc-control-row">
                <span>Затемнение фото (читаемость текста):</span>
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
              <div class="cc-section-title"><span>✦ ТЕМА МЕНЮ (9 СТИЛЕЙ VISION GLASS)</span></div>
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
              </select>
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid var(--cc-accent);">
              <div class="cc-section-title"><span>◈ ТИП УКАЗАТЕЛЯ ХОДА (16 ВАРИАЦИЙ: КВАДРАТЫ И СТРЕЛКИ)</span></div>
              <select class="cc-select" id="cc-vis-arrow-style" style="margin-bottom:7px;">
                <optgroup label="🔲 БЕЗ СТРЕЛОК (ВЫДЕЛЕНИЕ КВАДРАТИКОВ ХОДА)">
                  <option value="sq_cyber_frame">🔲 Неоновые рамки клеток (ОТКУДА ➔ КУДА)</option>
                  <option value="sq_Step_badges">🎯 Тактические метки [1: СТАРТ] ➔ [2: ЦЕЛЬ]</option>
                  <option value="sq_hologram_tiles">💠 Голографическая заливка квадратов + Прицел</option>
                  <option value="sq_minimal_dots">⚫ Стелс-точки Lichess Pro (Без стрелок)</option>
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
                <span>🔥 Эдит Бриллиантовому Ходу (15 сек Phonk + Mogging)</span>
                <input type="checkbox" id="cc-vis-phonk-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Показывать подсказки на доске</span>
                <input type="checkbox" id="cc-vis-arrows-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Боковая шкала оценки (Eval Bar)</span>
                <input type="checkbox" id="cc-vis-eval-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Объемные 3D-тени под фигурами и доской</span>
                <input type="checkbox" id="cc-vis-shadow-chk" checked>
              </div>
              <button class="cc-btn cc-btn-primary" id="cc-test-phonk-btn" style="width:100%; margin-top:6px;">
                🔥 ТЕСТ ФОНК-ЭДИТА (15 СЕК)
              </button>
            </div>
          </div>

          <div class="cc-tab-pane" id="cc-pane-misc">
            <div class="cc-glass-card">
              <div class="cc-section-title"><span>❖ РУЧНОЕ ОБУЧЕНИЕ БОТА</span></div>
              <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px; line-height:1.38;">
                Закрепите лучший ход как любимый шаблон или забаньте его, чтобы движок сразу нашел другой вариант:
              </div>
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
    });
    window.addEventListener("mouseup", () => {
      if (dragging) {
        dragging = false;
        saveSetting({ panelLeft, panelTop });
      }
    });

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
    });

    window.addEventListener("keyup", (e) => {
      if (e.key === "Alt" && isAltPressed) {
        isAltPressed = false;
        const st = captureBoardState(true);
        if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      }
    });

    window.addEventListener("blur", () => {
      if (isAltPressed) {
        isAltPressed = false;
        const st = captureBoardState(true);
        if (st && !st.animating) renderArrowsOverlay(st, cachedMoves);
      }
    });

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
      updateUIValues();
      forceRecalculate();
    });

    const toggleAutoMoveMaster = (newState) => {
      autoMoveEnabled = newState;
      if (!newState) {
        bulletTurboMode = false;
      }
      saveSetting({ autoMoveEnabled, bulletTurboMode });
      updateUIValues();
      resetTurnDecision();
      if (autoMoveEnabled) {
        setAutoStatusText("Автоход v2 включен — анализ позиции...", "#00f5d4");
        forceRecalculate();
      } else {
        setAutoStatusText("Автоход выключен", "#94a3b8");
      }
    };

    $("cc-toggle-auto").addEventListener("click", () => toggleAutoMoveMaster(!autoMoveEnabled));
    $("cc-auto-master-chk").addEventListener("change", (e) => toggleAutoMoveMaster(e.target.checked));

    $("cc-bullet-turbo-chk").addEventListener("change", (e) => {
      bulletTurboMode = e.target.checked;
      if (bulletTurboMode) {
        autoMoveEnabled = true;
        premoveEnabled = true;
        showPremoveArrows = true;
        premoveRiskLevel = 3;
        autoMoveDelayMs = 45;
        autoMoveJitterMs = 15;
        saveSetting({
          bulletTurboMode: true,
          autoMoveEnabled: true,
          premoveEnabled: true,
          showPremoveArrows: true,
          premoveRiskLevel: 3,
          autoMoveDelayMs: 45,
          autoMoveJitterMs: 15
        });
        setAutoStatusText("🔥 РЕЖИМ РЕЗНИ 1+0 АКТИВИРОВАН", "#ff4d94");
      } else {
        premoveEnabled = false;
        showPremoveArrows = false;
        premoveRiskLevel = 3;
        autoMoveDelayMs = 180;
        autoMoveJitterMs = 60;
        preparedLookahead = null;
        saveSetting({
          bulletTurboMode: false,
          premoveEnabled: false,
          showPremoveArrows: false,
          premoveRiskLevel: 3,
          autoMoveDelayMs: 180,
          autoMoveJitterMs: 60
        });
        setAutoStatusText("Режим Резни 1+0 выключен — стандартный режим", "#00f5d4");
      }
      applySafeBoardDepth();
      updateUIValues();
      forceRecalculate();
    });

    $("cc-legit-timing-chk").addEventListener("change", (e) => {
      legitAutoTiming = e.target.checked;
      saveSetting({ legitAutoTiming });
      updateUIValues();
    });

    $("cc-premove-chk").addEventListener("change", (e) => {
      premoveEnabled = e.target.checked;
      if (premoveEnabled) {
        showPremoveArrows = true;
      } else {
        preparedLookahead = null;
      }
      saveSetting({ premoveEnabled, showPremoveArrows });
      updateUIValues();
      forceRecalculate();
    });

    $("cc-premove-risk-slider").addEventListener("input", (e) => {
      premoveRiskLevel = Number(e.target.value);
      updateUIValues();
      saveSetting({ premoveRiskLevel });
      forceRecalculate();
    });

    $("cc-premove-opening-select").addEventListener("change", (e) => {
      premoveOpeningMode = e.target.value;
      openingBookDeviated = false;
      saveSetting({ premoveOpeningMode });
      updateUIValues();
      forceRecalculate();
    });

    $("cc-premove-arrows-chk").addEventListener("change", (e) => {
      showPremoveArrows = e.target.checked;
      saveSetting({ showPremoveArrows });
      forceRecalculate();
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
      saveSetting({ useStockfishWasm });
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
      if (state && !state.animating && cachedMoves.best) {
        setAutoStatusText(`Выполняем ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true, false);
      }
    });

    $("cc-auto-test-best").addEventListener("click", () => {
      const state = captureBoardState(true);
      if (state && !state.animating && cachedMoves.best) {
        setAutoStatusText(`Лучший ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true, false);
      }
    });

    $("cc-auto-test-avg").addEventListener("click", () => {
      const state = captureBoardState(true);
      const move = cachedMoves.average || cachedMoves.best;
      if (state && !state.animating && move) {
        setAutoStatusText(`Средний ход: ${move.from}→${move.to}`, "#ffbe0b");
        executeMoveOnBoard(move, state, true, false);
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
      if (st && !st.animating) renderEvalBar(st, cachedMoves.best?.whitePerspectiveEval || 0);
    });

    $("cc-vis-shadow-chk").addEventListener("change", (e) => {
      enable3DPiecesShadow = e.target.checked;
      applySafeBoardDepth();
      saveSetting({ enable3DPiecesShadow });
    });

    $("cc-train-good").addEventListener("click", () => {
      if (!cachedMoves.best || !cachedMoves.boardKey) return;
      safeSendMessage(
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
      safeSendMessage(
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
      safeSendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
        const blob = new Blob([JSON.stringify(res?.experienceDB || {}, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chesscoach-rework-db-${Date.now()}.json`;
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
              $("cc-memory-stat").textContent = `${res.positionsCount} ПОЗ.`;
              $("cc-misc-db-summary").textContent = `Выучено позиций в памяти: ${res.positionsCount}`;
            }
          });
        } catch (err) {}
      };
      reader.readAsText(file);
    });

    $("cc-clear-db").addEventListener("click", () => {
      safeSendMessage({ type: "CLEAR_MEMORY" }, () => {
        $("cc-memory-stat").textContent = "0 ПОЗ.";
        $("cc-misc-db-summary").textContent = "Выучено позиций в памяти: 0";
      });
    });
  }

  function isRatedGameAgainstHuman() {
    const metaText = (document.querySelector(".game__meta")?.innerText || "");
    const isRated = metaText.includes("Rated") || metaText.includes("Рейтинговая");
    const isBot = metaText.includes("Stockfish") || metaText.includes("BOT") || metaText.includes("АИ");
    return isRated && !isBot;
  }

  function parseLichessClockElement(selector) {
    const clockEl = document.querySelector(selector);
    if (!clockEl) return 999;
    const raw = (clockEl.innerText || clockEl.textContent || "").trim().replace(/\s+/g, "");
    const parts = raw.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return 999;
  }

  function getMyRemainingSeconds() {
    return parseLichessClockElement(".rclock-bottom .time");
  }

  function getEnemyRemainingSeconds() {
    return parseLichessClockElement(".rclock-top .time");
  }
  function formatClockMMSS(sec) {
    if (sec === undefined || sec === null || sec >= 900) return "--:--";
    const s = Math.max(0, sec);
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
      if ($("cc-time-sniper-badge")) $("cc-time-sniper-badge").textContent = "⏱️ СНАЙПЕРСКИЙ ТАЙМ-КОНТРОЛЬ";
      if ($("cc-time-sniper-text")) {
        $("cc-time-sniper-text").textContent =
          enemySecs < 20
            ? "У соперника мало времени — готовьте острые тактические тычки!"
            : "Часы под контролем. При цейтноте врага (< 10с) включится режим сруба флага.";
      }
    } else {
      banner.style.display = "none";
    }
  }

  function recordEvalPoint(boardKey, whiteEvalPawns, dropPawns = 0) {
    if (!boardKey || boardKey === lastRecordedGraphBoardKey) return;
    lastRecordedGraphBoardKey = boardKey;

    const numEval = Math.max(-10, Math.min(10, parseFloat(whiteEvalPawns) || 0));
    const numDrop = parseFloat(dropPawns) || 0;

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

    if (evalGraphHistory.length === 0) return;

    const lastPt = evalGraphHistory[evalGraphHistory.length - 1];
    const lbl = $("cc-eval-graph-label");
    if (lbl && lastPt) {
      const sign = lastPt.evalVal > 0 ? "+" : "";
      lbl.textContent = `${sign}${lastPt.evalVal.toFixed(2)}`;
      lbl.style.color = lastPt.evalVal >= 0 ? "#00f5d4" : "#ff4d94";
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

  function isDubiousGambitOpening(op) {
    if (!op) return false;
    if (op.dubious) return true;
    const riskyIds = ["alien", "halloween", "scandi_icbm", "stafford", "traxler", "englund", "blackburne", "nakhmanson", "cochrane"];
    if (op.id && riskyIds.includes(op.id)) return true;
    const nameStr = String(op.name || "");
    return DUBIOUS_GAMBIT_KEYWORDS.some((kw) => nameStr.includes(kw));
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

  function isDestinationBlockedByOwnPiece(grid, myColor, sq) {
    if (!grid || !sq || sq.length < 2) return false;
    const c = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const p = grid[r][c];
    if (!p) return false;
    return myColor === "w" ? p === p.toUpperCase() : p === p.toLowerCase();
  }

  function getOpeningBookPremovePlan(state) {
    const badgeEl = $("cc-premove-book-status");
    if (premoveOpeningMode === "off" || !window.ChessOpenings || !Array.isArray(window.ChessOpenings.database)) {
      if (badgeEl) {
        badgeEl.textContent = "⛔ КНИГА ВЫКЛ";
        badgeEl.style.color = "#94a3b8";
      }
      return null;
    }

    if (openingBookDeviated) {
      if (badgeEl) {
        badgeEl.textContent = "⚠️ ВНЕ КНИГИ (SEE ТАКТИКА)";
        badgeEl.style.color = "#ffbe0b";
      }
      return null;
    }

    const plyCount = uciHistoryList.length;
    const historyStr = uciHistoryList.join(" ");

    let candidateOpenings = [];
    if (premoveOpeningMode.startsWith("db_")) {
      const idx = parseInt(premoveOpeningMode.replace("db_", ""), 10);
      if (window.ChessOpenings.database[idx]) {
        candidateOpenings = [window.ChessOpenings.database[idx]];
      }
    } else {
      candidateOpenings = window.ChessOpenings.database.filter((op) => !isDubiousGambitOpening(op));
    }

    for (const op of candidateOpenings) {
      const opMoves = op.moves.trim().split(/\s+/);
      if (plyCount + 2 > opMoves.length) continue;

      const prefixStr = opMoves.slice(0, plyCount).join(" ");
      if (plyCount === 0 || prefixStr === historyStr) {
        const replyUci = opMoves[plyCount + 1];
        const replyFrom = replyUci.slice(0, 2);
        const replyTo = replyUci.slice(2, 4);
        if (
          state &&
          state.grid &&
          (!hasMyPieceOnSquare(state.grid, state.myColor, replyFrom) ||
            isDestinationBlockedByOwnPiece(state.grid, state.myColor, replyTo))
        ) {
          continue;
        }
        if (badgeEl) {
          badgeEl.textContent = `📖 ПО КНИГЕ: ${op.name.slice(0, 18)}`;
          badgeEl.style.color = "#00f5d4";
        }
        return {
          bookOpeningName: op.name,
          bookEnemyUci: opMoves[plyCount],
          bookMyReplyUci: replyUci
        };
      }
    }

    if (plyCount > 0) {
      openingBookDeviated = true;
      if (badgeEl) {
        badgeEl.textContent = "⚠️ ВНЕ КНИГИ (SEE ТАКТИКА)";
        badgeEl.style.color = "#ffbe0b";
      }
    }
    return null;
  }

  function computeLocalInstantPremovePlan(state) {
    if (!state || !state.grid) return null;

    const bookPlan = getOpeningBookPremovePlan(state);
    if (bookPlan && bookPlan.bookEnemyUci && bookPlan.bookMyReplyUci) {
      const bFrom = bookPlan.bookMyReplyUci.slice(0, 2);
      const bTo = bookPlan.bookMyReplyUci.slice(2, 4);
      const eFrom = bookPlan.bookEnemyUci.slice(0, 2);
      const eTo = bookPlan.bookEnemyUci.slice(2, 4);
      if (hasMyPieceOnSquare(state.grid, state.myColor, bFrom)) {
        return {
          canPremove: true,
          confidence: 94,
          predictionType: "opening_book",
          reasonText: `📖 ДЕБЮТНЫЙ ПРЕМУВ: ${bookPlan.bookOpeningName}`,
          predictedEnemyMove: { from: eFrom, to: eTo, uci: bookPlan.bookEnemyUci },
          premove: { from: bFrom, to: bTo, uci: bookPlan.bookMyReplyUci, piece: "p" }
        };
      }
    }

    if (
      preparedLookahead &&
      preparedLookahead.canPremove &&
      preparedLookahead.premove &&
      hasMyPieceOnSquare(state.grid, state.myColor, preparedLookahead.premove.from)
    ) {
      return preparedLookahead;
    }

    return null;
  }

  function shouldTriggerPremoveByRisk(premovePlan) {
    if (!premovePlan || !premovePlan.canPremove || !premovePlan.premove) return false;
    if (bulletTurboMode) return true;

    const { confidence, predictionType } = premovePlan;
    const myRemainingSecs = getMyRemainingSeconds();
    const effectiveRisk = myRemainingSecs <= 15 ? 4 : premoveRiskLevel;

    if (effectiveRisk === 1) {
      return confidence >= 94 || (predictionType === "recapture" && confidence >= 92);
    }
    if (effectiveRisk === 2) {
      return predictionType === "opening_book" || confidence >= 85;
    }
    if (effectiveRisk === 3) {
      return confidence >= 76;
    }
    return confidence >= 65;
  }

  function chooseAutoMoveOnce(res) {
    if (!res || !res.best) return null;

    if (protectCriticalMoves || bulletTurboMode || res.isDangerPosition) {
      if (
        res.isDangerPosition ||
        res.best.isMateInOne ||
        res.best.isForcedMateInTwo ||
        res.best.isCheckmate ||
        res.best.fromSyzygy ||
        res.best.savedHangingPiece ||
        res.hangingSquare ||
        bulletTurboMode
      ) {
        const label = res.isDangerPosition
          ? "🛡 ЗАЩИТА ОТ МАТА"
          : (res.best.fromSyzygy ? "🔮 SYZYGY БОГ" : (bulletTurboMode ? "🔥 РЕЗНЯ 1+0" : "ЛУЧШИЙ"));
        return { move: res.best, typeLabel: label };
      }
    }

    if (
      useAverageMoveSometimes &&
      res.average &&
      res.average.uci !== res.best.uci &&
      !res.average.blundersMate &&
      !res.average.causesStalemate &&
      !res.average.isRepetitionDrawRisk &&
      !res.average.underDirectAttack &&
      !res.average.ignoredHangingPiece &&
      !res.average.ruinedCastling
    ) {
      const bestEval = parseFloat(res.best.evalPawns) || 0;
      const avgEval = parseFloat(res.average.evalPawns) || 0;
      const evalDiff = Math.abs(bestEval - avgEval);
      if (bestEval >= avgEval && evalDiff <= 0.40) {
        const roll = Math.random() * 100;
        if (roll < averageMoveFrequency) {
          return { move: res.average, typeLabel: "СРЕДНИЙ (2-Я ЛИНИЯ)" };
        }
      }
    }

    return { move: res.best, typeLabel: "ЛУЧШИЙ" };
  }

  /**
   * АДАПТИВНЫЙ LEGIT-ТАЙМИНГ С ПЛАВАЮЩИМ ДЖИТТЕРОМ:
   * Считывает оставшееся время на часах (10+0 / 3+0 / 1+0) и сложность хода,
   * генерируя живую человеческую задержку, которая всегда меняется и никогда не проваливается в палевный минимум.
   */
  function computeLegitHumanDelayMs(moveObj, mySecs, isDanger) {
    const isRecapture = Boolean(
      moveObj &&
      moveObj.captured &&
      lastRealEnemyMove &&
      moveObj.to === lastRealEnemyMove.to
    );
    const isBook = Boolean(moveObj && (moveObj.bookName || uciHistoryList.length <= 6));
    const isTactical = Boolean(isDanger || (moveObj && (moveObj.isSacrifice || moveObj.isFork || moveObj.isTrap)));

    let minMs = 260;
    let maxMs = 680;

    if (mySecs > 210) {
      // Рапид 10+0 / 5+0
      minMs = isRecapture ? 340 : (isBook ? 420 : (isTactical ? 780 : 540));
      maxMs = isRecapture ? 690 : (isBook ? 860 : (isTactical ? 1650 : 1220));
    } else if (mySecs > 50) {
      // Блиц 3+0
      minMs = isRecapture ? 230 : (isBook ? 280 : (isTactical ? 490 : 350));
      maxMs = isRecapture ? 480 : (isBook ? 590 : (isTactical ? 980 : 760));
    } else if (mySecs > 14) {
      // Пуля 1+0
      minMs = isRecapture ? 145 : 185;
      maxMs = isRecapture ? 290 : (isTactical ? 460 : 380);
    } else {
      // Жесткий цейтнот (< 14 сек)
      minMs = 95;
      maxMs = 195;
    }

    // Несимметричный человеческий джиттер (сумма двух независимых случайных величин)
    const r1 = Math.random();
    const r2 = Math.random();
    const blend = (r1 * 0.65 + r2 * 0.35);
    return Math.round(minMs + blend * (maxMs - minMs));
  }

  function scheduleAutoMoveIfNeeded() {
    if (!autoMoveEnabled || extensionInvalidated) return;
    if (isExecutingMove || Date.now() < moveCooldownUntil) return;
    if (autoMoveTimer) return;

    const state = captureBoardState(false);
    if (!state || state.animating || state.actualTurn !== state.myColor) return;
    if (!cachedMoves || !cachedMoves.best || cachedMoves.boardKey !== state.boardKey) return;

    if (currentTurnDecision.boardKey !== state.boardKey || !currentTurnDecision.decided) {
      const triggerRoll = Math.random() * 100;
      if (!bulletTurboMode && autoMoveTriggerRate < 100 && triggerRoll > autoMoveTriggerRate) {
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

      const mySecs = getMyRemainingSeconds();
      const enemySecs = getEnemyRemainingSeconds();
      const isBulletPanic = bulletTurboMode || (workMode !== "legit" && (mySecs <= 15 || enemySecs <= 10));

      let totalDelay = 35;
      let modeLabel = picked.typeLabel;

      if (isBulletPanic) {
        totalDelay = 35 + Math.floor(Math.random() * 18);
        modeLabel = "🔥 ТУРБО 1+0";
      } else if (workMode === "legit" || legitAutoTiming) {
        totalDelay = computeLegitHumanDelayMs(picked.move, mySecs, cachedMoves.isDangerPosition);
        modeLabel = `🛡 LEGIT (${(totalDelay / 1000).toFixed(2)}с)`;
      } else {
        const jitter = autoMoveJitterMs > 0 ? Math.round((Math.random() * 2 - 1) * autoMoveJitterMs) : 0;
        const dangerExtraDelay = cachedMoves.isDangerPosition ? 220 : 0;
        totalDelay = Math.max(55, autoMoveDelayMs + dangerExtraDelay + jitter);
      }

      currentTurnDecision = {
        boardKey: state.boardKey,
        decided: true,
        skip: false,
        move: picked.move,
        typeLabel: modeLabel,
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
    const delayToWait = currentTurnDecision.attempts === 0 ? currentTurnDecision.totalDelay : 220;

    setAutoStatusText(
      `⚡ Ход (${delayToWait}мс): ${mv.from}→${mv.to} [${currentTurnDecision.typeLabel}]`,
      cachedMoves.isDangerPosition ? "#ffbe0b" : (bulletTurboMode ? "#ff4d94" : "#00f5d4")
    );

    const expectedBoardKey = state.boardKey;

    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (!autoMoveEnabled || extensionInvalidated) return;

      const fresh = captureBoardState(false);
      if (!fresh || fresh.animating) {
        scheduleAutoMoveIfNeeded();
        return;
      }
      if (fresh.actualTurn !== fresh.myColor || fresh.boardKey !== expectedBoardKey) {
        return;
      }

      currentTurnDecision.attempts++;
      const moveNow = currentTurnDecision.move || cachedMoves.best;
      if (!moveNow) return;

      executeMoveOnBoard(moveNow, fresh, false, false);
    }, delayToWait);
  }

  function clearStaleSelectedSquare(cgBoard) {
    if (!cgBoard) return;
    const selectedSq = cgBoard.querySelector("square.selected:not(.current-premove)");
    if (!selectedSq) return;
    const sr = selectedSq.getBoundingClientRect();
    if (sr.width > 0) {
      const cx = Math.round(sr.left + sr.width / 2);
      const cy = Math.round(sr.top + sr.height / 2);
      const optsDown = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
      const optsUp = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 0 };
      cgBoard.dispatchEvent(new MouseEvent("mousedown", optsDown));
      cgBoard.dispatchEvent(new MouseEvent("mouseup", optsUp));
    }
  }

  function executeVisualPremoveOnBoard(premoveObj, state) {
    if (!premoveObj || !premoveObj.from || !premoveObj.to || !state || !state.grid) return;
    if (safeAntiBanGuard && isRatedGameAgainstHuman()) return;

    if (!hasMyPieceOnSquare(state.grid, state.myColor, premoveObj.from)) {
      return;
    }

    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (!cgBoard) return;

    if (cgBoard.querySelector("square.current-premove")) {
      return;
    }

    clearStaleSelectedSquare(cgBoard);

    const r = cgBoard.getBoundingClientRect();
    if (r.width < 50) return;

    const isBlack = state.isBlackOrientation;
    const sqToClientCoords = (sq) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return {
        x: Math.round(r.left + (col + 0.5) * (r.width / 8)),
        y: Math.round(r.top + (row + 0.5) * (r.height / 8))
      };
    };

    const p1 = sqToClientCoords(premoveObj.from);
    const p2 = sqToClientCoords(premoveObj.to);

    const fireDragMouse = (target, type, x, y, buttons) => {
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

    fireDragMouse(cgBoard, "mousedown", p1.x, p1.y, 1);

    setTimeout(() => {
      fireDragMouse(document, "mousemove", Math.round((p1.x + p2.x) / 2), Math.round((p1.y + p2.y) / 2), 1);
      fireDragMouse(document, "mousemove", p2.x, p2.y, 1);

      setTimeout(() => {
        fireDragMouse(document, "mouseup", p2.x, p2.y, 0);
        fireDragMouse(cgBoard, "mouseup", p2.x, p2.y, 0);

        setTimeout(() => {
          if (!cgBoard.querySelector("square.current-premove")) {
            fireDragMouse(cgBoard, "mousedown", p2.x, p2.y, 1);
            setTimeout(() => {
              fireDragMouse(cgBoard, "mouseup", p2.x, p2.y, 0);
            }, 15);
          }
          setAutoStatusText(`🔮 ПРЕМУВ ВЫСТАВЛЕН: ${premoveObj.from} → ${premoveObj.to}`, "#c77dff");
        }, 25);
      }, 22);
    }, 18);
  }

  function executeMoveOnBoard(moveObj, state, manualClick = false, isPremoveAction = false) {
    if (isPremoveAction) {
      executeVisualPremoveOnBoard(moveObj, state);
      return;
    }
    if (!moveObj || !moveObj.from || !moveObj.to || !state || !state.grid) return;

    if (!manualClick && safeAntiBanGuard && isRatedGameAgainstHuman()) {
      setAutoStatusText("Блок Анти-Бана в Rated игре!", "#ff2a85");
      return;
    }

    const fromSq = moveObj.from;
    const toSq = moveObj.to;

    if (!hasMyPieceOnSquare(state.grid, state.myColor, fromSq)) {
      return;
    }

    const isPromotion = moveObj.piece === "p" && (toSq[1] === "8" || toSq[1] === "1");
    const promoPiece = isPromotion ? (moveObj.promo || "q") : null;

    lastOurExecutedMove = moveObj;
    if ((premoveEnabled || bulletTurboMode) && moveObj.nextPremove && moveObj.nextPremove.canPremove) {
      preparedLookahead = moveObj.nextPremove;
    } else {
      preparedLookahead = null;
    }

    isExecutingMove = true;
    moveCooldownUntil = Date.now() + (bulletTurboMode ? 180 : 320);
    const beforeKey = state.boardKey;

    setAutoStatusText(`Отправка хода: ${fromSq} → ${toSq}...`, "#00f5d4");

    if (autoClickMethod === "hybrid") {
      window.dispatchEvent(
        new CustomEvent(stealthChannelName, {
          detail: JSON.stringify({
            from: fromSq,
            to: toSq,
            promo: promoPiece
          })
        })
      );
    }

    setTimeout(() => {
      const checkAfterWs = captureBoardState(true);
      if (checkAfterWs && (checkAfterWs.boardKey !== beforeKey || checkAfterWs.actualTurn !== state.myColor)) {
        isExecutingMove = false;
        setAutoStatusText(`Сделан ход (WS): ${fromSq} → ${toSq}`, "#00f5d4");
        triggerDebouncedCycle();
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
        const file = FILES.indexOf(sq[0]);
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

      performCleanDomMove(cgBoard, p1, p2, promoPiece, () => {
        isExecutingMove = false;
        setAutoStatusText(`Сделан ход: ${fromSq} → ${toSq}`, "#00f5d4");
        triggerDebouncedCycle();
      });
    }, autoClickMethod === "hybrid" ? 95 : 10);
  }

  function performCleanDomMove(cgBoard, p1, p2, promoPiece, onDone) {
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

    fireMouse(cgBoard, "mousedown", p1.x, p1.y, 1);

    setTimeout(() => {
      if (autoClickMethod === "drag") {
        fireMouse(document, "mousemove", Math.round((p1.x + p2.x) / 2), Math.round((p1.y + p2.y) / 2), 1);
        fireMouse(document, "mousemove", p2.x, p2.y, 1);
        setTimeout(() => {
          fireMouse(document, "mouseup", p2.x, p2.y, 0);
          fireMouse(cgBoard, "mouseup", p2.x, p2.y, 0);
          if (onDone) onDone();
        }, 25);
      } else {
        fireMouse(cgBoard, "mouseup", p1.x, p1.y, 0);
        setTimeout(() => {
          fireMouse(cgBoard, "mousedown", p2.x, p2.y, 1);
          setTimeout(() => {
            fireMouse(cgBoard, "mouseup", p2.x, p2.y, 0);
            fireMouse(document, "mouseup", p2.x, p2.y, 0);

            if (promoPiece) {
              setTimeout(() => {
                const targetClass = promoPiece === "n" ? "piece.knight" : "piece.queen";
                const promoNode =
                  document.querySelector(`#promotion-choice ${targetClass}`) ||
                  document.querySelector("#promotion-choice square");
                if (promoNode) {
                  const pr = promoNode.getBoundingClientRect();
                  fireMouse(promoNode, "mousedown", pr.left + pr.width / 2, pr.top + pr.height / 2, 1);
                  fireMouse(promoNode, "mouseup", pr.left + pr.width / 2, pr.top + pr.height / 2, 0);
                  promoNode.click();
                }
              }, 60);
            }
            if (onDone) onDone();
          }, 20);
        }, 25);
      }
    }, 20);
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
      if (p.classList.contains("ghost") || p.classList.contains("fading")) return;
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

  function detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation, boardPart) {
    const myColor = isBlackOrientation ? "b" : "w";
    const enemyColor = myColor === "w" ? "b" : "w";

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

    if (boardPart === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") {
      return "w";
    }

    if (document.querySelector(".rclock-bottom.rclock-turn, .rclock-bottom.running")) return myColor;
    if (document.querySelector(".rclock-top.rclock-turn, .rclock-top.running")) return enemyColor;

    const moveNodes = Array.from(document.querySelectorAll("l4x > kwdb, rm6 > kwdb, .tview2 > move")).filter(
      (el) => !el.closest("interrupt")
    );
    if (moveNodes.length > 0) {
      const activeIdx = moveNodes.findIndex(
        (el) => el.classList.contains("a1t") || el.classList.contains("active")
      );
      if (activeIdx !== -1) {
        return (activeIdx + 1) % 2 === 0 ? "w" : "b";
      }
      return moveNodes.length % 2 === 0 ? "w" : "b";
    }

    return "w";
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
        return {
          uci: `${fromSq}${toSq}${promo}`,
          from: fromSq,
          to: toSq,
          piece: oldPiece || "p",
          color
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
      lastPathname = location.pathname;
      castlingRights = {
        K: grid[7][4] === "K" && grid[7][7] === "R",
        Q: grid[7][4] === "K" && grid[7][0] === "R",
        k: grid[0][4] === "k" && grid[0][7] === "r",
        q: grid[0][4] === "k" && grid[0][0] === "r"
      };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      lastRealEnemyMove = null;
      lastOurExecutedMove = null;
      preparedLookahead = null;
      sessionMoveHistory = [];
      uciHistoryList = [];
      recentPositionHistory = [boardPart];
      gameStartedFromInitial = (boardPart === startFenBoard);
      evalGraphHistory = [];
      lastRecordedGraphBoardKey = "";
      renderLiveEvalGraph();
      openingBookDeviated = false;
      lastPremoveSentBoardKey = "";
      gameResultRecorded = false;
      peerExtensionDetected = false;
      suspectEngineStreak = 0;
      lastBeaconCheckTime = 0;
      const peerBanner = $("cc-peer-detector-banner");
      if (peerBanner) peerBanner.style.display = "none";
      return;
    }

    if (!prevGridState) {
      castlingRights = {
        K: grid[7][4] === "K" && grid[7][7] === "R",
        Q: grid[7][4] === "K" && grid[7][0] === "R",
        k: grid[0][4] === "k" && grid[0][7] === "r",
        q: grid[0][4] === "k" && grid[0][0] === "r"
      };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      recentPositionHistory = [boardPart];
      gameStartedFromInitial = (boardPart === startFenBoard);
      openingBookDeviated = false;
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

      if (recentPositionHistory[recentPositionHistory.length - 1] !== boardPart) {
        recentPositionHistory.push(boardPart);
        if (recentPositionHistory.length > 80) {
          recentPositionHistory.shift();
        }
      }

      const realMove = detectRealMoveBetweenGrids(prevGridState, grid);
      if (realMove && realMove.uci) {
        if (uciHistoryList[uciHistoryList.length - 1] !== realMove.uci) {
          uciHistoryList.push(realMove.uci);
        }
        if (realMove.color === myColor && prevBoardPartForHistory) {
          const prevFenKey = `${prevBoardPartForHistory} ${myColor}`;
          sessionMoveHistory.push({ fenKey: prevFenKey, uci: realMove.uci });
          lastOurExecutedMove = realMove;
          lastRealEnemyMove = null;
          if (preparedLookahead && preparedLookahead.forMoveUci && preparedLookahead.forMoveUci !== realMove.uci) {
            preparedLookahead = null;
          }
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
      castlingRights = {
        K: grid[7][4] === "K" && grid[7][7] === "R",
        Q: grid[7][4] === "K" && grid[7][0] === "R",
        k: grid[0][4] === "k" && grid[0][7] === "r",
        q: grid[0][4] === "k" && grid[0][0] === "r"
      };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      gameStartedFromInitial = (boardPart === startFenBoard);
      if (recentPositionHistory[recentPositionHistory.length - 1] !== boardPart) {
        recentPositionHistory.push(boardPart);
      }
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

  function captureBoardState(allowCachedDuringAnim = false) {
    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (!cgBoard) return null;

    const boardRect = cgBoard.getBoundingClientRect();
    if (boardRect.width < 50 || boardRect.height < 50) return null;

    if (!allowCachedDuringAnim && !isExecutingMove && cgBoard.querySelector("piece.anim, piece.dragging")) {
      if (!animRetryTimer) {
        animRetryTimer = setTimeout(() => {
          animRetryTimer = null;
          runCycle(false);
        }, 25);
      }
      return { animating: true };
    }

    const isBlackOrientation = detectBlackOrientation(cgBoard, boardRect);
    const myColor = isBlackOrientation ? "b" : "w";

    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    const pieceMap = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

    const cellW = boardRect.width / 8;
    const cellH = boardRect.height / 8;

    let pieceCount = 0;
    const pieces = cgBoard.querySelectorAll("piece");
    pieces.forEach((p) => {
      if (p.classList.contains("ghost") || p.classList.contains("fading")) return;
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
      pieceCount++;
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

    const boardPart = fenRows.join("/");
    updateCastlingEpAndRealHistory(grid, boardPart, myColor);

    const actualTurn = detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation, boardPart);

    let sideToAnalyze = actualTurn;
    if (turnMode === "w") sideToAnalyze = "w";
    else if (turnMode === "b") sideToAnalyze = "b";

    const castlingStr = getCastlingString();
    return {
      animating: false,
      grid,
      pieceCount,
      fen: `${boardPart} ${sideToAnalyze} ${castlingStr} ${currentEpSquare} 0 1`,
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

  function renderPremovePreviewOverlay(state, premovePlan) {
    let svg = $("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      getShadow().appendChild(svg);
    }

    const showHeatmapNow = Boolean(isAltPressed || heatmapAlwaysOn);
    if (!showHeatmapNow && (!showArrows || !showPremoveArrows || !state || !state.boardRect || !premovePlan || !premovePlan.premove)) {
      svg.innerHTML = "";
      svg.style.display = "none";
      return;
    }

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
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return { x: col * 100 + 50, y: row * 100 + 50 };
    };

    const heatmapSVG = showHeatmapNow ? buildHeatmapCellsSVG(cachedMoves.heatmap, sqToXY) : "";
    if (!premovePlan || !premovePlan.premove) {
      svg.innerHTML = heatmapSVG;
      return;
    }

    const enemyMove = premovePlan.predictedEnemyMove;
    const ourPremove = premovePlan.premove;
    const pEnemy1 = (enemyMove && enemyMove.from !== enemyMove.to) ? sqToXY(enemyMove.from) : null;
    const pEnemy2 = (enemyMove && enemyMove.from !== enemyMove.to) ? sqToXY(enemyMove.to) : null;
    const pOur1 = sqToXY(ourPremove.from);
    const pOur2 = sqToXY(ourPremove.to);

    if (arrowStyle.startsWith("sq_")) {
      svg.innerHTML = `
        ${heatmapSVG}
        <rect x="${pOur1.x - 46}" y="${pOur1.y - 46}" width="92" height="92" rx="12"
              fill="rgba(199, 125, 255, 0.16)" stroke="#c77dff" stroke-width="3.5" stroke-dasharray="12 6" />
        <rect x="${pOur2.x - 46}" y="${pOur2.y - 46}" width="92" height="92" rx="12"
              fill="rgba(0, 245, 212, 0.24)" stroke="#00f5d4" stroke-width="4" />
        <g style="animation: cc-marker-float 1.2s ease-in-out infinite;">
          <rect x="${pOur2.x - 46}" y="${pOur2.y - 52}" width="92" height="24" rx="6"
                fill="rgba(12, 10, 22, 0.95)" stroke="#c77dff" stroke-width="2" />
          <text x="${pOur2.x}" y="${pOur2.y - 36}" text-anchor="middle" fill="#c77dff"
                font-family="monospace" font-weight="900" font-size="11.5">🔮 ${premovePlan.confidence}%</text>
        </g>
      `;
      return;
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="grad-premove" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#c77dff" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="grad-enemy-pred" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="800">
          <stop offset="0%" stop-color="#ff2a85" />
          <stop offset="100%" stop-color="#ffbe0b" />
        </linearGradient>
        <marker id="m-premove" markerWidth="3.2" markerHeight="3.2" refX="1.5" refY="1.6" orient="auto">
          <path d="M0,0 L3.2,1.6 L0,3.2 L0.6,1.6 Z" fill="#c77dff" fill-opacity="0.95"/>
        </marker>
      </defs>
      ${heatmapSVG}
      ${pEnemy1 && pEnemy2 ? `
        <line x1="${pEnemy1.x}" y1="${pEnemy1.y}" x2="${pEnemy2.x}" y2="${pEnemy2.y}"
              stroke="url(#grad-enemy-pred)" stroke-width="${7.5 * arrowScale}" stroke-dasharray="10 10"
              stroke-linecap="round" stroke-opacity="0.45" />
      ` : ""}
      <circle cx="${pOur1.x}" cy="${pOur1.y}" r="${10 * arrowScale}" fill="#c77dff" fill-opacity="0.75" />
      <circle cx="${pOur2.x}" cy="${pOur2.y}" r="${33 * arrowScale}" fill="none" stroke="#c77dff" stroke-width="${3 * arrowScale}" stroke-dasharray="10 6" />
      <line x1="${pOur1.x}" y1="${pOur1.y}" x2="${pOur2.x}" y2="${pOur2.y}"
            stroke="url(#grad-premove)" stroke-width="${12 * arrowScale}" stroke-dasharray="16 9"
            stroke-linecap="round" stroke-opacity="0.88" marker-end="url(#m-premove)"
            style="filter: drop-shadow(0 0 8px #c77dff);" class="cc-best-flow" />
      <g style="animation: cc-marker-float 1.2s ease-in-out infinite;">
        <rect x="${pOur2.x - 46}" y="${pOur2.y - 52}" width="92" height="24" rx="6"
              fill="rgba(12, 10, 22, 0.94)" stroke="#c77dff" stroke-width="2" />
        <text x="${pOur2.x}" y="${pOur2.y - 36}" text-anchor="middle" fill="#c77dff"
              font-family="monospace" font-weight="900" font-size="11.5">🔮 ${premovePlan.confidence}%</text>
      </g>
    `;
  }

  function renderArrowsOverlay(state, res) {
    let svg = $("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      getShadow().appendChild(svg);
    }

    const showHeatmapNow = Boolean(isAltPressed || heatmapAlwaysOn);

    if (turnMode === "my" && state && state.actualTurn !== state.myColor && !showHeatmapNow) {
      hideArrows();
      return;
    }

    if (!showHeatmapNow && (!showArrows || !state || !state.boardRect || !res || !res.best)) {
      svg.innerHTML = "";
      svg.style.display = "none";
      return;
    }

    const r = state.boardRect;
    svg.style.display = "block";
    svg.style.position = "fixed";
    svg.style.left = `${r.left}px`;
    svg.style.top = `${r.top}px`;
    svg.style.width = `${r.width}px`;
    svg.style.height = `${r.height}px`;
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "2147483645";
    svg.style.animation = arrowStyle === "chroma_rgb" ? "cc-chroma-shift 2.5s linear infinite" : "none";

    const isBlack = state.isBlackOrientation;
    const sqToXY = (sq) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return { x: col * 100 + 50, y: row * 100 + 50 };
    };

    const heatmapSVG = showHeatmapNow ? buildHeatmapCellsSVG(res?.heatmap || cachedMoves.heatmap, sqToXY) : "";
    if (!res || !res.best || !showArrows || (turnMode === "my" && state.actualTurn !== state.myColor)) {
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
      ${!best.isMateInOne && showAverageMove && workMode !== "hvh" ? drawSingleArrow(average, "grad-avg", "#ffbe0b", "m-avg", avgCurve, 0.58, false, "avg") : ""}
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

    const statusEl = document.querySelector(".result-wrap .status, .game__meta .status, .rcontrols .status");
    if (!statusEl) return;
    const statusText = statusEl.innerText || "";

    const whiteWon = statusText.includes("White is victorious") || statusText.includes("Победа белых");
    const blackWon = statusText.includes("Black is victorious") || statusText.includes("Победа черных");
    const isDraw = statusText.includes("Stalemate") || statusText.includes("Draw") || statusText.includes("Ничья");

    if (!whiteWon && !blackWon && !isDraw) return;

    gameResultRecorded = true;
    let outcome = "draw";
    if (whiteWon) outcome = myColor === "w" ? "win" : "loss";
    if (blackWon) outcome = myColor === "b" ? "win" : "loss";

    safeSendMessage(
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

  function getSharedGameRoomId() {
    const reservedWords = [
      "analysis", "training", "practice", "streamer", "settings",
      "timeline", "team", "game", "tournament", "swiss", "study", "broadcast"
    ];
    const parts = location.pathname.replace(/^\/+/, "").split("/");
    for (const part of parts) {
      const clean = (part || "").trim();
      if (!clean || reservedWords.includes(clean.toLowerCase())) continue;
      if (/^[a-zA-Z0-9]{8,12}$/.test(clean)) {
        return clean.slice(0, 8);
      }
    }
    return null;
  }

  function checkOpponentExtensionBeacon(myColor, forceNow = false) {
    if (peerExtensionDetected || extensionInvalidated || !isContextValid()) return;
    const now = Date.now();
    if (!forceNow && now - lastBeaconCheckTime < 10000) return;
    lastBeaconCheckTime = now;

    const roomId = getSharedGameRoomId();
    const banner = $("cc-peer-detector-banner");
    if (!roomId || !banner) return;

    safeSendMessage(
      {
        type: "CHECK_PEER_BEACON",
        roomId,
        myColor,
        style: currentStyle,
        elo: currentElo,
        autoMove: autoMoveEnabled
      },
      (res) => {
        if (res && res.detected) {
          peerExtensionDetected = true;
          const stName = ALL_STYLE_NAMES[res.enemyStyle] || res.enemyStyle;
          const autoTag = res.enemyAuto ? "🤖 Автоход: ВКЛ" : "🖐 Ходит сам";
          banner.style.display = "block";
          banner.style.borderColor = "#00f5d4";
          $("cc-peer-detector-title").innerHTML = `
            <span>👁️ РАДАР СВОИХ: ОБНАРУЖЕН CHESSCOACH!</span>
            <span style="background:rgba(0,0,0,0.45); padding:1px 6px; border-radius:4px; font-family:monospace;">⚡ HVH</span>
          `;
          $("cc-peer-detector-text").textContent =
            `Соперник играет с ChessCoach REWORK! Его профиль: ${stName} (${res.enemyElo} ELO • ${autoTag})`;
        }
      }
    );
  }

  function updateBehavioralCheatDetector(res) {
    if (peerExtensionDetected || !res || !res.lastOpponentMove) return;
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
      banner.style.borderColor = "#ffbe0b";
      $("cc-peer-detector-title").innerHTML = `
        <span style="color:#ffbe0b;">🕵️ ЧИТ-РАДАР: ПОДОЗРЕНИЕ НА ДВИЖОК!</span>
        <span style="background:rgba(0,0,0,0.45); color:#ffbe0b; padding:1px 6px; border-radius:4px; font-family:monospace;">⚠️ BOT?</span>
      `;
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
      baseRes.best.isForcedMateInTwo
    ) {
      return baseRes;
    }

    const safeSet = Array.isArray(baseRes.safeNonRepeatingUcis) && baseRes.safeNonRepeatingUcis.length > 0
      ? new Set(baseRes.safeNonRepeatingUcis)
      : null;

    let chosenLine = null;
    for (const idx of [1, 2, 3]) {
      const candidate = wasmOut.lines[idx];
      if (!candidate || !candidate.uci) continue;
      if (candidate.isMate && candidate.mateIn > 0) {
        chosenLine = candidate;
        break;
      }
      if (!safeSet || safeSet.has(candidate.uci)) {
        if (idx === 1 || candidate.scoreCp >= -40 || candidate.scoreCp >= (wasmOut.lines[1].scoreCp - 110)) {
          chosenLine = candidate;
          break;
        }
      }
    }

    if (!chosenLine) {
      return baseRes;
    }

    if (
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

    const capturedAtSq = (sq) => {
      if (!state || !state.grid || !sq || sq.length < 2) return null;
      const c = FILES.indexOf(sq[0]);
      const r = 8 - parseInt(sq[1], 10);
      const p = state.grid[r]?.[c];
      return p ? p.toLowerCase() : null;
    };

    const isMateIn1 = Boolean(chosenLine.isMate && chosenLine.mateIn === 1);
    const isMateIn2 = Boolean(chosenLine.isMate && chosenLine.mateIn === 2);
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
      captured: capturedAtSq(chosenLine.to),
      fromWasm: true,
      isMateInOne: isMateIn1,
      isForcedMateInTwo: isMateIn2,
      isCheckmate: Boolean(chosenLine.isMate && chosenLine.mateIn > 0),
      pvLine: chosenLine.pvChain || baseRes.best.pvLine,
      pureSearchScore: chosenLine.scoreCp,
      evalPawns: evalPawnsStr,
      whitePerspectiveEval: whiteEval,
      isTrap: chosenLine.uci === baseRes.best.uci ? baseRes.best.isTrap : false,
      nextPremove: chosenLine.uci === baseRes.best.uci ? baseRes.best.nextPremove : null
    };

    let updatedAvg = baseRes.average;
    if (showAverageMove && wasmOut.lines[2] && wasmOut.lines[2].uci !== updatedBest.uci) {
      const l2 = wasmOut.lines[2];
      if (!safeSet || safeSet.has(l2.uci)) {
        updatedAvg = {
          ...(baseRes.average || baseRes.best),
          uci: l2.uci,
          from: l2.from,
          to: l2.to,
          promo: l2.promo || null,
          piece: pieceAtSq(l2.from),
          captured: capturedAtSq(l2.to),
          fromWasm: true,
          isMateInOne: false,
          blundersMate: Boolean(l2.isMate && l2.mateIn < 0),
          pvLine: l2.pvChain,
          pureSearchScore: l2.scoreCp,
          evalPawns: l2.isMate ? `МАТ #${l2.mateIn}` : (l2.scoreCp / 100).toFixed(2)
        };
      }
    }

    const updatedTelemetry = baseRes.telemetry
      ? {
          ...baseRes.telemetry,
          serverSource: `SF WASM d${chosenLine.depth || 12} + ${baseRes.telemetry.serverSource}`,
          nearestThreatText: isMateIn1
            ? `👑 МАТ В 1 ХОД: ${updatedBest.from}→${updatedBest.to}#`
            : (isMateIn2
                ? `👑 ФОРС. МАТ В 2 ХОДА: ${updatedBest.from}→${updatedBest.to}+`
                : `План SF WASM: ${updatedBest.from}→${updatedBest.to} (${evalPawnsStr})`)
        }
      : null;

    return {
      ...baseRes,
      best: updatedBest,
      average: updatedAvg,
      telemetry: updatedTelemetry
    };
  }

  function applyAnalysisResult(state, res, isDeepPass = false, prevBestUci = "") {
    if (!res || res.error) return;
    if (!isDeepPass && res.lastOpponentMove) {
      updateBehavioralCheatDetector(res);
    }
    cachedMoves = res;

    if (res.telemetry) {
      lastTelemetryData = res.telemetry;
    }
    updateLiveTelemetryUI();
    updateTimeSniperBanner(res);

    if (res.best) {
      recordEvalPoint(state.boardKey, res.best.whitePerspectiveEval || res.best.evalPawns, res.opponentEvalDropPawns);
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

    if ((premoveEnabled || bulletTurboMode) && res.best && res.best.nextPremove && res.best.nextPremove.canPremove) {
      preparedLookahead = res.best.nextPremove;
    }

    if (isDeepPass && currentTurnDecision.boardKey === state.boardKey && !currentTurnDecision.skip) {
      if (currentTurnDecision.typeLabel.startsWith("СРЕДНИЙ") && !res.isDangerPosition && res.average) {
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

    const mateBanner = $("cc-mate-banner");
    if (mateBanner) {
      if (res.best && (res.best.isMateInOne || res.best.isForcedMateInTwo)) {
        mateBanner.style.display = "block";
        const mateTitleEl = $("cc-mate-banner-title");
        if (mateTitleEl) {
          mateTitleEl.textContent = res.best.isMateInOne
            ? "👑💀 АХАХАХ! МАТ В 1 ХОД НА ДОСКЕ!"
            : "👑⚡ ФОРСИРОВАННЫЙ МАТ В 2 ХОДА!";
        }
        $("cc-mate-banner-text").textContent = res.best.isMateInOne
          ? `Ход ${res.best.from} → ${res.best.to}# ставит чистый МАТ В 1 ХОД! Соперник доигрался!`
          : `Ход ${res.best.from} → ${res.best.to}+ гарантированно ставит МАТ В 2 ХОДА при любом ответе врага!`;
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
        $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД • ${styleLabel}${badgesHtml}`;
      }

      if (!bulletTurboMode && (isDeepPass || res.best.isMateInOne) && isBrilliant && phonkEditEnabled && state.actualTurn === state.myColor && window.ChessFX) {
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
        $("cc-opening-plan").textContent = `${res.best.syzygyBadge || "100% математическая точность эндшпиля"}. Движок знает точное число ходов до размена или мата.`;
      } else if (res.isDangerPosition && !res.best.isMateInOne) {
        if (openingCard) openingCard.style.borderLeftColor = "#ff2a85";
        $("cc-opening-name").textContent = `🛡 АНТИ-МАТ РАДАР: ${res.dangerReason || "УГРОЗА КОРОЛЮ"}!`;
        $("cc-opening-plan").textContent = `Внимание! Движок обнаружил матовую угрозу соперника и включил глубокий поиск защиты (${res.best.from} → ${res.best.to}).`;
      } else if (res.hangingSquare && !res.best.isMateInOne) {
        if (openingCard) openingCard.style.borderLeftColor = "#ffbe0b";
        $("cc-opening-name").textContent = `⚠️ ВНИМАНИЕ: ПОЛЕ ${res.hangingSquare.toUpperCase()} ПОД БОЕМ!`;
        $("cc-opening-plan").textContent = `Ваша пешка или фигура на клетке ${res.hangingSquare} атакована — защитите или уведите её!`;
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

      renderEvalBar(state, res.best.whitePerspectiveEval || res.best.evalPawns);

      if (autoMoveEnabled && state.actualTurn === state.myColor) {
        const mySecs = getMyRemainingSeconds();
        const isExtremePanicTime = mySecs <= 4;
        const needsDeepVerification = Boolean(
          (res.isDangerPosition || res.hangingSquare) &&
          !res.best.isMateInOne &&
          !res.best.isForcedMateInTwo &&
          !res.best.fromSyzygy
        );
        if (!isDeepPass && needsDeepVerification && !isExtremePanicTime) {
          setAutoStatusText(`🛡 Проверка тактической угрозы глубоким движком...`, "#ffbe0b");
        } else {
          scheduleAutoMoveIfNeeded();
        }
      }
    }

    if (showAverageMove && workMode !== "hvh" && res.average) {
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

    renderArrowsOverlay(state, res);
  }

  function applyPremovePlanOnEnemyTurn(state, plan) {
    if (plan && plan.telemetry) {
      lastTelemetryData = plan.telemetry;
    }
    if (plan && Array.isArray(plan.heatmap)) {
      cachedMoves.heatmap = plan.heatmap;
    }
    updateLiveTelemetryUI();

    const standbySub = $("cc-standby-sub");
    if (!premoveEnabled && !bulletTurboMode && !showPremoveArrows) {
      if (isAltPressed || heatmapAlwaysOn) {
        renderPremovePreviewOverlay(state, null);
      } else {
        hideArrows();
      }
      if (standbySub) {
        standbySub.textContent = "Старые метки очищены. Живая телеметрия выше продолжает следить за часами и угрозами!";
      }
      return;
    }

    if (
      !plan ||
      !plan.canPremove ||
      !plan.premove ||
      !hasMyPieceOnSquare(state.grid, state.myColor, plan.premove.from)
    ) {
      if (isAltPressed || heatmapAlwaysOn) {
        renderPremovePreviewOverlay(state, null);
      } else {
        hideArrows();
      }
      if (standbySub) {
        standbySub.textContent = "Позиция со множеством веток врага — не рискуем слепым премувом, ждем хода!";
      }
      return;
    }

    if (standbySub) {
      standbySub.innerHTML = `
        <strong>${plan.reasonText}</strong><br>
        Наш премув: <strong style="color:#c77dff;">${plan.premove.from} → ${plan.premove.to} (${plan.confidence}%)</strong>
      `;
    }

    if (showPremoveArrows || premoveEnabled || bulletTurboMode) {
      renderPremovePreviewOverlay(state, plan);
    } else {
      hideArrows();
    }

    if (premoveEnabled || bulletTurboMode) {
      if (lastPremoveSentBoardKey !== state.boardKey && shouldTriggerPremoveByRisk(plan)) {
        lastPremoveSentBoardKey = state.boardKey;
        clearTimeout(premoveTimer);
        premoveTimer = setTimeout(() => {
          const verifySt = captureBoardState(false);
          if (verifySt && !verifySt.animating && verifySt.actualTurn !== verifySt.myColor && verifySt.boardKey === state.boardKey) {
            executeVisualPremoveOnBoard(plan.premove, verifySt);
          }
        }, 25);
      } else if (lastPremoveSentBoardKey !== state.boardKey) {
        setAutoStatusText(
          `Прогноз ${plan.premove.from}→${plan.premove.to} (${plan.confidence}% < порога Ур.${premoveRiskLevel})`,
          "#94a3b8"
        );
      }
    }
  }

  function handleEnemyTurnInstantPremove(state) {
    if (committedEnemyBoardKey === state.boardKey) {
      updateLiveTelemetryUI();
      return;
    }
    committedEnemyBoardKey = state.boardKey;

    hideArrows();

    const localPlan = computeLocalInstantPremovePlan(state);
    if (localPlan && localPlan.canPremove && localPlan.premove) {
      applyPremovePlanOnEnemyTurn(state, localPlan);
    }

    const myPremoveId = ++premoveReqId;
    safeSendMessage(
      {
        type: "GET_INSTANT_PREMOVE",
        fen: state.fen,
        myColor: state.myColor,
        lastOurMove: lastOurExecutedMove,
        style: currentStyle,
        recentPositions: recentPositionHistory
      },
      (bgPlan) => {
        if (myPremoveId !== premoveReqId) return;
        const fresh = captureBoardState(false);
        if (!fresh || fresh.animating || fresh.actualTurn === fresh.myColor || fresh.boardKey !== state.boardKey) return;
        applyPremovePlanOnEnemyTurn(fresh, (localPlan && localPlan.canPremove) ? { ...bgPlan, ...localPlan } : bgPlan);
      }
    );
  }

  function runCycle(forceByButton = false) {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }

    ensurePanel();
    updateLiveTelemetryUI();

    if (!forceByButton && (isExecutingMove || Date.now() < moveCooldownUntil)) {
      return;
    }

    const state = captureBoardState(false);
    if (!state || state.animating) return;

    checkGameEndAndLearn(state.myColor);
    checkOpponentExtensionBeacon(state.myColor, false);

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
      if (autoMoveEnabled && !premoveEnabled && !bulletTurboMode) {
        setAutoStatusText("Ждем ответа соперника...", "#94a3b8");
      }
      committedBoardKey = "";

      handleEnemyTurnInstantPremove(state);
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
    preparedLookahead = null;
    resetTurnDecision();

    const myReqId = ++analysisRequestId;
    const sideText = state.sideToAnalyze === "w" ? "ХОД БЕЛЫХ ⚪" : "ХОД ЧЕРНЫХ ⚫";
    if ($("cc-turn-indicator")) $("cc-turn-indicator").textContent = sideText;

    const mySecs = getMyRemainingSeconds();
    const enemySecs = getEnemyRemainingSeconds();
    const isTurboActive = Boolean(bulletTurboMode || (workMode !== "legit" && mySecs <= 15));
    const needAvg = Boolean((showAverageMove || useAverageMoveSometimes) && workMode !== "hvh");
    const needWorst = Boolean(showWorstMove && workMode === "all");

    safeSendMessage(
      {
        type: "ANALYZE_POSITION",
        fen: state.fen,
        elo: currentElo,
        style: currentStyle,
        pass: "fast",
        lastEnemyMove: lastRealEnemyMove,
        bulletTurbo: isTurboActive,
        calcAverage: needAvg,
        calcWorst: needWorst,
        myColor: state.myColor,
        mySeconds: mySecs,
        enemySeconds: enemySecs,
        trapRadarEnabled,
        recentPositions: recentPositionHistory,
        lastOurMove: lastOurExecutedMove
      },
      (fastRes) => {
        if (myReqId !== analysisRequestId || !fastRes || !fastRes.best || fastRes.error) return;
        const freshFast = captureBoardState(true);
        const targetState = (freshFast && !freshFast.animating && freshFast.boardKey === state.boardKey) ? freshFast : state;
        applyAnalysisResult(targetState, fastRes, false, "");

        if (
          (fastRes.best && (fastRes.best.isMateInOne || fastRes.best.isForcedMateInTwo || fastRes.best.fromSyzygy)) ||
          (isTurboActive && !fastRes.isDangerPosition && !fastRes.hangingSquare)
        ) {
          if (deepBadge) deepBadge.style.display = "none";
          return;
        }

        if (deepBadge) {
          deepBadge.textContent = fastRes.isDangerPosition
            ? "🛡 ПОИСК ЗАЩИТЫ..."
            : (useStockfishWasm ? "🧠 SF WASM + CLOUD..." : "⚡ ДОРАСЧЕТ...");
          deepBadge.style.display = "inline-block";
        }
        const firstBestUci = fastRes.best ? fastRes.best.uci : "";

        const shouldRunWasm = Boolean(useStockfishWasm && currentElo >= 1800 && state.pieceCount > 7);
        const wasmMovetime = isTurboActive ? 95 : (fastRes.isDangerPosition || fastRes.hangingSquare ? 290 : 195);
        const wasmPromise = shouldRunWasm
          ? StockfishWasmEngine.analyze(state.fen, wasmMovetime, 3, uciHistoryList, gameStartedFromInitial)
          : Promise.resolve(null);

        safeSendMessage(
          {
            type: "ANALYZE_POSITION",
            fen: state.fen,
            elo: currentElo,
            style: currentStyle,
            pass: "deep",
            lastEnemyMove: lastRealEnemyMove,
            bulletTurbo: isTurboActive,
            calcAverage: needAvg,
            calcWorst: needWorst,
            myColor: state.myColor,
            mySeconds: mySecs,
            enemySeconds: enemySecs,
            trapRadarEnabled,
            recentPositions: recentPositionHistory,
            lastOurMove: lastOurExecutedMove
          },
          async (deepRes) => {
            if (myReqId !== analysisRequestId) return;
            if (!deepRes || deepRes.error) {
              if (deepBadge) deepBadge.style.display = "none";
              return;
            }

            let finalDeep = deepRes;
            if (shouldRunWasm) {
              try {
                const wasmOut = await wasmPromise;
                if (myReqId !== analysisRequestId) return;
                if (wasmOut && (!deepRes.best || !deepRes.best.fromCloud)) {
                  finalDeep = mergeWasmAnalysisIntoResult(deepRes, wasmOut, state);
                }
              } catch (e) {}
            }

            if (deepBadge) deepBadge.style.display = "none";

            const currentFresh = captureBoardState(true);
            if (!currentFresh || currentFresh.animating || currentFresh.boardKey !== state.boardKey) return;

            applyAnalysisResult(currentFresh, finalDeep, true, firstBestUci);
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
  let observedMovesNode = null;

  const domObserver = new MutationObserver(triggerDebouncedCycle);

  function ensureObserversAttached() {
    if (extensionInvalidated || !isContextValid()) return;
    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (cgBoard && cgBoard !== observedBoardNode) {
      observedBoardNode = cgBoard;
      domObserver.observe(cgBoard, {
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style"]
      });
      triggerDebouncedCycle();
    }

    const movesWrap = document.querySelector(".round__app__table, .analyse__moves, l4x, rm6");
    if (movesWrap && movesWrap !== observedMovesNode) {
      observedMovesNode = movesWrap;
      domObserver.observe(movesWrap, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  const syncVisualPosition = () => {
    if (extensionInvalidated || !isContextValid()) return;
    const state = captureBoardState(true);
    if (state && !state.animating && cachedMoves.best) {
      renderEvalBar(state, cachedMoves.best.whitePerspectiveEval || cachedMoves.best.evalPawns);
      if (turnMode === "my" && state.actualTurn !== state.myColor && !isAltPressed && !heatmapAlwaysOn) return;
      renderArrowsOverlay(state, cachedMoves);
    }
  };

  loadSettings();
  ensureObserversAttached();

  mainIntervalId = setInterval(() => {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }
    ensureObserversAttached();
    if (!isExecutingMove && Date.now() >= moveCooldownUntil) {
      runCycle(false);
    }
  }, 250);

  window.addEventListener("scroll", syncVisualPosition, { passive: true });
  window.addEventListener("resize", syncVisualPosition, { passive: true });
})();