document.addEventListener("DOMContentLoaded", () => {
  const themeEl = document.getElementById("opt-theme");
  const arrowStyleEl = document.getElementById("opt-arrow-style");
  const scaleEl = document.getElementById("opt-arrow-scale");
  const opacityEl = document.getElementById("opt-arrow-opacity");
  const eloEl = document.getElementById("opt-elo");
  const styleEl = document.getElementById("opt-style");
  const shadowEl = document.getElementById("opt-pieces-shadow");
  const roflEl = document.getElementById("opt-rofl");
  const antibanEl = document.getElementById("opt-antiban");

  const valScale = document.getElementById("val-scale");
  const valOpacity = document.getElementById("val-opacity");
  const valElo = document.getElementById("val-elo");
  const saveStatus = document.getElementById("save-status");
  const previewSvg = document.getElementById("studio-preview-svg");
  const memStats = document.getElementById("studio-mem-stats");

  function setSelectSafe(selectNode, val, fallback) {
    if (!selectNode) return;
    const exists = Array.from(selectNode.options).some((o) => o.value === val);
    selectNode.value = exists ? val : fallback;
  }

  function flashSaved() {
    saveStatus.textContent = "✦ СОХРАНЕНО НА ЛЕТУ";
    setTimeout(() => {
      saveStatus.textContent = "✦ СИНХРОНИЗИРОВАНО";
    }, 900);
  }

  function renderPreview() {
    const scale = Number(scaleEl.value) || 1.0;
    const opacity = Number(opacityEl.value) || 0.85;
    const aStyle = arrowStyleEl.value || "curved_neon";
    const wBest = 12 * scale;
    const wAvg = 9 * scale;

    previewSvg.style.animation = aStyle === "chroma_rgb" ? "cc-chroma 2.4s linear infinite" : "none";

    // Рисуем шахматные клетки на фоне превью
    let squaresBg = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        squaresBg += `<rect x="${c * 55}" y="${r * 55}" width="55" height="55" fill="${isDark ? "#222736" : "#2c3346"}" opacity="0.55"/>`;
      }
    }

    let bestArrowSvg = "";
    if (aStyle === "tube_3d") {
      bestArrowSvg = `
        <path d="M 86 164 Q 216 54 356 76" fill="none" stroke="rgba(0,0,0,0.65)" stroke-width="${wBest * 1.2}" stroke-linecap="round" />
        <path d="M 80 155 Q 210 45 350 65" fill="none" stroke="url(#p-best)" stroke-width="${wBest * 1.15}" stroke-linecap="round" stroke-opacity="${opacity}" />
        <path d="M 80 155 Q 210 45 350 65" fill="none" stroke="#ffffff" stroke-width="${wBest * 0.32}" stroke-linecap="round" stroke-opacity="0.8" />
      `;
    } else if (aStyle === "plasma") {
      bestArrowSvg = `
        <path d="M 80 155 L 145 105 L 210 135 L 280 75 L 350 65" fill="none" stroke="#00f5d4" stroke-width="${wBest}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="${opacity}" />
        <path d="M 80 155 L 145 105 L 210 135 L 280 75 L 350 65" fill="none" stroke="#ffffff" stroke-width="${wBest * 0.35}" stroke-linejoin="round" stroke-linecap="round" />
      `;
    } else if (aStyle === "dna_wave") {
      bestArrowSvg = `
        <path d="M 80 155 Q 210 30 350 65" fill="none" stroke="url(#p-best)" stroke-width="${wBest * 0.8}" stroke-linecap="round" stroke-opacity="${opacity}" />
        <path d="M 80 155 Q 210 175 350 65" fill="none" stroke="#00f5d4" stroke-width="${wBest * 0.55}" stroke-dasharray="12 8" stroke-linecap="round" stroke-opacity="${opacity * 0.8}" />
      `;
    } else if (aStyle === "sniper_3d") {
      bestArrowSvg = `
        <path d="M 80 155 L 350 65" fill="none" stroke="url(#p-best)" stroke-width="${wBest * 0.8}" stroke-dasharray="16 8" stroke-opacity="${opacity}" />
        <g style="transform-origin: 350px 65px; animation: cc-sniper-spin 4s linear infinite;">
          <circle cx="350" cy="65" r="${34 * scale}" fill="none" stroke="#00f5d4" stroke-width="2.5" stroke-dasharray="14 8" />
          <line x1="312" y1="65" x2="328" y2="65" stroke="#fff" stroke-width="2.5" />
          <line x1="372" y1="65" x2="388" y2="65" stroke="#fff" stroke-width="2.5" />
          <line x1="350" y1="27" x2="350" y2="43" stroke="#fff" stroke-width="2.5" />
          <line x1="350" y1="87" x2="350" y2="103" stroke="#fff" stroke-width="2.5" />
        </g>
      `;
    } else {
      const cy = (aStyle === "curved_neon" || aStyle === "chroma_rgb") ? 45 : 110;
      const dash = aStyle === "dotted" ? `stroke-dasharray="14 10"` : "";
      bestArrowSvg = `
        <path d="M 80 155 Q 210 ${cy} 350 65" fill="none" stroke="url(#p-best)"
              stroke-width="${wBest}" stroke-linecap="round" stroke-opacity="${opacity}" ${dash} />
        ${aStyle !== "classic" ? `<path d="M 80 155 Q 210 ${cy} 350 65" fill="none" stroke="#ffffff" stroke-width="${3 * scale}" stroke-linecap="round" stroke-opacity="0.6" class="preview-flow" />` : ""}
      `;
    }

    previewSvg.innerHTML = `
      <defs>
        <linearGradient id="p-best" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00bbf9" />
          <stop offset="100%" stop-color="#00f5d4" />
        </linearGradient>
        <linearGradient id="p-avg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ff9e00" />
          <stop offset="100%" stop-color="#ffbe0b" />
        </linearGradient>
      </defs>
      ${squaresBg}
      <circle cx="80" cy="155" r="${10 * scale}" fill="#00f5d4" fill-opacity="${opacity * 0.75}" />
      <circle cx="350" cy="65" r="${26 * scale}" fill="none" stroke="#00f5d4" stroke-width="${3 * scale}" stroke-opacity="${opacity}" />
      <path d="M 80 155 Q 225 190 330 160" fill="none" stroke="url(#p-avg)"
            stroke-width="${wAvg}" stroke-linecap="round" stroke-opacity="${opacity * 0.7}" />
      ${bestArrowSvg}
      <rect x="366" y="24" width="30" height="30" rx="8" fill="rgba(10,12,18,0.94)" stroke="#00f5d4" stroke-width="2.2" />
      <text x="381" y="45" text-anchor="middle" fill="#00f5d4" font-family="monospace" font-weight="900" font-size="16">⚡</text>
    `;
  }

  function refreshMemoryInfo() {
    chrome.runtime.sendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
      if (res) {
        memStats.textContent = `❖ В памяти: ${res.positionsCount || 0} позиций (Сыграно партий: ${res.totalLearnedGames || 0})`;
      }
    });
  }

  chrome.storage.local.get(
    ["uiTheme", "arrowStyle", "arrowScale", "arrowOpacity", "elo", "style", "enable3DPiecesShadow", "roflMode", "safeAntiBanGuard"],
    (res) => {
      setSelectSafe(themeEl, res.uiTheme || "minimal", "minimal");
      setSelectSafe(arrowStyleEl, res.arrowStyle || "curved_neon", "curved_neon");
      setSelectSafe(styleEl, res.style || "tal", "tal");

      if (res.arrowScale) {
        scaleEl.value = res.arrowScale;
        valScale.textContent = `${Number(res.arrowScale).toFixed(1)}x`;
      }
      if (res.arrowOpacity) {
        opacityEl.value = res.arrowOpacity;
        valOpacity.textContent = `${Math.round(Number(res.arrowOpacity) * 100)}%`;
      }
      if (res.elo) {
        eloEl.value = res.elo;
        valElo.textContent = `${res.elo} ELO`;
      }
      if (typeof res.enable3DPiecesShadow === "boolean") shadowEl.checked = res.enable3DPiecesShadow;
      if (typeof res.roflMode === "boolean") roflEl.checked = res.roflMode;
      if (typeof res.safeAntiBanGuard === "boolean") antibanEl.checked = res.safeAntiBanGuard;

      renderPreview();
      refreshMemoryInfo();
    }
  );

  themeEl.addEventListener("change", () => {
    chrome.storage.local.set({ uiTheme: themeEl.value });
    flashSaved();
  });

  arrowStyleEl.addEventListener("change", () => {
    chrome.storage.local.set({ arrowStyle: arrowStyleEl.value });
    renderPreview();
    flashSaved();
  });

  scaleEl.addEventListener("input", () => {
    valScale.textContent = `${Number(scaleEl.value).toFixed(1)}x`;
    chrome.storage.local.set({ arrowScale: Number(scaleEl.value) });
    renderPreview();
  });

  opacityEl.addEventListener("input", () => {
    valOpacity.textContent = `${Math.round(Number(opacityEl.value) * 100)}%`;
    chrome.storage.local.set({ arrowOpacity: Number(opacityEl.value) });
    renderPreview();
  });

  eloEl.addEventListener("input", () => {
    valElo.textContent = `${eloEl.value} ELO`;
    chrome.storage.local.set({ elo: Number(eloEl.value) });
  });

  styleEl.addEventListener("change", () => {
    chrome.storage.local.set({ style: styleEl.value });
    flashSaved();
  });

  shadowEl.addEventListener("change", () => {
    chrome.storage.local.set({ enable3DPiecesShadow: shadowEl.checked });
    flashSaved();
  });

  roflEl.addEventListener("change", () => {
    chrome.storage.local.set({ roflMode: roflEl.checked });
    flashSaved();
  });

  antibanEl.addEventListener("change", () => {
    chrome.storage.local.set({ safeAntiBanGuard: antibanEl.checked });
    flashSaved();
  });

  document.getElementById("btn-export-db").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
      const blob = new Blob([JSON.stringify(res?.experienceDB || {}, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chesscoach-rework-db-${Date.now()}.json`;
      a.click();
    });
  });

  document.getElementById("btn-clear-db").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_MEMORY" }, () => {
      refreshMemoryInfo();
      flashSaved();
    });
  });
});