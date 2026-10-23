document.addEventListener("DOMContentLoaded", () => {
  const eloSlider = document.getElementById("popup-elo");
  const eloVal = document.getElementById("popup-elo-val");
  const styleSelect = document.getElementById("popup-style");
  const autoMoveCheckbox = document.getElementById("popup-automove");
  const premoveCheckbox = document.getElementById("popup-premove");
  const premoveRiskSlider = document.getElementById("popup-premove-risk");
  const premoveRiskVal = document.getElementById("popup-risk-val");
  const themeSelect = document.getElementById("popup-theme");
  const arrowStyleSelect = document.getElementById("popup-arrow-style");
  const mateStyleSelect = document.getElementById("popup-mate-style");
  const phonkCheckbox = document.getElementById("popup-phonk");
  const arrowsCheckbox = document.getElementById("popup-arrows");
  const evalbarCheckbox = document.getElementById("popup-evalbar");
  const memInfo = document.getElementById("popup-mem-info");
  const clearBtn = document.getElementById("popup-clear-mem");
  const studioBtn = document.getElementById("popup-open-studio");

  const RISK_LABELS = {
    1: "🛡 Ур. 1: 100% Форсаж",
    2: "⚡ Ур. 2: Форсаж + Дебют",
    3: "🎯 Ур. 3: Активный Блиц",
    4: "🔥 Ур. 4: Ультра-Пулька"
  };

  function setSelectSafe(selectNode, val, fallback) {
    if (!selectNode) return;
    const exists = Array.from(selectNode.options).some((o) => o.value === val);
    selectNode.value = exists ? val : fallback;
  }

  chrome.storage.local.get(
    [
      "elo", "style", "uiTheme", "arrowStyle", "mateStyle",
      "showArrows", "showEvalBar", "phonkEditEnabled",
      "autoMoveEnabled", "premoveEnabled", "premoveRiskLevel"
    ],
    (res) => {
      if (res.elo) {
        eloSlider.value = res.elo;
        eloVal.textContent = `${res.elo} ELO`;
      }
      setSelectSafe(styleSelect, res.style || "tal", "tal");
      setSelectSafe(themeSelect, res.uiTheme || "minimal", "minimal");
      setSelectSafe(arrowStyleSelect, res.arrowStyle || "curved_neon", "curved_neon");
      setSelectSafe(mateStyleSelect, res.mateStyle || "phonk_skull", "phonk_skull");

      if (typeof res.showArrows === "boolean") arrowsCheckbox.checked = res.showArrows;
      if (typeof res.showEvalBar === "boolean") evalbarCheckbox.checked = res.showEvalBar;
      if (typeof res.phonkEditEnabled === "boolean") phonkCheckbox.checked = res.phonkEditEnabled;
      if (typeof res.autoMoveEnabled === "boolean") autoMoveCheckbox.checked = res.autoMoveEnabled;
      if (typeof res.premoveEnabled === "boolean") premoveCheckbox.checked = res.premoveEnabled;

      const rLvl = Number(res.premoveRiskLevel) || 2;
      premoveRiskSlider.value = rLvl;
      premoveRiskVal.textContent = RISK_LABELS[rLvl] || RISK_LABELS[2];
    }
  );

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

  autoMoveCheckbox.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoMoveEnabled: e.target.checked });
  });

  premoveCheckbox.addEventListener("change", (e) => {
    chrome.storage.local.set({ premoveEnabled: e.target.checked });
  });

  premoveRiskSlider.addEventListener("input", (e) => {
    const lvl = Number(e.target.value);
    premoveRiskVal.textContent = RISK_LABELS[lvl] || RISK_LABELS[2];
    chrome.storage.local.set({ premoveRiskLevel: lvl });
  });

  themeSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ uiTheme: e.target.value });
  });

  arrowStyleSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ arrowStyle: e.target.value });
  });

  mateStyleSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ mateStyle: e.target.value });
  });

  phonkCheckbox.addEventListener("change", (e) => {
    chrome.storage.local.set({ phonkEditEnabled: e.target.checked });
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