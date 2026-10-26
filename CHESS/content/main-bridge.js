(function () {
  const activeGameSockets = [];
  const NativeWebSocket = window.WebSocket;
  const nativeToString = NativeWebSocket.toString.bind(NativeWebSocket);

  if (NativeWebSocket.name === "PatchedWebSocket" || String(NativeWebSocket).includes("PatchedWebSocket")) {
    return;
  }

  function PatchedWebSocket(url, protocols) {
    const ws = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);

    try {
      const urlStr = String(url || "");
      if (urlStr.includes("socket.lichess.org") || urlStr.includes("/play/") || urlStr.includes("sri=")) {
        activeGameSockets.push(ws);
        if (activeGameSockets.length > 8) activeGameSockets.shift();
      }

      const origSend = ws.send.bind(ws);
      ws.send = function (payload) {
        if (ws.readyState === 1 && !activeGameSockets.includes(ws)) {
          activeGameSockets.push(ws);
          if (activeGameSockets.length > 8) activeGameSockets.shift();
        }
        return origSend(payload);
      };
    } catch (err) {}

    return ws;
  }

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
    if (!secretChannel) return;

    window.removeEventListener("cc-hs-init", onStealthHandshake, true);

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