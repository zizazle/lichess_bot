(function () {
  console.log("[ChessCoach content2.js] Полный рендер стрелок (Fix Vertical SVG) + меню ВИЗУАЛ на сайте!");

  let shadowRootRef = window.CC_CORE ? window.CC_CORE.getShadow() : null;

  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const sr = origAttachShadow.call(this, init);
    if (this.getAttribute && (this.getAttribute("data-layer") || "").includes("cc-")) {
      shadowRootRef = sr;
    }
    return sr;
  };

  function getSR() {
    if (shadowRootRef) return shadowRootRef;
    if (window.CC_CORE && typeof window.CC_CORE.getShadow === "function") {
      shadowRootRef = window.CC_CORE.getShadow();
    }
    return shadowRootRef;
  }

  function $id(id) {
    const sr = getSR();
    return sr ? sr.getElementById(id) : null;
  }

  const ALL_STYLE_NAMES = {
    mogging: "⚡ Моггинг",
    tal: "✦ Таль",
    kasparov: "▲ Каспаров",
    fischer: "◈ Фишер",
    carlsen: "❖ Карлсен",
    solid: "🛡 Карпов",
    balanced: "⚙ Стокфиш",
    alphazero: "🧠 AlphaZero",
    morphy: "🎭 Морфи",
    hikaru: "🚀 Накамура",
    botvinnik: "🏛 Ботвинник"
  };

  let activeStyle = "tal";
  let activeTheme = "minimal";
  let activeArrowStyle = "curved_neon";
  let activeArrowScale = 1.0;
  let activeArrowOpacity = 0.85;
  let activeShowArrows = true;
  let activeShowEvalBar = true;
  let enable3DPiecesShadow = true;

  function saveLocal(obj) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(obj);
    }
  }

  function setSelectSafe(selectNode, val, fallback) {
    if (!selectNode) return;
    const exists = Array.from(selectNode.options).some((o) => o.value === val);
    selectNode.value = exists ? val : fallback;
  }

  // 1. Внедряем четкие стили тем и анимаций в Shadow DOM
  function injectCleanStyles() {
    const sr = getSR();
    if (!sr || sr.getElementById("cc-v2-clean-styles")) return;

    const style = document.createElement("style");
    style.id = "cc-v2-clean-styles";
    style.textContent = `
      @keyframes cc-sniper-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes cc-plasma-pulse {
        0%, 100% { filter: drop-shadow(0 0 7px #00f5d4); }
        50% { filter: drop-shadow(0 0 14px #ff2a85); }
      }
      @keyframes cc-chroma-shift {
        0% { filter: hue-rotate(0deg) drop-shadow(0 0 8px rgba(0,245,212,0.8)); }
        50% { filter: hue-rotate(180deg) drop-shadow(0 0 12px rgba(255,42,133,0.85)); }
        100% { filter: hue-rotate(360deg) drop-shadow(0 0 8px rgba(0,245,212,0.8)); }
      }

      #chesscoach-panel, #chesscoach-panel * {
        -webkit-font-smoothing: antialiased !important;
        text-rendering: geometricPrecision !important;
      }

      #chesscoach-panel.theme-aurora {
        --cc-accent: #00f5d4 !important;
        --cc-accent-2: #b5179e !important;
        --cc-glow: rgba(181, 23, 158, 0.28) !important;
        --cc-bg-glass: linear-gradient(135deg, rgba(12, 22, 34, 0.88), rgba(28, 12, 38, 0.88)) !important;
      }
      #chesscoach-panel.theme-hologram {
        --cc-accent: #c77dff !important;
        --cc-accent-2: #48cae4 !important;
        --cc-glow: rgba(199, 125, 255, 0.26) !important;
        --cc-bg-glass: rgba(18, 13, 31, 0.86) !important;
      }
      #chesscoach-panel.theme-matrix {
        --cc-accent: #38b000 !important;
        --cc-accent-2: #ccff33 !important;
        --cc-glow: rgba(56, 176, 0, 0.25) !important;
        --cc-bg-glass: rgba(9, 18, 12, 0.90) !important;
      }
      #chesscoach-panel.theme-titanium {
        --cc-accent: #e0fbfc !important;
        --cc-accent-2: #98c1d9 !important;
        --cc-glow: rgba(224, 251, 252, 0.16) !important;
        --cc-bg-glass: rgba(24, 28, 34, 0.84) !important;
      }

      #chesscoach-panel select option {
        background: #0f121a;
        color: #ffffff;
      }
    `;
    sr.appendChild(style);
  }

  // 2. Объемные тени под фигурами и доской (без искажения координат)
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

  // 3. Синхронизация всех подписей стилей и тем в HUD
  function syncStyleAndThemeLabels() {
    const panel = $id("chesscoach-panel");
    if (!panel) return;

    const allThemes = [
      "theme-minimal", "theme-cyberpunk", "theme-crimson", "theme-gold",
      "theme-obsidian", "theme-aurora", "theme-hologram", "theme-matrix", "theme-titanium"
    ];
    allThemes.forEach((cls) => panel.classList.remove(cls));
    panel.classList.add(`theme-${activeTheme}`);

    const label = ALL_STYLE_NAMES[activeStyle] || "✦ Таль";
    const bestTitle = $id("cc-best-title");
    const expectedBestTitle = `✦ ЛУЧШИЙ ХОД • ${label}`;
    if (bestTitle && bestTitle.textContent !== expectedBestTitle) {
      bestTitle.textContent = expectedBestTitle;
    }

    const sideStat = $id("cc-active-style-stat");
    const shortName = label.replace(/^[^\s]+\s/, "");
    if (sideStat && sideStat.textContent !== shortName) {
      sideStat.textContent = shortName;
    }

    const styleGrid = panel.querySelector(".cc-style-grid");
    if (styleGrid) {
      styleGrid.querySelectorAll(".cc-style-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.style === activeStyle);
      });
    }

    setSelectSafe($id("cc-vis-theme"), activeTheme, "minimal");
    setSelectSafe($id("cc-vis-arrow-style"), activeArrowStyle, "curved_neon");
    if ($id("cc-vis-scale")) $id("cc-vis-scale").value = activeArrowScale;
    if ($id("cc-vis-scale-val")) $id("cc-vis-scale-val").textContent = `${Number(activeArrowScale).toFixed(1)}x`;
    if ($id("cc-vis-opacity")) $id("cc-vis-opacity").value = activeArrowOpacity;
    if ($id("cc-vis-opacity-val")) $id("cc-vis-opacity-val").textContent = `${Math.round(activeArrowOpacity * 100)}%`;
    if ($id("cc-vis-arrows-chk")) $id("cc-vis-arrows-chk").checked = activeShowArrows;
    if ($id("cc-vis-eval-chk")) $id("cc-vis-eval-chk").checked = activeShowEvalBar;
    if ($id("cc-v2-pieces-shadow-chk")) $id("cc-v2-pieces-shadow-chk").checked = enable3DPiecesShadow;
  }

  // 4. ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ РЕНДЕР СТРЕЛОК (gradientUnits="userSpaceOnUse" чинит пропажу вертикальных и горизонтальных линий!)
  function renderFixedArrowsOverlay(state, res) {
    let svg = $id("chesscoach-screen-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "chesscoach-screen-svg";
      svg.setAttribute("viewBox", "0 0 800 800");
      getSR().appendChild(svg);
    }

    const coreState = window.CC_CORE ? window.CC_CORE.getState() : {};
    const turnMode = coreState.turnMode || "my";

    if (!activeShowArrows || !state || !state.boardRect || !res || !res.best) {
      svg.innerHTML = "";
      svg.style.display = "none";
      return;
    }

    if (turnMode === "my" && state.actualTurn !== state.myColor) {
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
    svg.style.animation = activeArrowStyle === "chroma_rgb" ? "cc-chroma-shift 2.5s linear infinite" : "none";

    const isBlack = state.isBlackOrientation;
    const sqToXY = (sq) => {
      const file = "abcdefgh".indexOf(sq[0]);
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

      const width = (isBest ? 14 : 10.5) * activeArrowScale;
      const op = Math.min(1, baseOp * (activeArrowOpacity / 0.85));

      // 1) 🧊 3D Объемная трубка с падающей тенью и бликом
      if (activeArrowStyle === "tube_3d") {
        const cx = (p1.x + tx) / 2 + nx * curveOffset;
        const cy = (p1.y + ty) / 2 + ny * curveOffset;
        const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;
        const shadowD = `M ${p1.x + 6} ${p1.y + 10} Q ${cx + 6} ${cy + 10} ${tx + 6} ${ty + 10}`;
        return `
          <circle cx="${p2.x + 5}" cy="${p2.y + 8}" r="${33 * activeArrowScale}" fill="rgba(0,0,0,0.42)" />
          <path d="${shadowD}" fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="${width * 1.15}" stroke-linecap="round" />
          <circle cx="${p1.x}" cy="${p1.y}" r="${10 * activeArrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${34 * activeArrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.5 * activeArrowScale}" stroke-opacity="${op * 0.9}" />
          <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 1.15}" stroke-linecap="round" stroke-opacity="${op}" marker-end="url(#${markerId})" />
          <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${width * 0.3}" stroke-linecap="round" stroke-opacity="0.78" />
        `;
      }

      // 2) ⚡ Плазменная молния-зигзаг
      if (activeArrowStyle === "plasma") {
        const z1x = (p1.x + dx * 0.25 + nx * 18).toFixed(1);
        const z1y = (y1 = p1.y + dy * 0.25 + ny * 18).toFixed(1);
        const z2x = (p1.x + dx * 0.52 - nx * 18).toFixed(1);
        const z2y = (p1.y + dy * 0.52 - ny * 18).toFixed(1);
        const z3x = (p1.x + dx * 0.76 + nx * 14).toFixed(1);
        const z3y = (p1.y + dy * 0.76 + ny * 14).toFixed(1);
        const boltD = `M ${p1.x} ${p1.y} L ${z1x} ${z1y} L ${z2x} ${z2y} L ${z3x} ${z3y} L ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${11 * activeArrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${33 * activeArrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3 * activeArrowScale}" stroke-dasharray="10 6" stroke-opacity="${op}" />
          <path d="${boltD}" fill="none" stroke="url(#${gradId})" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"
                stroke-opacity="${op}" style="filter: drop-shadow(0 0 8px ${solidColor});" marker-end="url(#${markerId})" />
          <path d="${boltD}" fill="none" stroke="#ffffff" stroke-width="${width * 0.32}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.85" />
        `;
      }

      // 3) 🎯 3D Снайперский радар-прицел
      if (activeArrowStyle === "sniper_3d") {
        const lineD = `M ${p1.x} ${p1.y} L ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${9 * activeArrowScale}" fill="${solidColor}" fill-opacity="${op * 0.8}" />
          <path d="${lineD}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 0.82}" stroke-dasharray="16 8"
                stroke-linecap="round" stroke-opacity="${op}" style="filter: drop-shadow(0 0 6px ${solidColor});" marker-end="url(#${markerId})" />
          <path d="${lineD}" fill="none" stroke="#ffffff" stroke-width="${2.2 * activeArrowScale}" stroke-opacity="0.7" />
          <g style="transform-origin: ${p2.x}px ${p2.y}px; animation: cc-sniper-rotate 4.2s linear infinite;">
            <circle cx="${p2.x}" cy="${p2.y}" r="${36 * activeArrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3 * activeArrowScale}" stroke-dasharray="18 10" stroke-opacity="${op * 0.95}" />
            <line x1="${p2.x - 42 * activeArrowScale}" y1="${p2.y}" x2="${p2.x - 24 * activeArrowScale}" y2="${p2.y}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x + 24 * activeArrowScale}" y1="${p2.y}" x2="${p2.x + 42 * activeArrowScale}" y2="${p2.y}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x}" y1="${p2.y - 42 * activeArrowScale}" x2="${p2.x}" y2="${p2.y - 24 * activeArrowScale}" stroke="${solidColor}" stroke-width="3" />
            <line x1="${p2.x}" y1="${p2.y + 24 * activeArrowScale}" x2="${p2.x}" y2="${p2.y + 42 * activeArrowScale}" stroke="${solidColor}" stroke-width="3" />
          </g>
        `;
      }

      // 4) 🧬 Двойная кибер-волна ДНК
      if (activeArrowStyle === "dna_wave") {
        const c1x = (p1.x + tx) / 2 + nx * 32;
        const c1y = (p1.y + ty) / 2 + ny * 32;
        const c2x = (p1.x + tx) / 2 - nx * 32;
        const c2y = (p1.y + ty) / 2 - ny * 32;
        const w1 = `M ${p1.x} ${p1.y} Q ${c1x} ${c1y} ${tx} ${ty}`;
        const w2 = `M ${p1.x} ${p1.y} Q ${c2x} ${c2y} ${tx} ${ty}`;
        return `
          <circle cx="${p1.x}" cy="${p1.y}" r="${10 * activeArrowScale}" fill="${solidColor}" fill-opacity="${op * 0.75}" />
          <circle cx="${p2.x}" cy="${p2.y}" r="${34 * activeArrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.2 * activeArrowScale}" stroke-opacity="${op * 0.85}" />
          <path d="${w1}" fill="none" stroke="url(#${gradId})" stroke-width="${width * 0.78}" stroke-linecap="round" stroke-opacity="${op}" marker-end="url(#${markerId})" />
          <path d="${w2}" fill="none" stroke="#ffffff" stroke-width="${width * 0.45}" stroke-dasharray="14 9" stroke-linecap="round" stroke-opacity="${op * 0.75}" class="cc-best-flow" />
        `;
      }

      // 5) Плавная дуга, Лазер, Классика, Пунктир и Chroma RGB
      const actualCurve = (activeArrowStyle === "curved_neon" || activeArrowStyle === "chroma_rgb") ? curveOffset : 0;
      const cx = (p1.x + tx) / 2 + nx * actualCurve;
      const cy = (p1.y + ty) / 2 + ny * actualCurve;
      const pathD = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${tx} ${ty}`;
      const dashAttr = activeArrowStyle === "dotted" ? `stroke-dasharray="14 10"` : "";
      const glowFilter = activeArrowStyle === "classic" ? "" : `style="filter: drop-shadow(0 0 9px ${solidColor});"`;

      return `
        <circle cx="${p1.x}" cy="${p1.y}" r="${10 * activeArrowScale}" fill="${solidColor}" fill-opacity="${op * 0.7}" />
        <circle cx="${p2.x}" cy="${p2.y}" r="${34 * activeArrowScale}" fill="none" stroke="${solidColor}" stroke-width="${3.2 * activeArrowScale}" stroke-opacity="${op * 0.82}" />
        <path d="${pathD}" fill="none" stroke="url(#${gradId})" stroke-width="${width}"
              stroke-linecap="round" stroke-opacity="${op}" ${dashAttr} ${glowFilter}
              marker-end="url(#${markerId})" />
        ${isBest && activeArrowStyle !== "classic" ? `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="${3.4 * activeArrowScale}" stroke-linecap="round" stroke-opacity="0.62" class="cc-best-flow" />` : ""}
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

    const avgCurve = (best && average && best.from === average.from) ? 42 : 18;
    const worstCurve = (best && worst && best.from === worst.from) ? -42 : -18;

    let markersHTML = "";
    if (best.isMateInOne) {
      markersHTML += drawMateInOneSpectacle(best.to, enemyKingSquare);
    } else {
      if (hangingSquare) markersHTML += drawHudMarkerOnSquare(hangingSquare, "!", "#ff2a85");
      if (best && best.isSacrifice) markersHTML += drawHudMarkerOnSquare(best.to, "⚡", "#ff4d94");
      else if (best && best.isFork) markersHTML += drawHudMarkerOnSquare(best.to, "⚔", "#00f5d4");
      else if (best && best.isPin) markersHTML += drawHudMarkerOnSquare(best.to, "◈", "#00bbf9");

      if ((coreState.roflMode || activeStyle === "mogging") && coreState.currentRoast && lastOpponentMove && lastOpponentMove.to) {
        markersHTML += drawHudMarkerOnSquare(lastOpponentMove.to, coreState.currentRoast.emoji, "#ffbe0b", true);
      }
    }

    const bestGrad = best.isMateInOne ? "grad-mate" : "grad-best";
    const bestGlow = best.isMateInOne ? "#ffbe0b" : "#00f5d4";

    // КЛЮЧЕВОЙ ФИКС: gradientUnits="userSpaceOnUse" на всех градиентах!
    // Теперь вертикальные (e7->e5) и горизонтальные ходы НИКОГДА не исчезают!
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

  // 5. Возвращаем полный выбор тем и стрелок прямо во вкладку ВИЗУАЛ в меню на сайте Lichess
  function upgradeHudMenu() {
    const panel = $id("chesscoach-panel");
    if (!panel || panel.dataset.v2FullUpgraded === "1") return;
    panel.dataset.v2FullUpgraded = "1";

    // Подменяем рендер стрелок в ядре CC_CORE на наш исправленный
    if (window.CC_CORE) {
      window.CC_CORE.override({
        renderArrowsOverlay: renderFixedArrowsOverlay
      });
    }

    // Добавляем 4 новых стиля чемпионов во вкладку ДВИЖОК
    const styleGrid = panel.querySelector(".cc-style-grid");
    if (styleGrid) {
      const extraPersonas = [
        { id: "alphazero", title: "🧠 AlphaZero", sub: "НЕЙРОСЕТЬ" },
        { id: "morphy", title: "🎭 Пол Морфи", sub: "ГЕНИЙ ТЕМПА" },
        { id: "hikaru", title: "🚀 Накамура", sub: "КОРОЛЬ ПУЛЬКИ" },
        { id: "botvinnik", title: "🏛 Ботвинник", sub: "ПАТРИАРХ" }
      ];
      extraPersonas.forEach((st) => {
        if (!styleGrid.querySelector(`[data-style="${st.id}"]`)) {
          const btn = document.createElement("button");
          btn.className = "cc-style-btn";
          btn.dataset.style = st.id;
          btn.innerHTML = `<span>${st.title}</span><small>${st.sub}</small>`;
          btn.addEventListener("click", () => {
            activeStyle = st.id;
            if (window.CC_CORE) window.CC_CORE.setState({ currentStyle: st.id });
            saveLocal({ style: st.id });
            syncStyleAndThemeLabels();
            if (window.CC_CORE) window.CC_CORE.forceRecalculate();
          });
          styleGrid.insertBefore(btn, styleGrid.lastElementChild);
        }
      });

      styleGrid.querySelectorAll(".cc-style-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeStyle = btn.dataset.style;
          syncStyleAndThemeLabels();
        });
      });
    }

    // Вкладка ВИЗУАЛ прямо в меню на сайте Lichess со всеми 9 темами и 9 стрелками!
    const visPane = $id("cc-pane-visuals");
    if (visPane) {
      visPane.innerHTML = `
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
          <div class="cc-section-title"><span>◈ КАСТОМИЗАЦИЯ СТРЕЛОК НА ДОСКЕ (9 ВИДОВ)</span></div>
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
          <div class="cc-Switch-row">
            <span>Объемные 3D-тени под фигурами и доской</span>
            <input type="checkbox" id="cc-v2-pieces-shadow-chk" checked>
          </div>
        </div>
      `;

      const refreshBoardArrowsNow = () => {
        if (window.CC_CORE) {
          const st = window.CC_CORE.captureBoardState(true);
          const moves = window.CC_CORE.getState().cachedMoves;
          renderFixedArrowsOverlay(st, moves);
        }
      };

      $id("cc-vis-theme").addEventListener("change", (e) => {
        activeTheme = e.target.value;
        if (window.CC_CORE) window.CC_CORE.setState({ uiTheme: activeTheme });
        saveLocal({ uiTheme: activeTheme });
        syncStyleAndThemeLabels();
      });

      $id("cc-vis-arrow-style").addEventListener("change", (e) => {
        activeArrowStyle = e.target.value;
        if (window.CC_CORE) window.CC_CORE.setState({ arrowStyle: activeArrowStyle });
        saveLocal({ arrowStyle: activeArrowStyle });
        refreshBoardArrowsNow();
      });

      $id("cc-vis-scale").addEventListener("input", (e) => {
        activeArrowScale = Number(e.target.value);
        if (window.CC_CORE) window.CC_CORE.setState({ arrowScale: activeArrowScale });
        saveLocal({ arrowScale: activeArrowScale });
        syncStyleAndThemeLabels();
        refreshBoardArrowsNow();
      });

      $id("cc-vis-opacity").addEventListener("input", (e) => {
        activeArrowOpacity = Number(e.target.value);
        if (window.CC_CORE) window.CC_CORE.setState({ arrowOpacity: activeArrowOpacity });
        saveLocal({ arrowOpacity: activeArrowOpacity });
        syncStyleAndThemeLabels();
        refreshBoardArrowsNow();
      });

      $id("cc-vis-arrows-chk").addEventListener("change", (e) => {
        activeShowArrows = e.target.checked;
        if (window.CC_CORE) window.CC_CORE.setState({ showArrows: activeShowArrows });
        saveLocal({ showArrows: activeShowArrows });
        refreshBoardArrowsNow();
      });

      $id("cc-vis-eval-chk").addEventListener("change", (e) => {
        activeShowEvalBar = e.target.checked;
        if (window.CC_CORE) {
          window.CC_CORE.setState({ showEvalBar: activeShowEvalBar });
          const st = window.CC_CORE.captureBoardState(true);
          const moves = window.CC_CORE.getState().cachedMoves;
          window.CC_CORE.renderEvalBar(st, moves?.best?.whitePerspectiveEval || 0);
        }
        saveLocal({ showEvalBar: activeShowEvalBar });
      });

      $id("cc-v2-pieces-shadow-chk").addEventListener("change", (e) => {
        enable3DPiecesShadow = e.target.checked;
        applySafeBoardDepth();
        saveLocal({ enable3DPiecesShadow });
      });

      syncStyleAndThemeLabels();
      refreshBoardArrowsNow();
    }
  }

  // 6. Загрузка и синхронизация настроек
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ["style", "uiTheme", "arrowStyle", "arrowScale", "arrowOpacity", "showArrows", "showEvalBar", "enable3DPiecesShadow"],
      (res) => {
        if (res.style) activeStyle = res.style;
        if (res.uiTheme) activeTheme = res.uiTheme;
        if (res.arrowStyle) activeArrowStyle = res.arrowStyle;
        if (res.arrowScale) activeArrowScale = Number(res.arrowScale);
        if (res.arrowOpacity) activeArrowOpacity = Number(res.arrowOpacity);
        if (typeof res.showArrows === "boolean") activeShowArrows = res.showArrows;
        if (typeof res.showEvalBar === "boolean") activeShowEvalBar = res.showEvalBar;
        if (typeof res.enable3DPiecesShadow === "boolean") enable3DPiecesShadow = res.enable3DPiecesShadow;
        applySafeBoardDepth();
      }
    );

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.style) activeStyle = changes.style.newValue;
      if (changes.uiTheme) activeTheme = changes.uiTheme.newValue;
      if (changes.arrowStyle) activeArrowStyle = changes.arrowStyle.newValue;
      if (changes.arrowScale) activeArrowScale = Number(changes.arrowScale.newValue);
      if (changes.arrowOpacity) activeArrowOpacity = Number(changes.arrowOpacity.newValue);
      if (changes.showArrows) activeShowArrows = Boolean(changes.showArrows.newValue);
      if (changes.showEvalBar) activeShowEvalBar = Boolean(changes.showEvalBar.newValue);
      if (changes.enable3DPiecesShadow) {
        enable3DPiecesShadow = Boolean(changes.enable3DPiecesShadow.newValue);
        applySafeBoardDepth();
      }
      syncStyleAndThemeLabels();
      if (window.CC_CORE) {
        const st = window.CC_CORE.captureBoardState(true);
        const moves = window.CC_CORE.getState().cachedMoves;
        renderFixedArrowsOverlay(st, moves);
      }
    });
  }

  setInterval(() => {
    injectCleanStyles();
    upgradeHudMenu();
    syncStyleAndThemeLabels();
  }, 150);
})();