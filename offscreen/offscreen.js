(function () {
  "use strict";

  const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  const BACKEND = "stockfish-19-full-single-wasm";
  const MAX_QUEUE = 8;
  const IDLE_CLOSE_MS = 3 * 60 * 1000;

  let worker = null;
  let ready = false;
  let phase = "idle";
  let generation = 0;
  let initPromise = null;
  let initResolve = null;
  let initReject = null;
  let initTimer = null;
  let drainTimer = null;
  let idleTimer = null;
  let idleEpoch = 0;
  let configuredHashMb = 64;
  let configuredMultiPv = 1;
  let previousMoves = null;
  let activeJob = null;
  const queue = [];
  const resultCache = new Map();
  const RESULT_CACHE_LIMIT = 48;

  function getCacheKey(job) {
    const history = job.useStartposMoves ? job.uciMoves.join(" ") : "fen";
    const timeBucket = Math.ceil(job.movetimeMs / 250) * 250;
    return `${job.fen}|${history}|${job.multiPv}|${timeBucket}|${configuredHashMb}`;
  }

  function cacheResult(job, result) {
    if (!result?.bestUci) return;
    const key = getCacheKey(job);
    resultCache.delete(key);
    resultCache.set(key, { ...result, meta: null });
    while (resultCache.size > RESULT_CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value);
  }

  function response(ok, requestId, extra = {}) {
    return { ok, requestId, backend: BACKEND, ...extra };
  }

  function settle(job, payload) {
    if (!job || job.settled) return;
    job.settled = true;
    clearTimeout(job.timer);
    try { job.sendResponse(payload); } catch (e) {}
  }

  function clearEngineTimers() {
    clearTimeout(initTimer);
    clearTimeout(drainTimer);
    initTimer = null;
    drainTimer = null;
  }

  function scheduleIdleClose() {
    clearTimeout(idleTimer);
    if (activeJob || queue.length) return;
    const epoch = ++idleEpoch;
    idleTimer = setTimeout(() => {
      if (activeJob || queue.length || epoch !== idleEpoch) return;
      chrome.runtime.sendMessage({ target: "background-engine", type: "ENGINE_OFFSCREEN_IDLE", epoch }, () => void chrome.runtime.lastError);
    }, IDLE_CLOSE_MS);
  }

  function failEngine(message) {
    generation++;
    clearEngineTimers();
    if (worker) {
      try { worker.terminate(); } catch (e) {}
    }
    worker = null;
    ready = false;
    phase = "idle";
    previousMoves = null;
    configuredMultiPv = 1;
    settle(activeJob, response(false, activeJob?.requestId, { code: "ENGINE_CRASH", error: message }));
    activeJob = null;
    while (queue.length) {
      const job = queue.shift();
      settle(job, response(false, job.requestId, { code: "ENGINE_CRASH", error: message }));
    }
    if (initReject) initReject(new Error(message));
    initResolve = null;
    initReject = null;
    initPromise = null;
    scheduleIdleClose();
  }

  function selectLines(job, bestUci = null) {
    const depths = [...job.depthLines.keys()].sort((a, b) => b - a);
    let deepestPartial = {};
    for (const depth of depths) {
      const lines = job.depthLines.get(depth);
      if (!lines[1] || (bestUci && lines[1].uci !== bestUci)) continue;
      const contiguous = {};
      for (let index = 1; index <= job.multiPv; index++) {
        if (!lines[index]) break;
        contiguous[index] = lines[index];
      }
      if (!deepestPartial[1] && contiguous[1]) deepestPartial = contiguous;
      if (Object.keys(contiguous).length >= job.multiPv) return contiguous;
    }
    return deepestPartial;
  }

  function finishActiveFromBestMove(bestUci) {
    const job = activeJob;
    if (!job) return;
    const lines = selectLines(job, bestUci);
    activeJob = null;
    phase = "idle";
    const result = {
        bestUci,
        lines,
        primaryLine: lines[1] || null,
        workers: 1,
        coresUsed: 1,
        hashMb: configuredHashMb,
        consensus: "full-nnue",
        backend: BACKEND,
        meta: job.meta,
        resources: { fullNnue: true, primaryHashMb: configuredHashMb, totalHashMb: configuredHashMb, dualWorker: false }
      };
    cacheResult(job, result);
    settle(job, response(true, job.requestId, { result }));
    pump();
  }

  function handleLine(rawLine) {
    const line = String(rawLine || "").trim();
    if (!line) return;

    if (line === "uciok" && phase === "uci") {
      phase = "initializing";
      worker.postMessage("setoption name Threads value 1");
      worker.postMessage(`setoption name Hash value ${configuredHashMb}`);
      worker.postMessage("setoption name UCI_ShowWDL value true");
      worker.postMessage("isready");
      return;
    }

    if (line === "readyok") {
      if (phase === "initializing") {
        clearTimeout(initTimer);
        initTimer = null;
        ready = true;
        phase = "idle";
        initResolve?.(true);
        initResolve = null;
        initReject = null;
        pump();
      } else if (phase === "sync" && activeJob) {
        clearTimeout(activeJob.timer);
        if (activeJob.settled) {
          activeJob = null;
          phase = "idle";
          pump();
          return;
        }
        const job = activeJob;
        const position = job.useStartposMoves
          ? `position startpos${job.uciMoves.length ? ` moves ${job.uciMoves.join(" ")}` : ""}`
          : `position fen ${job.fen}`;
        phase = "searching";
        worker.postMessage(position);
        worker.postMessage(`go movetime ${job.movetimeMs}`);
        job.timer = setTimeout(() => {
          if (activeJob !== job || phase !== "searching") return;
          const lines = selectLines(job);
          const result = {
              bestUci: lines[1]?.uci || null,
              lines,
              primaryLine: lines[1] || null,
              workers: 1,
              coresUsed: 1,
              hashMb: configuredHashMb,
              consensus: "full-nnue-timeout",
              backend: BACKEND,
              meta: job.meta,
              resources: { fullNnue: true, primaryHashMb: configuredHashMb, totalHashMb: configuredHashMb, dualWorker: false }
            };
          cacheResult(job, result);
          settle(job, response(true, job.requestId, { result }));
          phase = "stopping";
          try { worker.postMessage("stop"); } catch (e) { failEngine(String(e)); }
          drainTimer = setTimeout(() => failEngine("Stockfish stop timeout"), 3500);
        }, job.movetimeMs + 2500);
      }
      return;
    }

    if (!activeJob) return;
    if (line.startsWith("bestmove ")) {
      if (phase !== "searching" && phase !== "stopping") return;
      clearTimeout(drainTimer);
      drainTimer = null;
      const uci = line.split(/\s+/)[1];
      finishActiveFromBestMove(UCI_MOVE.test(uci) ? uci : null);
      return;
    }

    if (phase !== "searching" || !line.startsWith("info ") || /\b(?:lowerbound|upperbound)\b/.test(line)) return;
    const pvMatch = line.match(/\bpv\s+(.+)$/);
    const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
    if (!pvMatch || !scoreMatch) return;
    const moves = pvMatch[1].trim().split(/\s+/).filter(move => UCI_MOVE.test(move));
    if (!moves.length) return;
    const depth = Number(line.match(/\bdepth\s+(\d+)/)?.[1]) || 0;
    const index = Number(line.match(/\bmultipv\s+(\d+)/)?.[1]) || 1;
    if (index > activeJob.multiPv) return;
    const isMate = scoreMatch[1] === "mate";
    const value = Number(scoreMatch[2]);
    const scoreCp = isMate ? (value > 0 ? 30000 - value * 20 : -30000 - value * 20) : value;
    const wdlMatch = line.match(/\bwdl\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!activeJob.depthLines.has(depth)) activeJob.depthLines.set(depth, {});
    activeJob.depthLines.get(depth)[index] = {
      uci: moves[0],
      from: moves[0].slice(0, 2),
      to: moves[0].slice(2, 4),
      promo: moves[0][4] || null,
      depth,
      selDepth: Number(line.match(/\bseldepth\s+(\d+)/)?.[1]) || depth,
      nodes: Number(line.match(/\bnodes\s+(\d+)/)?.[1]) || 0,
      nps: Number(line.match(/\bnps\s+(\d+)/)?.[1]) || 0,
      hashFull: Number(line.match(/\bhashfull\s+(\d+)/)?.[1]) || 0,
      scoreCp,
      isMate,
      mateIn: isMate ? value : null,
      pv: moves.slice(0, 12),
      wdl: wdlMatch ? wdlMatch.slice(1).map(Number) : null,
      pvChain: moves.slice(0, 4).map(move => `${move.slice(0, 2)}→${move.slice(2, 4)}${move[4] ? `=${move[4].toUpperCase()}` : ""}`).join(" ➔ ")
    };
    while (activeJob.depthLines.size > 6) activeJob.depthLines.delete(Math.min(...activeJob.depthLines.keys()));
  }

  function ensureEngine(hashMb = 64) {
    if (worker && ready) return Promise.resolve(true);
    if (initPromise) return initPromise;
    configuredHashMb = Math.max(16, Math.min(128, Number(hashMb) || 64));
    const token = generation;
    initPromise = new Promise((resolve, reject) => {
      initResolve = resolve;
      initReject = reject;
    });
    initTimer = setTimeout(() => {
      if (token === generation) failEngine("Full Stockfish initialization timeout");
    }, 45000);
    try {
      const currentWorker = new Worker(chrome.runtime.getURL("vendor/stockfish/stockfish-19-single.js"));
      worker = currentWorker;
      phase = "uci";
      currentWorker.onmessage = event => {
        if (worker !== currentWorker) return;
        const lines = Array.isArray(event.data) ? event.data : String(event.data || "").split(/\r?\n/);
        for (const line of lines) handleLine(line);
      };
      currentWorker.onerror = event => {
        if (worker === currentWorker) failEngine(event.message || "Full Stockfish worker error");
      };
      currentWorker.onmessageerror = () => {
        if (worker === currentWorker) failEngine("Full Stockfish message error");
      };
      currentWorker.postMessage("uci");
    } catch (error) {
      failEngine(String(error?.message || error));
    }
    return initPromise;
  }

  function cancelClient(clientKey, code = "CANCELLED") {
    for (let index = queue.length - 1; index >= 0; index--) {
      if (queue[index].clientKey !== clientKey) continue;
      const job = queue.splice(index, 1)[0];
      settle(job, response(false, job.requestId, { code }));
    }
    if (!activeJob || activeJob.clientKey !== clientKey) {
      scheduleIdleClose();
      return;
    }
    const job = activeJob;
    settle(job, response(false, job.requestId, { code }));
    if (phase === "searching") {
      phase = "stopping";
      try { worker.postMessage("stop"); } catch (e) { failEngine(String(e)); }
      clearTimeout(drainTimer);
      drainTimer = setTimeout(() => failEngine("Stockfish cancellation timeout"), 3500);
    } else if (phase === "sync") {
      activeJob = null;
      phase = "idle";
      pump();
    }
  }

  function enqueue(job) {
    clearTimeout(idleTimer);
    idleEpoch++;
    const cached = resultCache.get(getCacheKey(job));
    if (cached) {
      resultCache.delete(getCacheKey(job));
      resultCache.set(getCacheKey(job), cached);
      settle(job, response(true, job.requestId, { result: { ...cached, meta: job.meta, cached: true, consensus: "full-nnue-cache" } }));
      scheduleIdleClose();
      return;
    }
    for (let index = queue.length - 1; index >= 0; index--) {
      if (queue[index].clientKey !== job.clientKey) continue;
      settle(queue[index], response(false, queue[index].requestId, { code: "SUPERSEDED" }));
      queue.splice(index, 1);
    }
    if (activeJob?.clientKey === job.clientKey) cancelClient(job.clientKey, "SUPERSEDED");
    queue.push(job);
    while (queue.length > MAX_QUEUE) {
      const dropped = queue.shift();
      settle(dropped, response(false, dropped.requestId, { code: "QUEUE_FULL" }));
    }
    ensureEngine(job.hashMb).then(pump).catch(error => {
      settle(job, response(false, job.requestId, { code: "ENGINE_INIT_FAILED", error: String(error?.message || error) }));
    });
  }

  function pump() {
    if (!ready || !worker || activeJob || phase !== "idle") return;
    while (queue.length && queue[0].expiresAt <= Date.now()) {
      const expired = queue.shift();
      settle(expired, response(false, expired.requestId, { code: "EXPIRED" }));
    }
    if (!queue.length) {
      scheduleIdleClose();
      return;
    }
    activeJob = queue.shift();
    const job = activeJob;
    phase = "sync";
    const moves = job.useStartposMoves ? job.uciMoves : null;
    if (moves && (!previousMoves || moves.length < previousMoves.length || previousMoves.some((move, index) => moves[index] !== move))) {
      worker.postMessage("ucinewgame");
    }
    previousMoves = moves;
    if (configuredMultiPv !== job.multiPv) {
      worker.postMessage(`setoption name MultiPV value ${job.multiPv}`);
      configuredMultiPv = job.multiPv;
    }
    worker.postMessage("isready");
    job.timer = setTimeout(() => {
      if (activeJob === job && phase === "sync") failEngine("Stockfish ready timeout");
    }, 8000);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== "offscreen-engine") return false;
    clearTimeout(idleTimer);
    idleEpoch++;
    const requestId = String(message.requestId || "");
    const clientKey = String(message.clientKey || "unknown");

    if (message.type === "ENGINE_INIT") {
      ensureEngine(message.hashMb).then(() => {
        sendResponse(response(true, requestId, { status: { ready, backend: BACKEND, hashMb: configuredHashMb } }));
      }).catch(error => {
        sendResponse(response(false, requestId, { code: "ENGINE_INIT_FAILED", error: String(error?.message || error) }));
      });
      return true;
    }

    if (message.type === "ENGINE_STATUS") {
      sendResponse(response(true, requestId, { status: { ready, phase, backend: BACKEND, hashMb: configuredHashMb, queueLength: queue.length, busy: Boolean(activeJob) } }));
      scheduleIdleClose();
      return false;
    }

    if (message.type === "ENGINE_CANCEL" || message.type === "ENGINE_RELEASE") {
      cancelClient(clientKey, message.type === "ENGINE_RELEASE" ? "RELEASED" : "CANCELLED");
      sendResponse(response(true, requestId, { cancelled: true }));
      return false;
    }

    if (message.type !== "ENGINE_ANALYZE") return false;
    const job = {
      requestId,
      clientKey,
      fen: message.fen,
      movetimeMs: message.movetimeMs,
      multiPv: message.multiPv,
      uciMoves: Array.isArray(message.uciMoves) ? message.uciMoves.slice() : [],
      useStartposMoves: Boolean(message.useStartposMoves),
      hashMb: message.hashMb,
      meta: message.meta || null,
      depthLines: new Map(),
      settled: false,
      timer: null,
      expiresAt: Date.now() + message.movetimeMs + 20000,
      sendResponse
    };
    enqueue(job);
    return true;
  });

  scheduleIdleClose();
})();
