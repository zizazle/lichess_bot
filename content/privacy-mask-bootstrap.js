(function () {
  "use strict";

  const STYLE_ID = "cc-privacy-mask-bootstrap-style";
  const PLAYER_ROOTS = [
    ".board-layout-top", ".board-layout-bottom",
    ".player-component.player-top", ".player-component.player-bottom",
    ".player-tagline-top", ".player-tagline-bottom",
    ".player-top", ".player-bottom"
  ].join(",");
  const PRIVATE_FIELDS = [
    "[data-test-element='user-tagline-username']",
    "[data-test-element='user-rating']",
    "[data-cy='user-tagline-username']",
    "[data-cy='user-tagline-rating']",
    ".user-tagline-username", ".user-username-component",
    ".user-tagline-rating", ".cc-user-username-white", ".cc-user-rating-white"
  ].join(",");

  function removeBootstrap() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function installBootstrap() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `:is(${PLAYER_ROOTS}) :is(${PRIVATE_FIELDS}) { opacity: 0 !important; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  try {
    chrome.storage.local.get(["chesscomVisualMaskV1"], result => {
      if (chrome.runtime.lastError) return;
      if (result?.chesscomVisualMaskV1?.enabled === true) installBootstrap();
      else removeBootstrap();
    });
  } catch (e) {}
})();
