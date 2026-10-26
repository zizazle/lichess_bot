// lib/phonk-fx.js — Модуль 15-секундного Phonk-эдита Бриллиантовых ходов и 4 стилей Мата в 1 ход
window.ChessFX = (function () {
  let audioCtx = null;
  let activeEditTimer = null;
  let activeBeatInterval = null;
  let activeEscHandler = null;
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

  // ИСПРАВЛЕНО ПО АУДИТУ (п. 2.1): Бриллиантовый ход выдается только за мат в 1 ход,
  // выгодное превращение в коня или корректную жертву с перевесом >= +2.0 пешки без зевков
  function isBrilliantMove(moveObj) {
    if (!moveObj) return false;
    const evalNum = parseFloat(moveObj.evalPawns) || 0;
    return Boolean(
      moveObj.isMateInOne ||
      (moveObj.promo === "n" && evalNum >= 1.5) ||
      (moveObj.isSacrifice &&
        evalNum >= 2.0 &&
        !moveObj.ignoredHangingPiece &&
        !moveObj.underDirectAttack)
    );
  }

  function isEditRunning() {
    return Boolean(activeBeatInterval || activeEditTimer);
  }

  function stopPhonkEdit(shadowRoot) {
    if (activeEditTimer) {
      clearTimeout(activeEditTimer);
      activeEditTimer = null;
    }
    if (activeBeatInterval) {
      clearInterval(activeBeatInterval);
      activeBeatInterval = null;
    }
    if (activeEscHandler) {
      window.removeEventListener("keydown", activeEscHandler);
      activeEscHandler = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
    }
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
      if (testBtn) {
        testBtn.textContent = "🔥 ТЕСТ ФОНК-ЭДИТА (15 СЕК)";
      }
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
    if (testBtn) {
      testBtn.textContent = "⏹ ОСТАНОВИТЬ ФОНК-ЭДИТ [ESC]";
    }

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
          background: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 3px,
            rgba(0, 0, 0, 0.24) 4px
          );
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
        #cc-phonk-skip-btn:hover {
          background: #ff2a85; color: #fff;
        }
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

    activeEscHandler = (e) => {
      if (e.key === "Escape") {
        stopPhonkEdit(shadowRoot);
      }
    };
    window.addEventListener("keydown", activeEscHandler);

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

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
          if (centerBanner) {
            centerBanner.style.transform = "translate(-50%, -50%) scale(1.09)";
          }
        } else {
          if (cgWrap) {
            cgWrap.style.transform = "scale(1.0) rotate(0deg)";
          }
          if (centerBanner) {
            centerBanner.style.transform = "translate(-50%, -50%) scale(1.0)";
          }
        }

        if (step % 8 === 0 && mainTitle) {
          mainTitle.textContent = PHONK_CAPTIONS[Math.floor(step / 8) % PHONK_CAPTIONS.length];
        }

        if (timerBar) {
          const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
          timerBar.style.width = `${pct}%`;
        }

        step++;
      };

      playStepNow();
      activeBeatInterval = setInterval(playStepNow, 190);
    } catch (e) {
      console.error("[ChessFX] Ошибка запуска аудио:", e);
    }

    activeEditTimer = setTimeout(() => stopPhonkEdit(shadowRoot), durationMs);
  }

  function renderMateSpectacleByStyle(styleName, pm, pk) {
    const bannerY = Math.max(45, pk.y - 54);
    const bannerX = Math.max(125, Math.min(675, pk.x));

    if (styleName === "phonk_skull") {
      return `
        <circle cx="${pk.x}" cy="${pk.y}" r="30" fill="none" stroke="#00f5d4" style="animation: cc-mate-ring 0.85s ease-out infinite;" />
        <circle cx="${pk.x}" cy="${pk.y}" r="42" fill="none" stroke="#ff2a85" style="animation: cc-mate-ring 0.85s ease-out 0.25s infinite;" />
        <path d="M ${pk.x - 18} 0 L ${pk.x + 12} ${pk.y - 25} L ${pk.x - 8} ${pk.y - 15} L ${pk.x + 5} ${pk.y}"
              fill="none" stroke="#00f5d4" stroke-width="4.5" style="filter: drop-shadow(0 0 12px #00f5d4);" />
        <g style="animation: cc-mate-scream 0.75s ease-in-out infinite; transform-origin: ${pk.x}px ${pk.y}px;">
          <text x="${pk.x}" y="${pk.y + 12}" text-anchor="middle" font-size="42">💀</text>
          <text x="${pm.x + 30}" y="${pm.y - 24}" text-anchor="middle" font-size="30">💎</text>
        </g>
        <g style="animation: cc-marker-float 0.9s ease-in-out infinite;">
          <rect x="${bannerX - 118}" y="${bannerY - 22}" width="236" height="36" rx="10"
                fill="rgba(10, 12, 18, 0.96)" stroke="#00f5d4" stroke-width="3" />
          <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#00f5d4"
                font-family="monospace" font-weight="900" font-size="15.5">
            💀 MOGGED // МАТ #1 ⚡
          </text>
        </g>
      `;
    }

    if (styleName === "orbital_laser") {
      return `
        <line x1="${pk.x}" y1="0" x2="${pk.x}" y2="${pk.y}" stroke="#00f5d4" stroke-width="14" stroke-opacity="0.28" />
        <line x1="${pk.x}" y1="0" x2="${pk.x}" y2="${pk.y}" stroke="#ffffff" stroke-width="4" stroke-opacity="0.9" />
        <g style="transform-origin: ${pk.x}px ${pk.y}px; animation: cc-sniper-rotate 2.6s linear infinite;">
          <circle cx="${pk.x}" cy="${pk.y}" r="42" fill="none" stroke="#00f5d4" stroke-width="3.5" stroke-dasharray="18 10" />
          <circle cx="${pk.x}" cy="${pk.y}" r="24" fill="none" stroke="#ff2a85" stroke-width="2.5" />
        </g>
        <g style="animation: cc-marker-float 1s ease-in-out infinite;">
          <rect x="${bannerX - 122}" y="${bannerY - 22}" width="244" height="36" rx="10"
                fill="rgba(8, 14, 24, 0.96)" stroke="#00bbf9" stroke-width="3" />
          <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#00f5d4"
                font-family="monospace" font-weight="900" font-size="15">
            🎯 ORBITAL LOCK // МАТ #1
          </text>
        </g>
      `;
    }

    if (styleName === "royal_exec") {
      return `
        <circle cx="${pk.x}" cy="${pk.y}" r="28" fill="none" stroke="#ffbe0b" style="animation: cc-mate-ring 1s ease-out infinite;" />
        <g style="animation: cc-mate-scream 0.9s ease-in-out infinite; transform-origin: ${pk.x}px ${pk.y}px;">
          <text x="${pk.x - 32}" y="${pk.y + 34}" text-anchor="middle" font-size="30">⚔️</text>
          <text x="${pk.x + 32}" y="${pk.y + 34}" text-anchor="middle" font-size="30">👑</text>
        </g>
        <g style="animation: cc-marker-float 1s ease-in-out infinite;">
          <rect x="${bannerX - 118}" y="${bannerY - 22}" width="236" height="36" rx="10"
                fill="rgba(24, 16, 8, 0.96)" stroke="#ffbe0b" stroke-width="3" />
          <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#ffbe0b"
                font-family="-apple-system, sans-serif" font-weight="900" font-size="15.5">
            👑 ШАХ И МАТ В 1 ХОД! ⚔️
          </text>
        </g>
      `;
    }

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
              fill="rgba(16, 12, 20, 0.96)" stroke="#ffbe0b" stroke-width="3" />
        <text x="${bannerX}" y="${bannerY + 2}" text-anchor="middle" fill="#ffbe0b"
              font-family="-apple-system, sans-serif" font-weight="900" font-size="16">
          💀 МАТ В 1 ХОД! 😂
        </text>
      </g>
    `;
  }

  return {
    isBrilliantMove,
    isEditRunning,
    triggerBrilliantPhonkEdit,
    stopPhonkEdit,
    renderMateSpectacleByStyle
  };
})();