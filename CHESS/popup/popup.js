document.addEventListener("DOMContentLoaded", () => {
  const eloSlider = document.getElementById("popup-elo");
  const eloVal = document.getElementById("popup-elo-val");
  const styleSelect = document.getElementById("popup-style");
  const themeSelect = document.getElementById("popup-theme");
  const arrowStyleSelect = document.getElementById("popup-arrow-style");
  const arrowsCheckbox = document.getElementById("popup-arrows");
  const evalbarCheckbox = document.getElementById("popup-evalbar");
  const memInfo = document.getElementById("popup-mem-info");
  const clearBtn = document.getElementById("popup-clear-mem");
  const studioBtn = document.getElementById("popup-open-studio");

  function setSelectSafe(selectNode, val, fallback) {
    if (!selectNode) return;
    const exists = Array.from(selectNode.options).some((o) => o.value === val);
    selectNode.value = exists ? val : fallback;
  }

  chrome.storage.local.get(["elo", "style", "uiTheme", "arrowStyle", "showArrows", "showEvalBar"], (res) => {
    if (res.elo) {
      eloSlider.value = res.elo;
      eloVal.textContent = `${res.elo} ELO`;
    }
    setSelectSafe(styleSelect, res.style || "tal", "tal");
    setSelectSafe(themeSelect, res.uiTheme || "minimal", "minimal");
    setSelectSafe(arrowStyleSelect, res.arrowStyle || "curved_neon", "curved_neon");

    if (typeof res.showArrows === "boolean") arrowsCheckbox.checked = res.showArrows;
    if (typeof res.showEvalBar === "boolean") evalbarCheckbox.checked = res.showEvalBar;
  });

  function refreshStats() {
    chrome.runtime.sendMessage({ type: "GET_MEMORY_STATS" }, (res) => {
      if (res) {
        memInfo.textContent = `❖ Позиций: ${res.positionsCount || 0} (Матчей: ${res.totalLearnedGames || 0})`;
      }
    });
  }
  refreshStats();

  eloSlider.addEventListener("input", (e) => {
    eloVal.textContent = `${e.target.value} ELO`;
  });

  eloSlider.addEventListener("change", (e) => {
    chrome.storage.local.set({ elo: Number(e.target.value) });
  });

  styleSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ style: e.target.value });
  });

  themeSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ uiTheme: e.target.value });
  });

  arrowStyleSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ arrowStyle: e.target.value });
  });

  arrowsCheckbox.addEventListener("change", (e) => {
    chrome.storage.local.set({ showArrows: e.target.checked });
  });

  evalbarCheckbox.addEventListener("change", (e) => {
    chrome.storage.local.set({ showEvalBar: e.target.checked });
  });

  studioBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"), "_blank");
    }
  });

  clearBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_MEMORY" }, () => {
      refreshStats();
      clearBtn.textContent = "✦ Очищено!";
      setTimeout(() => { clearBtn.textContent = "🗑 Сброс БД"; }, 1000);
    });
  });
});