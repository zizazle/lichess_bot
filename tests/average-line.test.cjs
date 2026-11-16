"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const contentDir = path.resolve(__dirname, "../content");

// Exercise production expressions, merging and the cache-acceptance boundary.
// The DOM, native gestures and unrelated presentation helpers are not executed.
function createHarness(file) {
  const source = fs.readFileSync(path.join(contentDir, file), "utf8");
  const functionSource = name => {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1, `Missing ${name}`);
    const end = source.slice(start + 1).search(/\n  (?:async )?function /);
    assert.notEqual(end, -1, `Missing boundary after ${name}`);
    return source.slice(start, start + 1 + end);
  };
  const apply = functionSource("applyAnalysisResult");
  const assignment = apply.indexOf("    cachedMoves = ");
  assert.notEqual(assignment, -1);
  const applyBoundary = apply.slice(0, apply.indexOf(";", assignment) + 1) + "\n  }";
  const needAverage = source.match(/const needAvg = ([^;]+);/)[1];
  const buttonStart = source.indexOf('    $("cc-auto-test-avg").addEventListener("click", () => {');
  assert.notEqual(buttonStart, -1);
  const button = source.slice(buttonStart, source.indexOf("\n    });", buttonStart) + 8);
  const context = vm.createContext({
    FILES: "abcdefgh", engineMaxMode: false, currentElo: 1500, workMode: "all",
    showAverageMove: false, useAverageMoveSometimes: true, autoT1LimiterEnabled: false,
    trapRadarEnabled: false, currentStyle: "tal", positionId: 4, positionAnalysisId: 8,
    analysisSessionId: "session", currentPositionKey: "position", cachedMoves: null,
    normalizeEngineWdl: () => null,
    isNegativeMateMove: move => Boolean(move?.isMate && move.mateIn < 0),
    getStructuredMoveScore: move => ({ type: "cp", value: move?.scoreCp || 0 }),
    structuredScoreValue: score => score.value,
    updateBehavioralCheatDetector() {}, setAutoStatusText() {},
    captureBoardState: () => ({ animating: false }), isCachedAnalysisCurrent: () => true,
    executeMoveOnBoard() { context.executed++; }, executed: 0,
    $(id) { return { addEventListener(event, handler) { context.averageClick = handler; } }; }
  });
  context.usesStrictBestMovePolicy = () => context.engineMaxMode || context.currentElo >= 2000;
  context.isCurrentAnalysisMeta = meta => meta.positionId === context.positionId && meta.analysisId === context.positionAnalysisId;
  vm.runInContext(`${functionSource("mergeWasmAnalysisIntoResult")}\n${applyBoundary}\n${button}\nglobalThis.merge = mergeWasmAnalysisIntoResult; globalThis.apply = applyAnalysisResult; globalThis.needAverage = () => { const strictBestPolicy = usesStrictBestMovePolicy(); return ${needAverage}; };`, context, { filename: file });
  return context;
}

const move = (uci, scoreCp = 30) => ({ uci, from: uci.slice(0, 2), to: uci.slice(2, 4), scoreCp, evalPawns: (scoreCp / 100).toFixed(2), depth: 16 });
const state = { sideToAnalyze: "w", myColor: "w", actualTurn: "w", grid: Array.from({ length: 8 }, () => Array(8).fill(null)) };

for (const file of ["content.js", "chesscom.js"]) {
  test(`${file}: visible middle line is requested at every supported ELO`, () => {
    const api = createHarness(file);
    api.showAverageMove = true;
    api.useAverageMoveSometimes = false;
    for (const elo of [1999, 2000, 3000]) {
      api.currentElo = elo;
      assert.equal(api.needAverage(), true, `ELO ${elo}`);
    }
    api.engineMaxMode = true;
    assert.equal(api.needAverage(), false, "Engine MAX remains primary-only");
  });

  test(`${file}: hidden alternative still updates when mixing requested it`, () => {
    const api = createHarness(file);
    const best = move("e2e4"), alternate = move("d2d4", 15);
    const result = api.merge({ best: alternate, average: best }, { lines: { 1: best, 2: alternate } }, state);
    assert.equal(result.best.uci, best.uci);
    assert.equal(result.average.uci, alternate.uci);
    assert.equal(result.average.fromWasm, true);
  });

  test(`${file}: illegal, rejected and losing-mate alternatives are skipped`, () => {
    for (const baseExtra of [{ legalUcis: ["e2e4", "g1f3"] }, { hardRejectedUcis: ["d2d4"] }, { safeNonRepeatingUcis: ["e2e4", "g1f3"] }]) {
      const api = createHarness(file);
      const result = api.merge({ best: move("e2e4"), average: null, ...baseExtra }, { lines: { 1: move("e2e4"), 2: move("d2d4"), 3: move("g1f3") } }, state);
      assert.equal(result.average.uci, "g1f3");
    }
    const api = createHarness(file);
    const result = api.merge({ best: move("e2e4"), average: null }, { lines: { 1: move("e2e4"), 2: { ...move("d2d4"), isMate: true, mateIn: -2 }, 3: move("g1f3") } }, state);
    assert.equal(result.average.uci, "g1f3");
  });

  test(`${file}: a settings recalculation replaces the previous generation`, () => {
    const api = createHarness(file);
    api.cachedMoves = { positionId: 4, meta: { analysisId: 7 }, qualityRank: 50 };
    const average = move("d2d4");
    api.apply(state, { best: move("e2e4"), average, meta: { positionId: 4, analysisId: 8 } });
    assert.equal(api.cachedMoves.average.uci, average.uci);
    assert.equal(api.cachedMoves.qualityRank, 10);
  });

  test(`${file}: same-cycle quality and stale-response guards remain intact`, () => {
    const api = createHarness(file);
    const cached = api.cachedMoves = { positionId: 4, meta: { analysisId: 8 }, qualityRank: 50 };
    api.apply(state, { best: move("e2e4"), meta: { positionId: 4, analysisId: 8 } }, true);
    assert.equal(api.cachedMoves, cached);
    api.apply(state, { best: move("d2d4"), engineMeta: {}, meta: { positionId: 4, analysisId: 7 } }, true);
    assert.equal(api.cachedMoves, cached);
  });

  test(`${file}: sole legal move is not presented or executed as an alternative`, () => {
    const api = createHarness(file);
    const best = move("a1b1");
    api.apply(state, { best, average: best, meta: { positionId: 4, analysisId: 8 } });
    assert.equal(api.cachedMoves.average, null);
    api.averageClick();
    assert.equal(api.executed, 0);
    api.cachedMoves.average = move("d2d4");
    api.averageClick();
    assert.equal(api.executed, 1);
  });
}
