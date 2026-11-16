(function () {
  "use strict";

  const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

  function createPerformanceGovernor() {
    if (typeof requestAnimationFrame !== "function" || typeof performance === "undefined") {
      return { getMode: () => "normal", getSnapshot: () => ({ mode: "normal", p95FrameGap: 0, longTaskMs: 0 }) };
    }
    let mode = "normal";
    let gaps = [];
    let previousFrame = 0;
    let windowStarted = performance.now();
    let longTaskMs = 0;
    let badWindows = 0;
    let goodWindows = 0;
    let snapshot = { mode, p95FrameGap: 0, longTaskMs: 0 };

    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTaskMs += entry.duration;
      });
      observer.observe({ type: "longtask", buffered: false });
    } catch (e) {}

    const tick = now => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        if (previousFrame > 0) {
          const gap = now - previousFrame;
          if (gap < 1000) gaps.push(gap);
        }
        previousFrame = now;
        if (now - windowStarted >= 5000) {
          const sorted = gaps.slice().sort((a, b) => a - b);
          const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
          const critical = p95 > 55 || longTaskMs > 400;
          const constrained = critical || p95 > 34 || longTaskMs > 150;
          if (constrained) { badWindows++; goodWindows = 0; }
          else { goodWindows++; badWindows = 0; }
          if (critical && badWindows >= 2) mode = "critical";
          else if (constrained && badWindows >= 2 && mode === "normal") mode = "constrained";
          else if (!constrained && goodWindows >= 3) mode = "normal";
          snapshot = { mode, p95FrameGap: Math.round(p95 * 10) / 10, longTaskMs: Math.round(longTaskMs) };
          gaps = [];
          longTaskMs = 0;
          windowStarted = now;
        }
      } else {
        previousFrame = 0;
        gaps = [];
        longTaskMs = 0;
        windowStarted = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { getMode: () => mode, getSnapshot: () => ({ ...snapshot }) };
  }

  const performanceGovernor = createPerformanceGovernor();

  let engineSourcePromise = null;

  function getEngineSource() {
    if (!engineSourcePromise) {
      engineSourcePromise = fetch(chrome.runtime.getURL("lib/stockfish-local.js")).then(response => {
        if (!response.ok) throw new Error("Stockfish could not be loaded");
        return response.text();
      }).catch(error => {
        engineSourcePromise = null;
        throw error;
      });
    }
    return engineSourcePromise;
  }

  function createLane({ isEnabled = () => true, hashMb: requestedHashMb = null, laneName = "primary" } = {}) {
    const detectedMemory = Number(navigator.deviceMemory);
    const fallbackHash = Number.isFinite(detectedMemory)
      ? (detectedMemory <= 2 ? 32 : detectedMemory <= 4 ? 64 : detectedMemory >= 16 ? 256 : 128)
      : 64;
    const hashMb = Math.max(16, Math.min(256, Number(requestedHashMb) || fallbackHash));
    let worker = null;
    let blobUrl = null;
    let ready = false;
    let initPromise = null;
    let initResolve = null;
    let initTimer = null;
    let generation = 0;
    let phase = "idle";
    let activeJob = null;
    let pendingJob = null;
    let drainTimer = null;
    let previousMoves = null;
    let configuredMultiPv = 1;

    function settle(job, result) {
      if (!job || job.settled) return;
      job.settled = true;
      clearTimeout(job.timer);
      job.resolve(result);
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

    function terminate() {
      generation++;
      clearTimeout(initTimer);
      clearTimeout(drainTimer);
      initTimer = drainTimer = null;
      settle(activeJob, null);
      settle(pendingJob, null);
      activeJob = pendingJob = null;
      if (worker) {
        try { worker.terminate(); } catch (e) {}
      }
      worker = null;
      ready = false;
      phase = "idle";
      previousMoves = null;
      configuredMultiPv = 1;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      if (initResolve) initResolve(false);
      initResolve = null;
      initPromise = null;
    }

    function stopActive() {
      if (!activeJob || phase === "stopping") return;
      settle(activeJob, null);
      if (phase === "searching") {
        phase = "stopping";
        try {
          worker.postMessage("stop");
          // readyok does not drain a search: wait for its bestmove before reusing the worker.
          drainTimer = setTimeout(terminate, 2500);
        } catch (e) {
          terminate();
        }
      }
    }

    function cancel() {
      settle(pendingJob, null);
      pendingJob = null;
      stopActive();
    }

    function pump() {
      if (!ready || !worker || activeJob || !pendingJob) return;
      if (!isEnabled()) {
        cancel();
        return;
      }
      activeJob = pendingJob;
      pendingJob = null;
      phase = "sync";
      try {
        const job = activeJob;
        const moves = job.useStartposMoves ? job.uciMoves : null;
        if (moves && (!previousMoves || moves.length < previousMoves.length || previousMoves.some((m, i) => moves[i] !== m))) {
          worker.postMessage("ucinewgame");
        }
        previousMoves = moves;
        if (configuredMultiPv !== job.multiPv) {
          worker.postMessage(`setoption name MultiPV value ${job.multiPv}`);
          configuredMultiPv = job.multiPv;
        }
        worker.postMessage("isready");
        job.timer = setTimeout(terminate, 5000);
      } catch (e) {
        terminate();
      }
    }

    function handleLine(line) {
      line = line.trim();
      if (!line) return;
      if (line === "uciok" && phase === "uci") {
        phase = "initializing";
        worker.postMessage("setoption name Threads value 1");
        worker.postMessage(`setoption name Hash value ${hashMb}`);
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
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          blobUrl = null;
          if (initResolve) initResolve(true);
          initResolve = null;
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
            settle(job, { bestUci: lines[1]?.uci || null, lines, hashMb, lane: laneName });
            stopActive();
          }, job.movetimeMs + 1500);
        }
        return;
      }

      if (!activeJob) return;
      if (line.startsWith("bestmove ")) {
        if (phase !== "searching" && phase !== "stopping") return;
        clearTimeout(drainTimer);
        drainTimer = null;
        const job = activeJob;
        const uci = line.split(/\s+/)[1];
        const bestUci = UCI_MOVE.test(uci) ? uci : null;
        const lines = selectLines(job, bestUci);
        activeJob = null;
        phase = "idle";
        settle(job, { bestUci, lines, hashMb, lane: laneName });
        pump();
        return;
      }
      if (phase !== "searching" || !line.startsWith("info ") || /\b(?:lowerbound|upperbound)\b/.test(line)) return;
      const pvMatch = line.match(/\bpv\s+(.+)$/);
      const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
      if (!pvMatch || !scoreMatch) return;
      const moves = pvMatch[1].trim().split(/\s+/).filter(m => UCI_MOVE.test(m));
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
        pvChain: moves.slice(0, 4).map(m => `${m.slice(0, 2)}\u2192${m.slice(2, 4)}${m[4] ? `=${m[4].toUpperCase()}` : ""}`).join(" \u2794 ")
      };
      while (activeJob.depthLines.size > 4) {
        activeJob.depthLines.delete(Math.min(...activeJob.depthLines.keys()));
      }
    }

    function initWorker() {
      if (!isEnabled()) return Promise.resolve(false);
      if (worker && ready) return Promise.resolve(true);
      if (initPromise) return initPromise;
      const token = generation;
      initPromise = new Promise(resolve => { initResolve = resolve; });
      initTimer = setTimeout(terminate, 15000);
      (async () => {
        try {
          const code = await getEngineSource();
          if (token !== generation || !isEnabled()) {
            if (token === generation) terminate();
            return;
          }
          blobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
          const currentWorker = new Worker(blobUrl);
          worker = currentWorker;
          phase = "uci";
          currentWorker.onmessage = event => {
            if (worker !== currentWorker) return;
            try {
              const lines = Array.isArray(event.data) ? event.data : String(event.data || "").split(/\r?\n/);
              lines.forEach(line => handleLine(String(line)));
            } catch (e) {
              terminate();
            }
          };
          currentWorker.onerror = currentWorker.onmessageerror = () => {
            if (worker === currentWorker) terminate();
          };
          worker.postMessage("uci");
        } catch (e) {
          if (token === generation) terminate();
        }
      })();
      return initPromise;
    }

    function analyze(fen, movetimeMs = 190, multiPv = 3, uciMoves = [], useStartposMoves = false) {
      if (!isEnabled() || typeof fen !== "string" || !fen.trim() || /[\r\n]/.test(fen)) return Promise.resolve(null);
      return new Promise(resolve => {
        settle(pendingJob, null);
        const moves = Array.isArray(uciMoves) ? uciMoves.slice() : [];
        const actualTurn = fen.trim().split(/\s+/)[1];
        pendingJob = {
          fen,
          movetimeMs: Math.max(20, Math.min(10000, Number(movetimeMs) || 190)),
          multiPv: Math.max(1, Math.min(3, Number(multiPv) || 1)),
          uciMoves: moves,
          useStartposMoves: Boolean(useStartposMoves && moves.every(m => UCI_MOVE.test(m)) && actualTurn === (moves.length % 2 ? "b" : "w")),
          depthLines: new Map(),
          resolve,
          settled: false,
          timer: null
        };
        stopActive();
        initWorker();
        pump();
      });
    }

    return { initWorker, analyze, cancel, terminate, isReady: () => ready, getHashMb: () => hashMb };
  }

  function getLegacyResourceProfile() {
    const memoryValue = Number(navigator.deviceMemory);
    const coresValue = Number(navigator.hardwareConcurrency);
    const memory = Number.isFinite(memoryValue) ? memoryValue : null;
    const logicalCores = Number.isFinite(coresValue) ? Math.max(1, Math.floor(coresValue)) : 2;
    const mobile = Boolean(navigator.userAgentData?.mobile) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
    const primaryHashMb = memory === null ? 64 : memory <= 2 ? 32 : memory <= 4 ? 64 : memory < 16 ? 128 : 256;
    const dualWorker = !mobile && memory !== null && memory >= 8 && logicalCores >= 6;
    const verifierHashMb = dualWorker ? 64 : 0;
    return {
      memoryGb: memory,
      logicalCores,
      mobile,
      dualWorker,
      primaryHashMb,
      verifierHashMb,
      totalHashMb: primaryHashMb + verifierHashMb
    };
  }

  function mergeLaneResults(primary, verifier, resources) {
    if (!primary && !verifier) return null;
    if (!primary) {
      return { ...verifier, workers: 1, coresUsed: 1, consensus: "verifier-only", resources };
    }
    if (!verifier || !verifier.lines?.[1]) {
      return { ...primary, workers: 1, coresUsed: 1, consensus: "primary-only", resources };
    }

    const primaryLine = primary.lines?.[1] || null;
    const verifierLines = Object.values(verifier.lines).filter(Boolean);
    const matchingVerifier = primaryLine
      ? verifierLines.find(line => line.uci === primaryLine.uci)
      : null;
    const ordered = [];
    if (primaryLine) {
      ordered.push(matchingVerifier
        ? { ...matchingVerifier, primaryDepth: primaryLine.depth, primaryNps: primaryLine.nps, primaryHashFull: primaryLine.hashFull }
        : primaryLine);
    }
    for (const line of verifierLines) {
      if (!ordered.some(existing => existing.uci === line.uci)) ordered.push(line);
      if (ordered.length >= 3) break;
    }
    const lines = Object.fromEntries(ordered.map((line, index) => [index + 1, line]));
    const verifierTop = verifier.lines[1];
    return {
      bestUci: primary.bestUci || lines[1]?.uci || null,
      lines,
      primaryLine,
      verifierLines: verifier.lines,
      hashMb: primary.hashMb + verifier.hashMb,
      primaryHashMb: primary.hashMb,
      verifierHashMb: verifier.hashMb,
      workers: 2,
      coresUsed: 2,
      consensus: matchingVerifier
        ? (verifierTop?.uci === primaryLine?.uci ? "strong" : "weak")
        : "split",
      resources
    };
  }

  function createLegacyEngine({ isEnabled = () => true } = {}) {
    const resources = getLegacyResourceProfile();
    const primary = createLane({ isEnabled, hashMb: resources.primaryHashMb, laneName: "primary" });
    const verifier = resources.dualWorker
      ? createLane({ isEnabled, hashMb: resources.verifierHashMb, laneName: "verifier" })
      : null;

    async function analyze(fen, movetimeMs = 190, multiPv = 3, uciMoves = [], useStartposMoves = false, meta = null) {
      const time = Math.max(20, Math.min(10000, Number(movetimeMs) || 190));
      const pageVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
      const verifierNeeded = Boolean(meta?.engineMaxMode || meta?.isDangerPosition || meta?.criticalDecision);
      const useVerifier = Boolean(verifier && pageVisible && time >= 180 && verifierNeeded && meta?.performanceMode !== "critical");
      if (!useVerifier) {
        const primaryMultiPv = Math.max(1, Math.min(2, Number(multiPv) || 1));
        const result = await primary.analyze(fen, time, primaryMultiPv, uciMoves, useStartposMoves);
        return result ? { ...result, workers: 1, coresUsed: 1, consensus: "primary-only", resources } : null;
      }

      const verifierTime = Math.max(150, Math.round(time * 0.75));
      const [primaryResult, verifierResult] = await Promise.all([
        primary.analyze(fen, time, 1, uciMoves, useStartposMoves),
        verifier.analyze(fen, verifierTime, Math.max(2, Math.min(3, Number(multiPv) || 1)), uciMoves, useStartposMoves)
      ]);
      return mergeLaneResults(primaryResult, verifierResult, resources);
    }

    function cancel() {
      primary.cancel();
      verifier?.cancel();
    }

    function terminate() {
      primary.terminate();
      verifier?.terminate();
    }

    return {
      initWorker: () => primary.initWorker(),
      analyze,
      cancel,
      terminate,
      isReady: () => primary.isReady(),
      getHashMb: () => resources.totalHashMb,
      getResourceProfile: () => ({ ...resources })
    };
  }

  function getPreferredResourceProfile() {
    const legacy = getLegacyResourceProfile();
    const fullEligible = legacy.memoryGb !== null && legacy.memoryGb >= 8 &&
      Boolean(typeof chrome !== "undefined" && chrome.runtime?.sendMessage);
    if (!fullEligible) return { ...legacy, backend: "stockfish-19-lite-asm", fullNnue: false };
    const hashMb = legacy.memoryGb >= 16 ? 64 : 32;
    return {
      memoryGb: legacy.memoryGb,
      logicalCores: legacy.logicalCores,
      mobile: legacy.mobile,
      dualWorker: false,
      primaryHashMb: hashMb,
      verifierHashMb: 0,
      totalHashMb: hashMb,
      backend: "stockfish-19-full-single-wasm",
      fullNnue: true
    };
  }

  function sendEngineMessage(message, timeoutMs = 55000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Engine service timeout"));
      }, timeoutMs);
      try {
        chrome.runtime.sendMessage({ ...message, target: "background-engine" }, response => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response || { ok: false, code: "EMPTY_ENGINE_RESPONSE" });
        });
      } catch (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  function create({ isEnabled = () => true } = {}) {
    const preferredResources = getPreferredResourceProfile();
    const fullEligible = preferredResources.fullNnue;
    const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    let requestSequence = 0;
    let generation = 0;
    let activeRequestId = null;
    let fullUnavailable = !fullEligible;
    let fullReady = false;
    let legacyEngine = null;

    function getLegacy() {
      if (!legacyEngine) legacyEngine = createLegacyEngine({ isEnabled });
      return legacyEngine;
    }

    function nextRequestId(prefix) {
      return `${instanceId}:${prefix}:${++requestSequence}`;
    }

    async function initWorker() {
      if (!isEnabled()) return false;
      if (fullUnavailable) return getLegacy().initWorker();
      const requestId = nextRequestId("init");
      try {
        const response = await sendEngineMessage({
          type: "ENGINE_INIT",
          requestId,
          hashMb: preferredResources.primaryHashMb
        });
        if (!response?.ok) throw new Error(response?.code || "Full engine initialization failed");
        fullReady = true;
        return true;
      } catch (error) {
        fullUnavailable = true;
        fullReady = false;
        return getLegacy().initWorker();
      }
    }

    async function analyze(fen, movetimeMs = 190, multiPv = 3, uciMoves = [], useStartposMoves = false, meta = null) {
      if (!isEnabled()) return null;
      const token = ++generation;
      const moves = Array.isArray(uciMoves) ? uciMoves.slice() : [];
      const effectiveMeta = { ...(meta || {}), performanceMode: performanceGovernor.getMode() };
      if (!fullUnavailable) {
        const requestId = nextRequestId("analyze");
        activeRequestId = requestId;
        try {
          const response = await sendEngineMessage({
            type: "ENGINE_ANALYZE",
            requestId,
            fen,
            movetimeMs: Math.max(20, Math.min(10000, Number(movetimeMs) || 190)),
            multiPv: Math.max(1, Math.min(3, Number(multiPv) || 1)),
            uciMoves: moves,
            useStartposMoves: Boolean(useStartposMoves),
            hashMb: preferredResources.primaryHashMb,
            meta: effectiveMeta
          }, Math.max(55000, Number(movetimeMs) + 15000));
          if (token !== generation) return null;
          activeRequestId = null;
          if (response?.ok && response.result) {
            fullReady = true;
            return { ...response.result, backend: response.backend || preferredResources.backend, resources: preferredResources, meta: effectiveMeta };
          }
          if (["CANCELLED", "SUPERSEDED", "RELEASED"].includes(response?.code)) return null;
          throw new Error(response?.error || response?.code || "Full engine analysis failed");
        } catch (error) {
          if (token !== generation) return null;
          activeRequestId = null;
          fullUnavailable = true;
          fullReady = false;
        }
      }

      const result = await getLegacy().analyze(fen, movetimeMs, multiPv, moves, useStartposMoves, effectiveMeta);
      if (token !== generation) return null;
      return result ? { ...result, backend: "stockfish-19-lite-asm", meta: effectiveMeta } : null;
    }

    function cancel() {
      generation++;
      activeRequestId = null;
      if (!fullUnavailable) {
        void sendEngineMessage({ type: "ENGINE_CANCEL", requestId: nextRequestId("cancel") }, 5000).catch(() => {});
      }
      legacyEngine?.cancel();
    }

    function terminate() {
      generation++;
      activeRequestId = null;
      if (!fullUnavailable) {
        void sendEngineMessage({ type: "ENGINE_RELEASE", requestId: nextRequestId("release") }, 5000).catch(() => {});
      }
      legacyEngine?.terminate();
      legacyEngine = null;
      fullReady = false;
    }

    return {
      initWorker,
      analyze,
      cancel,
      terminate,
      isReady: () => fullReady || Boolean(legacyEngine?.isReady()),
      getHashMb: () => fullUnavailable ? getLegacyResourceProfile().totalHashMb : preferredResources.totalHashMb,
      getResourceProfile: () => fullUnavailable
        ? { ...getLegacyResourceProfile(), backend: "stockfish-19-lite-asm", fullNnue: false }
        : { ...preferredResources }
    };
  }

  window.ChessCoachEngine = {
    create,
    getResourceProfile: getPreferredResourceProfile,
    getPerformanceMode: () => performanceGovernor.getMode(),
    getPerformanceSnapshot: () => performanceGovernor.getSnapshot()
  };
})();
