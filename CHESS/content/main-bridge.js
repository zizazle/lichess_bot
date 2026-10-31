(function () {
  const activeGameSockets = [];
  const registeredChannels = new Set();
  const NativeWebSocket = window.WebSocket;
  const nativeToString = NativeWebSocket.toString.bind(NativeWebSocket);

  if (window.__ccMainBridgeInstalled) {
    return;
  }
  Object.defineProperty(window, "__ccMainBridgeInstalled", {
    value: true,
    configurable: false,
    enumerable: false
  });

  function pruneClosedSockets() {
    for (let i = activeGameSockets.length - 1; i >= 0; i--) {
      const s = activeGameSockets[i];
      if (!s || s.readyState === 2 || s.readyState === 3) {
        activeGameSockets.splice(i, 1);
      }
    }
  }

  function trackSocket(ws) {
    pruneClosedSockets();
    if (!activeGameSockets.includes(ws)) {
      activeGameSockets.push(ws);
      if (activeGameSockets.length > 8) {
        activeGameSockets.shift();
      }
    }
  }

  function PatchedWebSocket(url, protocols) {
    const ws = protocols !== undefined
      ? new NativeWebSocket(url, protocols)
      : new NativeWebSocket(url);

    try {
      const urlStr = String(url || "");
      if (urlStr.includes("socket.lichess.org") || urlStr.includes("/play/") || urlStr.includes("sri=")) {
        trackSocket(ws);
      }

      ws.addEventListener("close", pruneClosedSockets, { once: true });
      ws.addEventListener("error", pruneClosedSockets, { once: true });

      const origSend = ws.send.bind(ws);
      ws.send = function (payload) {
        if (ws.readyState === 1) {
          trackSocket(ws);
        }
        return origSend(payload);
      };
    } catch (err) {}

    return ws;
  }

  Object.setPrototypeOf(PatchedWebSocket, NativeWebSocket);
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
  PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;
  Object.defineProperty(PatchedWebSocket, "name", { value: "WebSocket", configurable: true });
  PatchedWebSocket.toString = function () {
    return nativeToString();
  };

  window.WebSocket = PatchedWebSocket;

  function sendMoveToActiveSocket(from, to, promo) {
    if (!from || !to) return;
    pruneClosedSockets();
    const uci = promo ? `${from}${to}${promo}` : `${from}${to}`;
    for (let i = activeGameSockets.length - 1; i >= 0; i--) {
      const ws = activeGameSockets[i];
      if (ws && ws.readyState === 1) {
        try {
          ws.send(
            JSON.stringify({
              t: "move",
              d: { u: uci, b: 1 }
            })
          );
          break;
        } catch (e) {}
      }
    }
  }

  function onStealthHandshake(e) {
    e.stopImmediatePropagation();
    const secretChannel = document.documentElement.getAttribute("data-cc-hs");
    if (!secretChannel || registeredChannels.has(secretChannel)) return;
    registeredChannels.add(secretChannel);

    window.addEventListener(
      secretChannel,
      (moveEvent) => {
        moveEvent.stopImmediatePropagation();
        try {
          const payload = JSON.parse(moveEvent.detail || "{}");
          sendMoveToActiveSocket(payload.from, payload.to, payload.promo);
        } catch (err) {}
      },
      true
    );
  }

  window.addEventListener("cc-hs-init", onStealthHandshake, true);
})();