(function () {
  console.log("[ChessCoach REWORK v10.5 — Zero-Lag Premove, 2-Move Lookahead & Bullet Turbo] Запущен!");

  if (!window.ChessFX) {
    window.ChessFX = (function () {
      let audioCtx = null;
      let activeEditTimer = null;
      let activeBeatInterval = null;
      let lastTriggeredBoardKey = "";

      const PHONK_CAPTIONS = [
        "💎 БРИЛЛИАНТОВЫЙ ХОД !! 💎",
        "💀 TOTAL MOGGING // +999 AURA 💀",
        "⚡ ГРОССМЕЙСТЕРСКАЯ ЖЕРТВА !! ⚡",
        "👑 ОТПРАВЛЕН В ЛОББИ // EASY 👑",
        "🔥 SIGMA TACTICAL DESTRUCTION 🔥"
      ];

      function createDistortionCurve(amount = 400) {
        const n = 44100;
        const curve = new Float32Array(n);
        const deg = Math.PI / 180;
        for (let i = 0; i < n; ++i) {
          const x = (i * 2) / n - 1;
          curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
      }

      function playPhonkCowbell(ctx, dest, freq, time, duration = 0.14) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc1.type = "square";
        osc2.type = "square";
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq * 1.48, time);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1200, time);
        filter.Q.setValueAtTime(2.8, time);
        gain.gain.setValueAtTime(0.38, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
      }

      function play808BassKick(ctx, dest, freq, time, duration = 0.28) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(freq, time + 0.045);
        gain.gain.setValueAtTime(0.65, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + duration);
      }

      function playHiHat(ctx, dest, time) {
        const bufferSize = Math.floor(ctx.sampleRate * 0.04);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(7500, time);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        noise.start(time);
      }

      function isBrilliantMove(moveObj) {
        if (!moveObj) return false;
        return Boolean(
          moveObj.isSacrifice ||
          moveObj.isTalSacrifice ||
          moveObj.isMateInOne ||
          moveObj.promo === "n" ||
          (moveObj.isFork && parseFloat(moveObj.evalPawns) >= 2.5)
        );
      }

      function isEditRunning() {
        return Boolean(activeBeatInterval || activeEditTimer);
      }

      function stopPhonkEdit(shadowRoot) {
        if (activeEditTimer) { clearTimeout(activeEditTimer); activeEditTimer = null; }
        if (activeBeatInterval) { clearInterval(activeBeatInterval); activeBeatInterval = null; }
        if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
        const cgWrap = document.querySelector(".cg-wrap, cg-board");
        if (cgWrap) {
          cgWrap.style.transform = "";
          cgWrap.style.filter = "";
          cgWrap.style.transition = "";
        }
        if (shadowRoot) {
          const overlay = shadowRoot.getElementById("cc-phonk-edit-overlay");
          if (overlay) overlay.remove();
          const testBtn = shadowRoot.getElementById("cc-test-phonk-btn");
          if (testBtn) testBtn.textContent = "🔥 ТЕСТ ФОНК-ЭДИТА (15 СЕК)";
        }
      }

      function triggerBrilliantPhonkEdit(shadowRoot, moveObj, state, durationMs = 15000, forceTest = false) {
        if (!shadowRoot) return;
        if (forceTest && isEditRunning()) {
          stopPhonkEdit(shadowRoot);
          return;
        }
        const safeMove = moveObj || { from: "g5", to: "f7", piece: "n" };
        if (!forceTest && state && state.boardKey) {
          if (state.boardKey === lastTriggeredBoardKey) return;
          lastTriggeredBoardKey = state.boardKey;
        }
        stopPhonkEdit(shadowRoot);

        const testBtn = shadowRoot.getElementById("cc-test-phonk-btn");
        if (testBtn) testBtn.textContent = "⏹ ОСТАНОВИТЬ ФОНК-ЭДИТ [ESC]";

        const overlay = document.createElement("div");
        overlay.id = "cc-phonk-edit-overlay";
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          pointer-events: none; z-index: 2147483647;
          overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
        `;
        const moveText = `${(safeMove.from || "g5").toUpperCase()} ➔ ${(safeMove.to || "f7").toUpperCase()}!!`;
        overlay.innerHTML = `
          <style>
            @keyframes cc-phonk-vignette {
              0%, 100% { box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.92), inset 0 0 55px rgba(0, 245, 212, 0.55); }
              50% { box-shadow: inset 0 0 160px rgba(0, 0, 0, 0.96), inset 0 0 85px rgba(255, 42, 133, 0.75); }
            }
            @keyframes cc-lightning-flash {
              0%, 88%, 100% { opacity: 0; }
              92%, 96% { opacity: 0.28; }
            }
            #cc-phonk-frame {
              position: absolute; top: 0; left: 0; width: 100%; height: 100%;
              animation: cc-phonk-vignette 0.76s ease-in-out infinite;
              background: repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0, 0, 0, 0.24) 4px);
            }
            #cc-phonk-flash {
              position: absolute; top: 0; left: 0; width: 100%; height: 100%;
              background: linear-gradient(135deg, #00f5d4, #ff2a85);
              mix-blend-mode: overlay;
              animation: cc-lightning-flash 0.76s infinite;
            }
            #cc-phonk-center-banner {
              position: absolute; left: 50%; top: 15%;
              transform: translate(-50%, -50%);
              background: rgba(8, 10, 16, 0.95);
              border: 2.5px solid #00f5d4;
              border-radius: 18px;
              padding: 15px 30px;
              text-align: center;
              box-shadow: 0 0 50px rgba(0, 245, 212, 0.7), 0 0 95px rgba(255, 42, 133, 0.4);
              backdrop-filter: blur(16px);
              transition: transform 0.08s ease;
            }
            .cc-brilliant-pill {
              display: inline-flex; align-items: center; gap: 8px;
              background: linear-gradient(135deg, #00f5d4, #00bbf9);
              color: #05070b; font-weight: 900; font-size: 13px;
              padding: 4px 12px; border-radius: 999px; letter-spacing: 1px;
              margin-bottom: 6px;
            }
            #cc-phonk-main-title {
              font-size: 26px; font-weight: 900; color: #ffffff;
              text-shadow: 0 0 18px #00f5d4, 3px 3px 0 #ff2a85;
              letter-spacing: 1.2px; text-transform: uppercase;
            }
            #cc-phonk-sub-move {
              font-size: 15px; font-weight: 800; color: #ffbe0b;
              font-family: monospace; margin-top: 4px;
            }
            #cc-phonk-skip-btn {
              position: absolute; top: 22px; left: 22px;
              pointer-events: auto; cursor: pointer;
              background: rgba(15, 18, 26, 0.95); color: #f1f5f9;
              border: 2px solid #ff2a85;
              border-radius: 10px; padding: 9px 16px;
              font-weight: 900; font-size: 12.5px;
              box-shadow: 0 8px 24px rgba(0,0,0,0.75);
            }
            #cc-phonk-skip-btn:hover { background: #ff2a85; color: #fff; }
            #cc-phonk-timer-bar {
              height: 4px; width: 100%; background: #00f5d4;
              margin-top: 10px; border-radius: 4px;
              transition: width 0.18s linear;
            }
          </style>
          <div id="cc-phonk-frame"></div>
          <div id="cc-phonk-flash"></div>
          <div id="cc-phonk-center-banner">
            <div class="cc-brilliant-pill"><span>💎</span><span>BRILLIANT MOVE !!</span><span>💀</span></div>
            <div id="cc-phonk-main-title">💎 БРИЛЛИАНТОВЫЙ ХОД !! 💎</div>
            <div id="cc-phonk-sub-move">⚡ ${moveText} • СИГМА ДОМИНАЦИЯ ⚡</div>
            <div id="cc-phonk-timer-bar"></div>
          </div>
          <button id="cc-phonk-skip-btn">✖ ОСТАНОВИТЬ ЭДИТ [ESC]</button>
        `;
        shadowRoot.appendChild(overlay);

        const skipBtn = overlay.querySelector("#cc-phonk-skip-btn");
        if (skipBtn) skipBtn.addEventListener("click", () => stopPhonkEdit(shadowRoot));

        const escHandler = (e) => {
          if (e.key === "Escape") {
            stopPhonkEdit(shadowRoot);
            window.removeEventListener("keydown", escHandler);
          }
        };
        window.addEventListener("keydown", escHandler);

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioContextClass();
          if (audioCtx.state === "suspended") audioCtx.resume();

          const masterGain = audioCtx.createGain();
          masterGain.gain.value = 0.48;
          const dist = audioCtx.createWaveShaper();
          dist.curve = createDistortionCurve(180);
          dist.oversample = "2x";
          dist.connect(masterGain);
          masterGain.connect(audioCtx.destination);

          const melody = [
            587.33, 587.33, 698.46, 587.33, 783.99, 739.99, 587.33, 523.25,
            587.33, 587.33, 880.00, 783.99, 739.99, 698.46, 587.33, 698.46
          ];
          const bassNotes = [73.42, 73.42, 87.31, 65.41];
          let step = 0;
          const startTime = Date.now();
          const cgWrap = document.querySelector(".cg-wrap, cg-board");
          const centerBanner = overlay.querySelector("#cc-phonk-center-banner");
          const mainTitle = overlay.querySelector("#cc-phonk-main-title");
          const timerBar = overlay.querySelector("#cc-phonk-timer-bar");

          const playStepNow = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= durationMs || !audioCtx) {
              stopPhonkEdit(shadowRoot);
              return;
            }
            const now = audioCtx.currentTime;
            const note = melody[step % melody.length];
            playPhonkCowbell(audioCtx, dist, note, now, 0.15);
            playHiHat(audioCtx, masterGain, now);

            if (step % 2 === 0) {
              const bFreq = bassNotes[Math.floor(step / 4) % bassNotes.length];
              play808BassKick(audioCtx, dist, bFreq, now, 0.32);
              if (cgWrap) {
                const angle = (step % 4 === 0 ? 1.2 : -1.2);
                const scale = (step % 8 === 0 ? 1.04 : 1.02);
                cgWrap.style.transition = "transform 0.08s cubic-bezier(0.22, 1, 0.36, 1), filter 0.08s ease";
                cgWrap.style.transform = `scale(${scale}) rotate(${angle}deg)`;
                cgWrap.style.filter = step % 8 === 0
                  ? "contrast(1.3) saturate(1.5) drop-shadow(0 0 28px rgba(0, 245, 212, 0.6))"
                  : "contrast(1.18) saturate(1.3) drop-shadow(0 0 18px rgba(255, 42, 133, 0.5))";
              }
              if (centerBanner) centerBanner.style.transform = "translate(-50%, -50%) scale(1.09)";
            } else {
              if (cgWrap) cgWrap.style.transform = "scale(1.0) rotate(0deg)";
              if (centerBanner) centerBanner.style.transform = "translate(-50%, -50%) scale(1.0)";
            }
            if (step % 8 === 0 && mainTitle) {
              mainTitle.textContent = PHONK_CAPTIONS[Math.floor(step / 8) % PHONK_CAPTIONS.length];
            }
            if (timerBar) {
              timerBar.style.width = `${Math.max(0, 100 - (elapsed / durationMs) * 100)}%`;
            }
            step++;
          };

          playStepNow();
          activeBeatInterval = setInterval(playStepNow, 190);
        } catch (e) {}

        activeEditTimer = setTimeout(() => stopPhonkEdit(shadowRoot), durationMs);
      }

      function renderMateSpectacleByStyle(styleName, pm, pk) {
        const bannerY = Math.max(45, pk.y - 54);
        const bannerX = Math.max(125, Math.min(675, pk.x));
        if (styleName === "phonk_skull") {
          return `
            <circle cx="${pk.x}" cy="${pk.y}" r="30" fill="none" stroke="#00f5d4" style="animation: cc-mate-ring 0.85s ease-out infinite;" />
            <circle cx="${pk.x}" cy="${pk.y}" r="42" fill="none" stroke="#ff2a85" style="animation: cc-mate-ring 0.85s ease-out 0.25s infinite;" />
            <g style="animation: cc-mate-scream 0.75s ease-in-out infinite; transform-origin: ${pk.x}px ${pk.y}px;">
              <text x="${pk.x}" y="${pk.y + 12}" text-anchor="middle" font-size="42">💀</text>
              <text x="${pm.x + 30}" y="${pm.y - 24}" text-anchor="middle" font-size="30">💎</text>
            </g>
            <g style="animation: cc-marker-float 0.9s ease-in-out infinite;">
              <rect x="${bannerX - 118}" y="${bannerY - 22}" width="236" height="36" rx="10" fill="rgba(10, 12, 18, 0.96)" stroke="#00f5d4" stroke-width="3" />
              <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#00f5d4" font-family="monospace" font-weight="900" font-size="15.5">💀 MOGGED // МАТ #1 ⚡</text>
            </g>
          `;
        }
        return `
          <circle cx="${pm.x}" cy="${pm.y}" r="26" fill="none" stroke="#ffbe0b" style="animation: cc-mate-ring 1.1s ease-out infinite;" />
          <circle cx="${pk.x}" cy="${pk.y}" r="26" fill="none" stroke="#ff2a85" style="animation: cc-mate-ring 1.1s ease-out 0.35s infinite;" />
          <g style="animation: cc-marker-float 1s ease-in-out infinite;">
            <rect x="${bannerX - 108}" y="${bannerY - 22}" width="216" height="36" rx="10" fill="rgba(16, 12, 20, 0.96)" stroke="#ffbe0b" stroke-width="3" />
            <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#ffbe0b" font-family="-apple-system, sans-serif" font-weight="900" font-size="16">💀 МАТ В 1 ХОД! 😂</text>
          </g>
        `;
      }

      return { isBrilliantMove, isEditRunning, triggerBrilliantPhonkEdit, stopPhonkEdit, renderMateSpectacleByStyle };
    })();
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
    1: "🛡 Ур. 1: 100% Форсаж (Взятия / 1 ход)",
    2: "⚡ Ур. 2: Форсаж + Дебютная теория",
    3: "🎯 Ур. 3: Активный Блиц (PV Предсказание)",
    4: "🔥 Ур. 4: Ультра-Пулька (Тотальный Премув)"
  };

  const FILES = "abcdefgh";
  const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 920, k: 20000 };

  let currentElo = 2000;
  let currentStyle = "tal";
  let showArrows = true;
  let showEvalBar = true;
  let turnMode = "my";
  let forcedMyColor = "auto";

  let autoMoveEnabled = false;
  let autoMoveDelayMs = 350;
  let autoMoveJitterMs = 150;
  let autoMoveTriggerRate = 100;
  let useAverageMoveSometimes = true;
  let averageMoveFrequency = 25;
  let protectCriticalMoves = true;
  let autoClickMethod = "hybrid";

  let premoveEnabled = false;
  let premoveRiskLevel = 2;
  let premoveOpeningMode = "auto";
  let showPremoveArrows = true;

  let uiTheme = "minimal";
  let arrowStyle = "curved_neon";
  let arrowScale = 1.0;
  let arrowOpacity = 0.85;
  let enable3DPiecesShadow = true;
  let phonkEditEnabled = true;
  let mateStyle = "phonk_skull";
  let roflMode = true;
  let safeAntiBanGuard = false;
  let activeTab = "analyzer";

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
  let cachedMoves = { best: null, average: null, worst: null, boardKey: "" };
  let preparedLookahead = null; // 2-ходовое предвидение (Ожидаемый ход врага -> Наш премув)
  let openingBookDeviated = false;
  let currentRoast = null;

  let autoMoveTimer = null;
  let premoveTimer = null;
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

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function shutdownOrphanedScript() {
    extensionInvalidated = true;
    if (mainIntervalId) { clearInterval(mainIntervalId); mainIntervalId = null; }
    if (autoMoveTimer) { clearTimeout(autoMoveTimer); autoMoveTimer = null; }
    if (premoveTimer) { clearTimeout(premoveTimer); premoveTimer = null; }
    if (window.ChessFX && shadowRoot) {
      window.ChessFX.stopPhonkEdit(shadowRoot);
    }
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

    if (!enable3DPiecesShadow) {
      pageStyle.textContent = "";
      return;
    }

    pageStyle.textContent = `
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

  function loadSettings() {
    if (!isContextValid()) return;
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          [
            "elo", "style", "showArrows", "showEvalBar", "uiTheme",
            "arrowStyle", "arrowScale", "arrowOpacity", "enable3DPiecesShadow",
            "phonkEditEnabled", "mateStyle", "roflMode", "safeAntiBanGuard",
            "autoMoveEnabled", "autoMoveDelayMs", "autoMoveJitterMs", "autoMoveTriggerRate",
            "useAverageMoveSometimes", "averageMoveFrequency", "protectCriticalMoves", "autoClickMethod",
            "premoveEnabled", "premoveRiskLevel", "premoveOpeningMode", "showPremoveArrows"
          ],
          (res) => {
            if (!isContextValid() || !res) return;
            if (res.elo) currentElo = Number(res.elo);
            if (res.style) currentStyle = res.style;
            if (typeof res.showArrows === "boolean") showArrows = res.showArrows;
            if (typeof res.showEvalBar === "boolean") showEvalBar = res.showEvalBar;
            if (res.uiTheme) uiTheme = res.uiTheme;
            if (res.arrowStyle) arrowStyle = res.arrowStyle;
            if (res.arrowScale) arrowScale = Number(res.arrowScale);
            if (res.arrowOpacity) arrowOpacity = Number(res.arrowOpacity);
            if (typeof res.enable3DPiecesShadow === "boolean") enable3DPiecesShadow = res.enable3DPiecesShadow;
            if (typeof res.phonkEditEnabled === "boolean") phonkEditEnabled = res.phonkEditEnabled;
            if (res.mateStyle) mateStyle = res.mateStyle;
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

            if (typeof res.premoveEnabled === "boolean") premoveEnabled = res.premoveEnabled;
            if (res.premoveRiskLevel !== undefined) premoveRiskLevel = Number(res.premoveRiskLevel);
            if (res.premoveOpeningMode !== undefined) premoveOpeningMode = res.premoveOpeningMode;
            if (typeof res.showPremoveArrows === "boolean") showPremoveArrows = res.showPremoveArrows;

            applySafeBoardDepth();
            updateUIValues();
            forceRecalculate();
          }
        );

        chrome.storage.onChanged.addListener((changes) => {
          if (!isContextValid()) {
            shutdownOrphanedScript();
            return;
          }
          if (changes.elo) currentElo = Number(changes.elo.newValue);
          if (changes.style) {
            currentStyle = changes.style.newValue;
            forceRecalculate();
          }
          if (changes.showArrows) showArrows = Boolean(changes.showArrows.newValue);
          if (changes.showEvalBar) showEvalBar = Boolean(changes.showEvalBar.newValue);
          if (changes.uiTheme) uiTheme = changes.uiTheme.newValue;
          if (changes.arrowStyle) arrowStyle = changes.arrowStyle.newValue;
          if (changes.arrowScale) arrowScale = Number(changes.arrowScale.newValue);
          if (changes.arrowOpacity) arrowOpacity = Number(changes.arrowOpacity.newValue);
          if (changes.enable3DPiecesShadow) {
            enable3DPiecesShadow = Boolean(changes.enable3DPiecesShadow.newValue);
            applySafeBoardDepth();
          }
          if (changes.phonkEditEnabled) phonkEditEnabled = Boolean(changes.phonkEditEnabled.newValue);
          if (changes.mateStyle) mateStyle = changes.mateStyle.newValue;
          if (changes.roflMode) roflMode = Boolean(changes.roflMode.newValue);
          if (changes.safeAntiBanGuard) safeAntiBanGuard = Boolean(changes.safeAntiBanGuard.newValue);
          updateUIValues();
          renderArrowsOverlay(captureBoardState(true), cachedMoves);
        });
      }
    } catch (e) {
      shutdownOrphanedScript();
    }
  }

  function buildOpeningOptionsHTML() {
    let html = `
      <option value="auto">🤖 Авто-распознавание дебюта по базе (36+ линий)</option>
      <option value="off">⛔ Без книжных премувов (только тактика/форсаж)</option>
    `;
    if (window.ChessOpenings && Array.isArray(window.ChessOpenings.database)) {
      window.ChessOpenings.database.forEach((op, idx) => {
        html += `<option value="db_${idx}">${op.name}</option>`;
      });
    }
    return html;
  }

  function updateUIValues() {
    const panel = $("chesscoach-panel");
    if (!panel) return;

    const allThemes = [
      "theme-minimal", "theme-cyberpunk", "theme-aurora", "theme-hologram",
      "theme-crimson", "theme-gold", "theme-matrix", "theme-titanium", "theme-obsidian"
    ];
    allThemes.forEach((cls) => panel.classList.remove(cls));
    panel.classList.add(`theme-${uiTheme}`);

    if ($("cc-elo-slider")) $("cc-elo-slider").value = currentElo;
    if ($("cc-elo-val")) $("cc-elo-val").textContent = `${currentElo} ELO`;
    if ($("cc-elo-badge")) $("cc-elo-badge").textContent = `${currentElo} ELO`;

    const styleLabel = ALL_STYLE_NAMES[currentStyle] || "✦ Таль";
    const isBrilliant = window.ChessFX && cachedMoves.best && window.ChessFX.isBrilliantMove(cachedMoves.best);
    if ($("cc-best-title")) {
      $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД • ${styleLabel}${isBrilliant ? '<span class="cc-brilliant-badge">💎 БРИЛЛИАНТОВЫЙ ХОД !!</span>' : ""}`;
    }
    if ($("cc-active-style-stat")) {
      $("cc-active-style-stat").textContent = styleLabel.replace(/^[^\s]+\s/, "");
    }

    if ($("cc-color-pill")) {
      const labels = { auto: "◈ АВТО", w: "⚪ БЕЛЫЕ", b: "⚫ ЧЕРНЫЕ" };
      $("cc-color-pill").textContent = labels[forcedMyColor] || "◈ АВТО";
    }

    const autoText = autoMoveEnabled
      ? (premoveEnabled ? "🤖 АВТО v2 + ПРЕМУВ: ВКЛ" : "🤖 АВТОХОД: ВКЛ")
      : "🤖 АВТОХОД: ВЫКЛ";
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

    if ($("cc-premove-chk")) $("cc-premove-chk").checked = premoveEnabled;
    if ($("cc-premove-risk-slider")) $("cc-premove-risk-slider").value = premoveRiskLevel;
    if ($("cc-premove-risk-val")) {
      $("cc-premove-risk-val").textContent = PREMOVE_RISK_LABELS[premoveRiskLevel] || PREMOVE_RISK_LABELS[2];
    }
    setSelectSafe($("cc-premove-opening-select"), premoveOpeningMode, "auto");
    if ($("cc-premove-arrows-chk")) $("cc-premove-arrows-chk").checked = showPremoveArrows;

    if ($("cc-auto-avg-chk")) $("cc-auto-avg-chk").checked = useAverageMoveSometimes;
    if ($("cc-auto-avg-freq-slider")) $("cc-auto-avg-freq-slider").value = averageMoveFrequency;
    if ($("cc-auto-avg-freq-val")) $("cc-auto-avg-freq-val").textContent = `${averageMoveFrequency}%`;
    if ($("cc-auto-protect-chk")) $("cc-auto-protect-chk").checked = protectCriticalMoves;
    setSelectSafe($("cc-auto-method-select"), autoClickMethod, "hybrid");

    setSelectSafe($("cc-vis-theme"), uiTheme, "minimal");
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
            <div class="cc-mini-stat" style="opacity:0.65;">
              <span>СКРЫТЬ</span>
              <span>[INS]</span>
            </div>
          </div>
        </div>

        <div class="cc-main-view">
          <div class="cc-tab-pane active" id="cc-pane-analyzer">
            <div id="cc-peer-detector-banner" style="display:none; background:linear-gradient(135deg, rgba(0,245,212,0.20), rgba(199,125,255,0.24)); border:1.5px solid #00f5d4; border-radius:12px; padding:9px 12px; color:#fff; box-shadow:0 0 20px rgba(0,245,212,0.28);">
              <div id="cc-peer-detector-title" style="font-size:11.5px; font-weight:900; color:#00f5d4; display:flex; justify-content:space-between; align-items:center;">
                <span>👁️ РАДАР СВОИХ: ОБНАРУЖЕН CHESSCOACH!</span>
                <span style="background:rgba(0,0,0,0.45); padding:1px 6px; border-radius:4px; font-family:monospace;">⚡ HVH</span>
              </div>
              <div id="cc-peer-detector-text" style="font-size:11.5px; color:#f1f5f9; margin-top:3px; font-weight:600; line-height:1.35;">
                У вашего соперника установлено это же расширение!
              </div>
            </div>

            <div id="cc-enemy-turn-standby">
              <div class="cc-standby-icon">🔮</div>
              <div class="cc-standby-title" id="cc-standby-title">Ход соперника...</div>
              <div class="cc-standby-sub" id="cc-standby-sub">
                Старые стрелки мгновенно очищены. Двухходовой прогноз готов к ответу за 0 мс!
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

              <div class="cc-move-card" id="cc-best-card" style="border-left-color:#00f5d4;">
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

          <div class="cc-tab-pane" id="cc-pane-automove">
            <div class="cc-auto-status-box">
              <span>Статус Автохода v2:</span>
              <strong id="cc-auto-live-status" style="color:#00f5d4;">Готов к работе</strong>
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #c77dff;">
              <div class="cc-section-title" style="color:#c77dff;">
                <span>⚡ МГНОВЕННЫЕ ПРЕМУВЫ (2-MOVE LOOKAHEAD)</span>
                <span id="cc-premove-book-status" style="font-size:10px; color:#00f5d4;">📖 ТЕОРИЯ АКТИВНА</span>
              </div>

              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🔮 Предсказывать на 2 хода и ставить премув</span>
                <input type="checkbox" id="cc-premove-chk">
              </div>

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Сила и риск премувов:</span>
                <strong id="cc-premove-risk-val" style="color:#c77dff; font-size:11px;">⚡ Ур. 2: Форсаж + Дебют</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-premove-risk-slider" min="1" max="4" step="1" value="2" style="accent-color:#c77dff;">

              <div class="cc-control-row" style="margin-top:7px;">
                <span>Дебютная линия премувов:</span>
              </div>
              <select class="cc-select" id="cc-premove-opening-select">
                ${buildOpeningOptionsHTML()}
              </select>

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Показывать пунктирные стрелки премува в ход врага</span>
                <input type="checkbox" id="cc-premove-arrows-chk" checked>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span style="font-weight:800; color:#fff;">🤖 Включить автоматический ход</span>
                <input type="checkbox" id="cc-auto-master-chk">
              </div>

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Базовая скорость / задержка хода:</span>
                <strong id="cc-auto-delay-val" style="color:var(--cc-accent);">0.35 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-delay-slider" min="40" max="4000" step="40" value="350">

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Случайный разброс времени (Humanizer):</span>
                <strong id="cc-auto-jitter-val" style="color:var(--cc-accent);">±0.15 сек</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-jitter-slider" min="0" max="2000" step="50" value="150">

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Частота срабатывания автохода:</span>
                <strong id="cc-auto-rate-val" style="color:var(--cc-accent);">100% ходов</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-rate-slider" min="10" max="100" step="10" value="100">
            </div>

            <div class="cc-glass-card" style="border-left: 3.5px solid #ffbe0b;">
              <div class="cc-Switch-row" style="padding-top:0;">
                <span>Иногда делать Средний ход (2-я линия)</span>
                <input type="checkbox" id="cc-auto-avg-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:6px;">
                <span>Шанс Среднего хода:</span>
                <strong id="cc-auto-avg-freq-val" style="color:#ffbe0b;">25%</strong>
              </div>
              <input type="range" class="cc-slider" id="cc-auto-avg-freq-slider" min="0" max="100" step="5" value="25" style="accent-color:#ffbe0b;">

              <div class="cc-Switch-row" style="margin-top:4px;">
                <span>Страховка: только Лучший ход при Мате в 1 и угрозах</span>
                <input type="checkbox" id="cc-auto-protect-chk" checked>
              </div>

              <div class="cc-control-row" style="margin-top:6px; margin-bottom:0;">
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
              <button class="cc-btn" id="cc-auto-test-avg" style="border-color:#ffbe0b; color:#ffbe0b;">❖ Сходить Средним</button>
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
                  <span>⚙ Stockfish 3000 Cloud</span><small>ЧИСТЫЙ МАКСИМУМ</small>
                </button>
              </div>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>⚙ РЕЖИМ РАБОТЫ</span></div>
              <div class="cc-control-row" style="margin-bottom:8px;">
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
            <div class="cc-glass-card">
              <div class="cc-section-title"><span>✦ ТЕМА МЕНЮ (9 СТИЛЕЙ LIQUID GLASS)</span></div>
              <select class="cc-select" id="cc-vis-theme">
                <option value="minimal">⚪ Pure Minimal (Чистый минимализм)</option>
                <option value="cyberpunk">🌌 Liquid Cyan Wave (Неоновая волна)</option>
                <option value="aurora">🌌 Aurora 3D Glass (Северное сияние)</option>
                <option value="hologram">🔮 Hologram Violet (Голограмма)</option>
                <option value="crimson">🔥 Crimson Rose (Агрессивный рубин)</option>
                <option value="gold">👑 Royal Gold (Королевское золото)</option>
                <option value="matrix">🧪 Matrix Toxic (Кибер-Матрица)</option>
                <option value="titanium">❄️ Vision Pro Titanium (Матовый титан)</option>
                <option value="obsidian">🌑 Obsidian Stealth (Темный обсидиан)</option>
              </select>
            </div>

            <div class="cc-glass-card">
              <div class="cc-section-title"><span>◈ КАСТОМИЗАЦИЯ СТРЕЛОК И МАТА</span></div>
              <div class="cc-control-row" style="margin-bottom:8px;">
                <span>Форма стрелок:</span>
                <select class="cc-select" id="cc-vis-arrow-style" style="width:225px;">
                  <option value="curved_neon">🌈 Плавная дуга с потоком</option>
                  <option value="tube_3d">🧊 3D Объемная трубка с тенью</option>
                  <option value="plasma">⚡ Плазменная молния-зигзаг</option>
                  <option value="sniper_3d">🎯 3D Снайперский радар-прицел</option>
                  <option value="dna_wave">🧬 Двойная кибер-волна ДНК</option>
                  <option value="chroma_rgb">🌈 Chroma RGB Перелив</option>
                  <option value="laser">⚡ Прямой кибер-лазер</option>
                  <option value="classic">♟️ Классическая прямая</option>
                  <option value="dotted">✨ Тактический пунктир</option>
                </select>
              </div>

              <div class="cc-control-row" style="margin-bottom:8px;">
                <span>Стиль «Мата в 1 ход»:</span>
                <select class="cc-select" id="cc-vis-mate-style" style="width:225px;">
                  <option value="phonk_skull">💀 Phonk Skull Mogging</option>
                  <option value="orbital_laser">🛸 Орбитальный Кибер-Лазер</option>
                  <option value="royal_exec">👑 Королевский Приговор</option>
                  <option value="rofl_classic">😂 Классический Рофл</option>
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

            <div class="cc-glass-card" style="border-left: 3.5px solid #ff2a85;">
              <div class="cc-section-title" style="color:#ff4d94;">
                <span>💎 DRIFT PHONK ЭДИТ И ЭФФЕКТЫ</span>
              </div>
              <div class="cc-Switch-row">
                <span>🔥 Эдит Бриллиантовому Ходу (15 сек Phonk + Mogging)</span>
                <input type="checkbox" id="cc-vis-phonk-chk" checked>
              </div>
              <div class="cc-Switch-row">
                <span>Показывать стрелки и значки на доске</span>
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
              <button class="cc-btn cc-btn-primary" id="cc-test-phonk-btn" style="width:100%; margin-top:8px;">
                🔥 ТЕСТ ФОНК-ЭДИТА (15 СЕК)
              </button>
            </div>
          </div>

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

    const toggleAutoMoveMaster = (newState) => {
      autoMoveEnabled = newState;
      saveSetting({ autoMoveEnabled });
      updateUIValues();
      resetTurnDecision();
      if (autoMoveEnabled) {
        setAutoStatusText("Автоход v2 включен — анализ позиции...", "#00f5d4");
        scheduleAutoMoveIfNeeded(false);
      } else {
        setAutoStatusText("Автоход выключен", "#94a3b8");
      }
    };

    $("cc-toggle-auto").addEventListener("click", () => toggleAutoMoveMaster(!autoMoveEnabled));
    $("cc-auto-master-chk").addEventListener("change", (e) => toggleAutoMoveMaster(e.target.checked));

    $("cc-premove-chk").addEventListener("change", (e) => {
      premoveEnabled = e.target.checked;
      saveSetting({ premoveEnabled });
      updateUIValues();
      committedEnemyBoardKey = "";
      runCycle(true);
    });

    $("cc-premove-risk-slider").addEventListener("input", (e) => {
      premoveRiskLevel = Number(e.target.value);
      updateUIValues();
      saveSetting({ premoveRiskLevel });
      committedEnemyBoardKey = "";
      runCycle(true);
    });

    $("cc-premove-opening-select").addEventListener("change", (e) => {
      premoveOpeningMode = e.target.value;
      openingBookDeviated = false;
      saveSetting({ premoveOpeningMode });
      updateUIValues();
      committedEnemyBoardKey = "";
      runCycle(true);
    });

    $("cc-premove-arrows-chk").addEventListener("change", (e) => {
      showPremoveArrows = e.target.checked;
      saveSetting({ showPremoveArrows });
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
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
        executeMoveOnBoard(cachedMoves.best, state, true, false);
      }
    });

    $("cc-auto-test-best").addEventListener("click", () => {
      const state = captureBoardState(true);
      if (state && cachedMoves.best) {
        setAutoStatusText(`Лучший ход: ${cachedMoves.best.from}→${cachedMoves.best.to}`, "#00f5d4");
        executeMoveOnBoard(cachedMoves.best, state, true, false);
      }
    });

    $("cc-auto-test-avg").addEventListener("click", () => {
      const state = captureBoardState(true);
      const move = cachedMoves.average || cachedMoves.best;
      if (state && move) {
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
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
    });

    $("cc-vis-mate-style").addEventListener("change", (e) => {
      mateStyle = e.target.value;
      saveSetting({ mateStyle });
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
      renderArrowsOverlay(captureBoardState(true), cachedMoves);
    });

    $("cc-vis-eval-chk").addEventListener("change", (e) => {
      showEvalBar = e.target.checked;
      saveSetting({ showEvalBar });
      const st = captureBoardState(true);
      renderEvalBar(st, cachedMoves.best?.whitePerspectiveEval || 0);
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
      });
    });

    $("cc-clear-db").addEventListener("click", () => {
      safeSendMessage({ type: "CLEAR_MEMORY" }, () => {
        $("cc-memory-stat").textContent = "0 ПОЗ.";
        $("cc-misc-db-summary").textContent = "Выучено позиций в памяти: 0";
      });
    });

    $("cc-open-studio-btn").addEventListener("click", () => {
      if (isContextValid() && chrome?.runtime?.getURL) {
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

  // Чтение наших часов для автоматического Турбо-режима в цейтноте пульки (< 12 секунд)
  function getMyRemainingSeconds() {
    const clockEl = document.querySelector(".rclock-bottom .time");
    if (!clockEl) return 999;
    const text = (clockEl.innerText || "").trim();
    const parts = text.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return 999;
  }

  // === МГНОВЕННЫЙ (0.2 МС) ЛОКАЛЬНЫЙ ГЕНЕРАТОР 2-ХОДОВОГО ПРОГНОЗА И ПРЕМУВА БЕЗ БЛОКИРОВКИ SERVICE WORKER ===
  function getOpeningBookPremovePlan() {
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
        badgeEl.textContent = "⚠️ ВНЕ КНИГИ (ТАКТИКА)";
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
      candidateOpenings = window.ChessOpenings.database;
    }

    for (const op of candidateOpenings) {
      const opMoves = op.moves.trim().split(/\s+/);
      if (plyCount + 2 > opMoves.length) continue;

      const prefixStr = opMoves.slice(0, plyCount).join(" ");
      if (plyCount === 0 || prefixStr === historyStr) {
        if (badgeEl) {
          badgeEl.textContent = `📖 ПО КНИГЕ: ${op.name.slice(0, 18)}`;
          badgeEl.style.color = "#00f5d4";
        }
        return {
          bookOpeningName: op.name,
          bookEnemyUci: opMoves[plyCount],
          bookMyReplyUci: opMoves[plyCount + 1]
        };
      }
    }

    if (plyCount > 0) {
      openingBookDeviated = true;
      if (badgeEl) {
        badgeEl.textContent = "⚠️ ВНЕ КНИГИ (ТАКТИКА)";
        badgeEl.style.color = "#ffbe0b";
      }
    }
    return null;
  }

  // Извлекает цепочку ходов из pvLine ("e2→e4 ➔ e7→e5 ➔ g1→f3")
  function parsePvChainMoves(pvLine) {
    if (!pvLine) return [];
    return pvLine.split("➔").map((s) => {
      const clean = s.trim();
      const m = clean.match(/([a-h][1-8])→([a-h][1-8])(?:=([QNBR]))?/i);
      if (!m) return null;
      return {
        from: m[1].toLowerCase(),
        to: m[2].toLowerCase(),
        promo: m[3] ? m[3].toLowerCase() : null,
        uci: `${m[1].toLowerCase()}${m[2].toLowerCase()}${m[3] ? m[3].toLowerCase() : ""}`
      };
    }).filter(Boolean);
  }

  // Проверяет на локальной матрице 8x8, может ли соперник побить на клетке targetSq, и чем мы можем ответить
  function findRecaptureOnSquare(grid, myColor, targetSq) {
    if (!grid || !targetSq || targetSq.length < 2) return null;
    const tc = FILES.indexOf(targetSq[0]);
    const tr = 8 - parseInt(targetSq[1], 10);
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return null;

    const isMyPiece = (p) => p && (myColor === "w" ? p === p.toUpperCase() : p === p.toLowerCase());
    const candidates = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = grid[r][c];
        if (!isMyPiece(p) || (r === tr && c === tc)) continue;
        const type = p.toLowerCase();
        const dr = tr - r;
        const dc = tc - c;

        let canReach = false;
        if (type === "p") {
          const pawnDir = myColor === "w" ? -1 : 1;
          if (dr === pawnDir && Math.abs(dc) === 1) canReach = true;
        } else if (type === "n") {
          if ((Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2)) canReach = true;
        } else if (type === "k") {
          if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) canReach = true;
        } else {
          const isDiag = Math.abs(dr) === Math.abs(dc) && dr !== 0;
          const isOrtho = (dr === 0 || dc === 0) && (dr !== 0 || dc !== 0);
          if ((type === "b" && isDiag) || (type === "r" && isOrtho) || (type === "q" && (isDiag || isOrtho))) {
            const stepR = Math.sign(dr);
            const stepC = Math.sign(dc);
            let cr = r + stepR, cc = c + stepC, clear = true;
            while (cr !== tr || cc !== tc) {
              if (grid[cr][cc]) { clear = false; break; }
              cr += stepR;
              cc += stepC;
            }
            if (clear) canReach = true;
          }
        }

        if (canReach) {
          candidates.push({
            from: `${FILES[c]}${8 - r}`,
            to: targetSq,
            piece: type,
            val: PIECE_VALUES[type] || 100
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.val - b.val);
    return candidates[0];
  }

  // Мгновенно (за 0.1 мс) строит план премува на ход соперника без обращения к Service Worker
  function computeInstantPremovePlan(state) {
    const bookPlan = getOpeningBookPremovePlan();
    if (bookPlan && bookPlan.bookEnemyUci && bookPlan.bookMyReplyUci) {
      const bFrom = bookPlan.bookMyReplyUci.slice(0, 2);
      const bTo = bookPlan.bookMyReplyUci.slice(2, 4);
      const eFrom = bookPlan.bookEnemyUci.slice(0, 2);
      const eTo = bookPlan.bookEnemyUci.slice(2, 4);
      return {
        canPremove: true,
        confidence: 92,
        predictionType: "opening_book",
        reasonText: `📖 ДЕБЮТНЫЙ ПРЕМУВ: ${bookPlan.bookOpeningName}`,
        predictedEnemyMove: { from: eFrom, to: eTo, uci: bookPlan.bookEnemyUci },
        premove: { from: bFrom, to: bTo, uci: bookPlan.bookMyReplyUci, piece: "p" }
      };
    }

    // Проверяем 2-ходовую цепочку PV из нашего последнего расчета (Уже просчитана на 2 хода вперед!)
    if (preparedLookahead && preparedLookahead.premove && preparedLookahead.enemyReply) {
      return {
        canPremove: true,
        confidence: preparedLookahead.confidence || 78,
        predictionType: preparedLookahead.predictionType || "pv_lookahead",
        reasonText: preparedLookahead.reasonText,
        predictedEnemyMove: preparedLookahead.enemyReply,
        premove: preparedLookahead.premove
      };
    }

    // Если мы только что побили фигуру или поставили фигуру под размен — готовим мгновенный перебой (Recapture Premove)
    if (lastOurExecutedMove && lastOurExecutedMove.to && state.grid) {
      const recap = findRecaptureOnSquare(state.grid, state.myColor, lastOurExecutedMove.to);
      if (recap) {
        return {
          canPremove: true,
          confidence: lastOurExecutedMove.captured ? 95 : 74,
          predictionType: "recapture",
          reasonText: `⚔ АВТО-ПЕРЕБОЙ НА ${lastOurExecutedMove.to.toUpperCase()}`,
          predictedEnemyMove: { from: lastOurExecutedMove.to, to: lastOurExecutedMove.to },
          premove: recap
        };
      }
    }

    return { canPremove: false };
  }

  function shouldTriggerPremoveByRisk(premovePlan) {
    if (!premovePlan || !premovePlan.canPremove || !premovePlan.premove) return false;
    const { confidence, predictionType } = premovePlan;
    const myRemainingSecs = getMyRemainingSeconds();
    const effectiveRisk = myRemainingSecs <= 12 ? Math.min(4, premoveRiskLevel + 1) : premoveRiskLevel;

    if (effectiveRisk === 1) {
      return confidence >= 94 || (predictionType === "recapture" && confidence >= 92);
    }
    if (effectiveRisk === 2) {
      return predictionType === "opening_book" || confidence >= 82;
    }
    if (effectiveRisk === 3) {
      return confidence >= 68;
    }
    return confidence >= 45;
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

  function scheduleAutoMoveIfNeeded(isInstantFromPrecalc = false) {
    if (!autoMoveEnabled || extensionInvalidated) return;
    if (isExecutingMove || Date.now() < moveCooldownUntil) return;
    if (autoMoveTimer) return;

    const state = captureBoardState(true);
    if (!state || state.actualTurn !== state.myColor) return;
    if (!cachedMoves || !cachedMoves.best || cachedMoves.boardKey !== state.boardKey) return;

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

      const mySecs = getMyRemainingSeconds();
      const isBulletPanic = mySecs <= 12;

      let totalDelay = 45;
      if (!isBulletPanic) {
        const jitter = autoMoveJitterMs > 0 ? Math.round((Math.random() * 2 - 1) * autoMoveJitterMs) : 0;
        const baseDelay = isInstantFromPrecalc ? Math.max(40, Math.round(autoMoveDelayMs * 0.55)) : autoMoveDelayMs;
        totalDelay = Math.max(40, baseDelay + jitter);
      }

      currentTurnDecision = {
        boardKey: state.boardKey,
        decided: true,
        skip: false,
        move: picked.move,
        typeLabel: isBulletPanic ? "⚡ ТУРБО (<12с)" : picked.typeLabel,
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
    const delayToWait = currentTurnDecision.attempts === 0 ? currentTurnDecision.totalDelay : 350;

    setAutoStatusText(
      `Ход через ${(delayToWait / 1000).toFixed(2)}с: ${mv.from}→${mv.to} [${currentTurnDecision.typeLabel}]`,
      isAvg ? "#ffbe0b" : "#00f5d4"
    );

    const expectedBoardKey = state.boardKey;

    autoMoveTimer = setTimeout(() => {
      autoMoveTimer = null;
      if (!autoMoveEnabled || extensionInvalidated) return;

      const fresh = captureBoardState(true);
      if (!fresh || fresh.actualTurn !== fresh.myColor || fresh.boardKey !== expectedBoardKey) {
        return;
      }

      currentTurnDecision.attempts++;
      const moveNow = currentTurnDecision.move || cachedMoves.best;
      if (!moveNow) return;

      executeMoveOnBoard(moveNow, fresh, false, false);
    }, delayToWait);
  }

  function executeMoveOnBoard(moveObj, state, manualClick = false, isPremoveAction = false) {
    if (!moveObj || !moveObj.from || !moveObj.to || !state) return;

    if (!manualClick && safeAntiBanGuard && isRatedGameAgainstHuman()) {
      setAutoStatusText("Блок Анти-Бана в Rated игре!", "#ff2a85");
      return;
    }

    const fromSq = moveObj.from;
    const toSq = moveObj.to;
    const isPromotion = moveObj.piece === "p" && (toSq[1] === "8" || toSq[1] === "1");
    const promoPiece = isPromotion ? (moveObj.promo || "q") : null;

    if (!isPremoveAction) {
      lastOurExecutedMove = moveObj;
      // Мгновенно убираем старые стрелки в момент отправки нашего хода!
      hideArrows();
    }

    isExecutingMove = true;
    moveCooldownUntil = Date.now() + (isPremoveAction ? 180 : 240);
    const beforeKey = state.boardKey;

    setAutoStatusText(
      isPremoveAction ? `🔮 ПРЕМУВ: ${fromSq} → ${toSq}` : `Отправка хода: ${fromSq} → ${toSq}...`,
      isPremoveAction ? "#c77dff" : "#00f5d4"
    );

    if (autoClickMethod === "hybrid" && !isPremoveAction) {
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
      if (!isPremoveAction) {
        const checkAfterWs = captureBoardState(true);
        if (checkAfterWs && checkAfterWs.boardKey !== beforeKey) {
          isExecutingMove = false;
          setAutoStatusText(`Сделан ход (WS): ${fromSq} → ${toSq}`, "#00f5d4");
          triggerDebouncedCycle();
          return;
        }
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
        setAutoStatusText(
          isPremoveAction ? `🔮 Премув выставлен: ${fromSq} → ${toSq}` : `Сделан ход: ${fromSq} → ${toSq}`,
          isPremoveAction ? "#c77dff" : "#00f5d4"
        );
        triggerDebouncedCycle();
      });
    }, (autoClickMethod === "hybrid" && !isPremoveAction) ? 55 : 8);
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
        }, 20);
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
          }, 18);
        }, 22);
      }
    }, 18);
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

  function detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation) {
    const myColor = isBlackOrientation ? "b" : "w";
    const enemyColor = myColor === "w" ? "b" : "w";

    const moveNodes = Array.from(document.querySelectorAll("l4x kwdb, rm6 kwdb, .tview2 move"));
    if (moveNodes.length > 0) {
      const activeIdx = moveNodes.findIndex(
        (el) => el.classList.contains("a1t") || el.classList.contains("active")
      );
      if (activeIdx !== -1) {
        return (activeIdx + 1) % 2 === 0 ? "w" : "b";
      }
      if (!cgBoard.querySelector("square.last-move")) {
        return "w";
      }
      return moveNodes.length % 2 === 0 ? "w" : "b";
    }

    if (document.querySelector(".rclock-bottom.rclock-turn, .rclock-bottom.running")) return myColor;
    if (document.querySelector(".rclock-top.rclock-turn, .rclock-top.running")) return enemyColor;

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
          if (isCol(pOld) && !pNew) {
            if (!fromSq || pOld.toLowerCase() === "k") {
              fromSq = `${FILES[c]}${8 - r}`;
              oldPiece = pOld.toLowerCase();
            }
          }
          if (isCol(pNew) && pOld !== pNew) {
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
      castlingRights = { K: true, Q: true, k: true, q: true };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      lastRealEnemyMove = null;
      lastOurExecutedMove = null;
      preparedLookahead = null;
      sessionMoveHistory = [];
      uciHistoryList = [];
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

    if (boardPart === startFenBoard && !prevGridState) {
      castlingRights = { K: true, Q: true, k: true, q: true };
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
      currentEpSquare = "-";
      openingBookDeviated = false;
      return;
    }

    if (grid[7][4] !== "K") { castlingRights.K = false; castlingRights.Q = false; }
    if (grid[7][7] !== "R") castlingRights.K = false;
    if (grid[7][0] !== "R") castlingRights.Q = false;

    if (grid[0][4] !== "k") { castlingRights.k = false; castlingRights.q = false; }
    if (grid[0][7] !== "r") castlingRights.k = false;
    if (grid[0][0] !== "r") castlingRights.q = false;

    if (prevGridState) {
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
        currentEpSquare = epFound;

        const realMove = detectRealMoveBetweenGrids(prevGridState, grid);
        if (realMove && realMove.uci) {
          if (uciHistoryList[uciHistoryList.length - 1] !== realMove.uci) {
            uciHistoryList.push(realMove.uci);
          }
          if (realMove.color === myColor && prevBoardPartForHistory) {
            const prevFenKey = `${prevBoardPartForHistory} ${myColor}`;
            sessionMoveHistory.push({ fenKey: prevFenKey, uci: realMove.uci });
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
        prevGridState = grid.map(r => r.slice());
        prevBoardPartForHistory = boardPart;
      }
    } else {
      prevGridState = grid.map(r => r.slice());
      prevBoardPartForHistory = boardPart;
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

  function captureBoardState(ignoreAnim = false) {
    const cgBoard = document.querySelector(".main-board cg-board") || document.querySelector("cg-board");
    if (!cgBoard) return null;

    if (!ignoreAnim && cgBoard.querySelector("piece.dragging")) {
      return { animating: true };
    }

    // Если фигура в процессе 150мс слайда (piece.anim), проверяем часы: если уже ход врага, сразу гасим старые стрелки!
    if (!ignoreAnim && cgBoard.querySelector("piece.anim")) {
      if (document.querySelector(".rclock-top.rclock-turn, .rclock-top.running")) {
        hideArrows();
      }
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

    const boardPart = fenRows.join("/");
    updateCastlingEpAndRealHistory(grid, boardPart, myColor);

    const actualTurn = detectActualTurnOnBoard(cgBoard, boardRect, grid, isBlackOrientation);

    let sideToAnalyze = actualTurn;
    if (turnMode === "w") sideToAnalyze = "w";
    else if (turnMode === "b") sideToAnalyze = "b";

    const castlingStr = getCastlingString();
    return {
      animating: false,
      grid,
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

  function renderPremovePreviewOverlay(state, premovePlan) {
    let svg = $("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      getShadow().appendChild(svg);
    }

    if (!showArrows || !showPremoveArrows || !state || !state.boardRect || !premovePlan || !premovePlan.premove) {
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

    const enemyMove = premovePlan.predictedEnemyMove;
    const ourPremove = premovePlan.premove;
    const pEnemy1 = (enemyMove && enemyMove.from !== enemyMove.to) ? sqToXY(enemyMove.from) : null;
    const pEnemy2 = (enemyMove && enemyMove.from !== enemyMove.to) ? sqToXY(enemyMove.to) : null;
    const pOur1 = sqToXY(ourPremove.from);
    const pOur2 = sqToXY(ourPremove.to);

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

    if (turnMode === "my" && state && state.actualTurn !== state.myColor) {
      hideArrows();
      return;
    }

    if (!showArrows || !state || !state.boardRect || !res || !res.best) {
      svg.innerHTML = "";
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
    svg.style.animation = arrowStyle === "chroma_rgb" ? "cc-chroma-shift 2.5s linear infinite" : "none";

    const isBlack = state.isBlackOrientation;
    const sqToXY = (sq) => {
      const file = FILES.indexOf(sq[0]);
      const rank = parseInt(sq[1], 10) - 1;
      const col = isBlack ? 7 - file : file;
      const row = isBlack ? rank : 7 - rank;
      return { x: col * 100 + 50, y: row * 100 + 50 };
    };

    const drawSingleArrow = (m, gradId, solidColor, markerId, curveOffset, baseOp, isBest = false) => {
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

      const width = (isBest ? 14 : 10.5) * arrowScale;
      const op = Math.min(1, baseOp * (arrowOpacity / 0.85));

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
    if (best.isMateInOne) {
      markersHTML += drawMateInOneSpectacle(best.to, enemyKingSquare);
    } else {
      if (hangingSquare) markersHTML += drawHudMarkerOnSquare(hangingSquare, "!", "#ff2a85");
      if (window.ChessFX && window.ChessFX.isBrilliantMove(best)) {
        markersHTML += drawHudMarkerOnSquare(best.to, "💎", "#00f5d4");
      } else if (best && best.isSacrifice) {
        markersHTML += drawHudMarkerOnSquare(best.to, "⚡", "#ff4d94");
      } else if (best && best.isFork) {
        markersHTML += drawHudMarkerOnSquare(best.to, "⚔", "#00f5d4");
      } else if (best && best.isPin) {
        markersHTML += drawHudMarkerOnSquare(best.to, "◈", "#00bbf9");
      }

      if ((roflMode || currentStyle === "mogging") && currentRoast && lastOpponentMove && lastOpponentMove.to) {
        markersHTML += drawHudMarkerOnSquare(lastOpponentMove.to, currentRoast.emoji, "#ffbe0b", true);
      }
    }

    const bestGrad = best.isMateInOne ? "grad-mate" : "grad-best";
    const bestGlow = best.isMateInOne ? "#ffbe0b" : "#00f5d4";

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
      ${!best.isMateInOne ? drawSingleArrow(worst, "grad-worst", "#ff2a85", "m-worst", worstCurve, 0.45, false) : ""}
      ${!best.isMateInOne ? drawSingleArrow(average, "grad-avg", "#ffbe0b", "m-avg", avgCurve, 0.58, false) : ""}
      ${drawSingleArrow(best, bestGrad, bestGlow, "m-best", 0, 0.90, true)}
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

  function applyAnalysisResult(state, res, isDeepPass = false, prevBestUci = "") {
    if (!res || res.error) return;
    if (!isDeepPass && res.lastOpponentMove) {
      updateBehavioralCheatDetector(res);
    }
    cachedMoves = res;

    // Извлекаем 2-ходовой прогноз (Ответ врага -> Наш следующий премув) прямо из PV-линии!
    if (res.best && res.best.pvLine) {
      const pvChain = parsePvChainMoves(res.best.pvLine);
      if (pvChain.length >= 3) {
        preparedLookahead = {
          ourFirstMove: pvChain[0],
          enemyReply: pvChain[1],
          premove: {
            from: pvChain[2].from,
            to: pvChain[2].to,
            promo: pvChain[2].promo,
            uci: pvChain[2].uci,
            piece: "p"
          },
          confidence: res.best.fromCloud ? 88 : (res.best.givesCheck || res.best.captured ? 85 : 74),
          predictionType: res.best.fromCloud ? "cloud_pv" : "pv_lookahead",
          reasonText: `🔮 ПРОГНОЗ НА 2 ХОДА: Если ${pvChain[1].from}→${pvChain[1].to}, бьем ${pvChain[2].from}→${pvChain[2].to}`
        };
      }
    }

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
      const isBrilliant = Boolean(window.ChessFX && window.ChessFX.isBrilliantMove(res.best));
      const bestCard = $("cc-best-card");
      if (bestCard) {
        bestCard.classList.toggle("cc-brilliant-card", isBrilliant);
      }
      const styleLabel = ALL_STYLE_NAMES[currentStyle] || "✦ Таль";
      if ($("cc-best-title")) {
        $("cc-best-title").innerHTML = `✦ ЛУЧШИЙ ХОД • ${styleLabel}${isBrilliant ? '<span class="cc-brilliant-badge">💎 БРИЛЛИАНТОВЫЙ ХОД !!</span>' : ""}`;
      }

      if (!isDeepPass && isBrilliant && phonkEditEnabled && state.actualTurn === state.myColor && window.ChessFX) {
        window.ChessFX.triggerBrilliantPhonkEdit(getShadow(), res.best, state, 15000, false);
      }

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

      if (!isDeepPass && autoMoveEnabled && state.actualTurn === state.myColor) {
        scheduleAutoMoveIfNeeded(false);
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

  // Запускается в ход соперника за 0.1 мс (без тяжелых вызовов к Service Worker!)
  function handleEnemyTurnInstantPremove(state) {
    if (committedEnemyBoardKey === state.boardKey) return;
    committedEnemyBoardKey = state.boardKey;

    // 1. Всегда мгновенно очищаем старые стрелки нашего прошлого хода!
    hideArrows();

    const plan = computeInstantPremovePlan(state);
    const standbySub = $("cc-standby-sub");

    if (!plan || !plan.canPremove || !plan.premove) {
      if (standbySub) {
        standbySub.textContent = "Старые стрелки очищены. Как только соперник сходит — расчет за 12 мс!";
      }
      return;
    }

    if (standbySub) {
      standbySub.innerHTML = `
        <strong>${plan.reasonText}</strong><br>
        Заготовлен премув: <strong style="color:#c77dff;">${plan.premove.from} → ${plan.premove.to} (${plan.confidence}%)</strong>
      `;
    }

    if (showPremoveArrows) {
      renderPremovePreviewOverlay(state, plan);
    }

    if (autoMoveEnabled && premoveEnabled && lastPremoveSentBoardKey !== state.boardKey) {
      if (shouldTriggerPremoveByRisk(plan)) {
        lastPremoveSentBoardKey = state.boardKey;
        setAutoStatusText(
          `🔮 Мгновенный премув (${plan.confidence}%): ${plan.premove.from}→${plan.premove.to}`,
          "#c77dff"
        );
        clearTimeout(premoveTimer);
        premoveTimer = setTimeout(() => {
          const verifySt = captureBoardState(true);
          if (verifySt && verifySt.actualTurn !== verifySt.myColor && verifySt.boardKey === state.boardKey) {
            executeMoveOnBoard(plan.premove, verifySt, false, true);
          }
        }, 35);
      } else {
        setAutoStatusText(
          `Прогноз ${plan.premove.from}→${plan.premove.to} (${plan.confidence}% < порога Ур.${premoveRiskLevel})`,
          "#94a3b8"
        );
      }
    }
  }

  function runCycle(forceByButton = false) {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }

    ensurePanel();

    const state = captureBoardState(false);
    if (!state || state.animating) return;

    checkGameEndAndLearn(state.myColor);
    checkOpponentExtensionBeacon(state.myColor, false);

    const standbyBox = $("cc-enemy-turn-standby");
    const activeBox = $("cc-my-turn-active");
    const deepBadge = $("cc-deep-status");

    // === ФАЗА ХОДА СОПЕРНИКА: МГНОВЕННАЯ ОЧИСТКА СТРЕЛОК И 0.1 МС ПРЕМУВ ===
    if (!forceByButton && turnMode === "my" && state.actualTurn !== state.myColor) {
      resetTurnDecision();
      if (deepBadge) deepBadge.style.display = "none";
      if (standbyBox) {
        standbyBox.style.display = "flex";
        const mySideText = state.myColor === "w" ? "вы за Белых ⚪" : "вы за Черных ⚫";
        $("cc-standby-title").textContent = `Ход соперника (${mySideText})`;
      }
      if (activeBox) activeBox.style.display = "none";
      committedBoardKey = "";

      handleEnemyTurnInstantPremove(state);
      return;
    }

    if (standbyBox) standbyBox.style.display = "none";
    if (activeBox) activeBox.style.display = "flex";

    if (!forceByButton && state.boardKey === committedBoardKey) {
      if (autoMoveEnabled && state.actualTurn === state.myColor && !autoMoveTimer && !currentTurnDecision.skip) {
        scheduleAutoMoveIfNeeded(false);
      }
      return;
    }

    committedBoardKey = state.boardKey;
    committedEnemyBoardKey = "";
    resetTurnDecision();

    const myReqId = ++analysisRequestId;
    const sideText = state.sideToAnalyze === "w" ? "ХОД БЕЛЫХ ⚪" : "ХОД ЧЕРНЫХ ⚫";
    if ($("cc-turn-indicator")) $("cc-turn-indicator").textContent = sideText;

    // Если соперник сходил точно так, как мы предсказали в 2-ходовом плане — рисуем стрелку за 0 мс!
    if (
      preparedLookahead &&
      preparedLookahead.enemyReply &&
      preparedLookahead.premove &&
      lastRealEnemyMove &&
      lastRealEnemyMove.from === preparedLookahead.enemyReply.from &&
      lastRealEnemyMove.to === preparedLookahead.enemyReply.to
    ) {
      const instantRes = {
        best: {
          ...preparedLookahead.premove,
          evalPawns: cachedMoves.best ? cachedMoves.best.evalPawns : "0.50",
          whitePerspectiveEval: cachedMoves.best ? cachedMoves.best.whitePerspectiveEval : "0.50",
          pvLine: `${preparedLookahead.premove.from}→${preparedLookahead.premove.to} (0 мс Предсказание)`
        },
        average: null,
        worst: null,
        boardKey: state.boardKey
      };
      renderArrowsOverlay(state, instantRes);
    }

    safeSendMessage(
      {
        type: "ANALYZE_POSITION",
        fen: state.fen,
        elo: currentElo,
        style: currentStyle,
        pass: "fast",
        lastEnemyMove: lastRealEnemyMove
      },
      (fastRes) => {
        if (myReqId !== analysisRequestId || !fastRes || fastRes.error) return;
        applyAnalysisResult(state, fastRes, false, "");

        if (fastRes.best && fastRes.best.isMateInOne) {
          if (deepBadge) deepBadge.style.display = "none";
          return;
        }

        if (deepBadge) deepBadge.style.display = "inline-block";
        const firstBestUci = fastRes.best ? fastRes.best.uci : "";

        safeSendMessage(
          {
            type: "ANALYZE_POSITION",
            fen: state.fen,
            elo: currentElo,
            style: currentStyle,
            pass: "deep",
            lastEnemyMove: lastRealEnemyMove
          },
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

  let rafPending = false;
  function triggerDebouncedCycle() {
    if (extensionInvalidated || rafPending) return;
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
      domObserver.observe(cgBoard, { childList: true, attributes: true, attributeFilter: ["class", "style"] });
      triggerDebouncedCycle();
    }

    const movesWrap = document.querySelector(".round__app__table, .analyse__moves, l4x, rm6");
    if (movesWrap && movesWrap !== observedMovesNode) {
      observedMovesNode = movesWrap;
      domObserver.observe(movesWrap, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  loadSettings();
  ensureObserversAttached();

  mainIntervalId = setInterval(() => {
    if (extensionInvalidated || !isContextValid()) {
      shutdownOrphanedScript();
      return;
    }
    ensureObserversAttached();
    runCycle(false);
  }, 450);

  const syncVisualPosition = () => {
    if (extensionInvalidated || !isContextValid()) return;
    const state = captureBoardState(true);
    if (state && cachedMoves.best) {
      renderEvalBar(state, cachedMoves.best.whitePerspectiveEval || cachedMoves.best.evalPawns);
      renderArrowsOverlay(state, cachedMoves);
    }
  };

  window.addEventListener("scroll", syncVisualPosition, { passive: true });
  window.addEventListener("resize", syncVisualPosition, { passive: true });
})();