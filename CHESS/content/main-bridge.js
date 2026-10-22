(function () {
  if (window.__ccMainBridgeInstalled) return;
  window.__ccMainBridgeInstalled = true;

  let activeGameSockets = [];
  let lastAckedPly = 0;

  const NativeWebSocket = window.WebSocket;

  function PatchedWebSocket(url, protocols) {
    const ws = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);

    try {
      const urlStr = String(url || "");
      if (urlStr.includes("socket.lichess.org") || urlStr.includes("/play/") || urlStr.includes("sri=")) {
        activeGameSockets.push(ws);
        if (activeGameSockets.length > 8) activeGameSockets.shift();

        ws.addEventListener("message", (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data && typeof data.v === "number") {
              lastAckedPly = data.v;
            }
            if (data && data.t === "Move" && typeof data.v === "number") {
              lastAckedPly = data.v;
            }
          } catch (e) {}
        });
      }

      const origSend = ws.send.bind(ws);
      ws.send = function (payload) {
        if (ws.readyState === 1 && !activeGameSockets.includes(ws)) {
          activeGameSockets.push(ws);
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
  window.WebSocket = PatchedWebSocket;

  // Слушаем команду от нашего Content Script на выполнение хода
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "CC_REWORK_CONTENT") return;

    if (event.data.type === "CC_EXECUTE_MAIN_MOVE") {
      const { from, to, isPromotion } = event.data;
      const uci = isPromotion ? `${from}${to}q` : `${from}${to}`;
      let sentViaSocket = false;

      // 1. Пробуем отправить ход напрямую в открытый WebSocket партии Lichess (работает даже в свернутой вкладке!)
      for (let i = activeGameSockets.length - 1; i >= 0; i--) {
        const ws = activeGameSockets[i];
        if (ws && ws.readyState === 1) {
          try {
            const movePacket = JSON.stringify({
              t: "move",
              d: {
                u: uci,
                b: 1
              }
            });
            ws.send(movePacket);
            sentViaSocket = true;
            break;
          } catch (e) {}
        }
      }

      window.postMessage(
        {
          source: "CC_REWORK_MAIN",
          type: "CC_MAIN_MOVE_RESULT",
          uci,
          sentViaSocket
        },
        "*"
      );
    }
  });
})();