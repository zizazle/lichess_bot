"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

function createBroker() {
  const source = fs.readFileSync(path.join(root, "background/background.js"), "utf8");
  const start = source.indexOf("function openProjectPage(");
  const end = source.indexOf('  if (request?.target === "background-engine"', start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  let handler, action;
  const chrome = {
    runtime: { id: "fixture", getURL: name => `chrome-extension://fixture/${name}`, onMessage: { addListener: listener => { handler = listener; } } },
    tabs: { create: (options, callback) => { calls.push(options); callback(); } },
    action: { onClicked: { addListener: listener => { action = listener; } } }
  };
  vm.runInNewContext(source.slice(start, end) + "\n});", { chrome, URL });
  return { chrome, calls, action: () => action(), send(sender) { let response; const asynchronous = handler({ type: "OPEN_PROJECT_PAGE" }, sender, value => { response = value; }); return { response, asynchronous }; } };
}

test("credits open only a fixed packaged page from valid main-frame content scripts", () => {
  const broker = createBroker();
  for (const url of ["https://lichess.org/", "https://www.chess.com/login", "https://chess.com:443/play"]) {
    const result = broker.send({ id: "fixture", frameId: 0, url });
    assert.equal(result.response.ok, true);
    assert.equal(result.asynchronous, true);
  }
  assert.ok(broker.calls.every(call => call.url === "chrome-extension://fixture/pages/credits.html"));
});

test("credits broker rejects injected frames and spoofed or unsafe source URLs", () => {
  const broker = createBroker();
  for (const sender of [
    { id: "other", frameId: 0, url: "https://lichess.org/" },
    { id: "fixture", frameId: 1, url: "https://www.chess.com/" },
    { id: "fixture", frameId: 0, url: "https://www.chess.com.attacker.test/" },
    { id: "fixture", frameId: 0, url: "https://user@www.chess.com/" },
    { id: "fixture", frameId: 0, url: "http://www.chess.com/" },
    { id: "fixture", frameId: 0, url: "https://www.chess.com:444/" },
    { id: "fixture", frameId: 0 }
  ]) assert.equal(broker.send(sender).response.ok, false);
  assert.equal(broker.calls.length, 0);
});

test("toolbar action opens credits without navigating a game tab", () => {
  const broker = createBroker();
  broker.action();
  assert.equal(broker.calls.length, 1);
  assert.equal(broker.calls[0].url, "chrome-extension://fixture/pages/credits.html");
});

test("credits contain every requested acknowledgment and no remote executable assets", () => {
  const html = fs.readFileSync(path.join(root, "pages/credits.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "pages/credits.css"), "utf8");
  for (const name of ["norbza", "ahahebe", "axlainter", "chesscoach_dev"]) assert.ok(html.includes(`https://t.me/${name}`));
  assert.ok(html.includes("lang=\"ru\""));
  assert.ok(html.includes("style-src 'self'"));
  assert.ok(!/<script\b|<iframe\b|<link[^>]+https?:|@import|url\([\s'\"]*https?:/i.test(html + css));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(css.includes("focus-visible"));
});

test("official attribution is outside mode and tab content on both supported sites", () => {
  for (const file of ["content.js", "chesscom.js"]) {
    const source = fs.readFileSync(path.join(root, "content", file), "utf8");
    const strip = source.indexOf('id="cc-project-strip"');
    assert.ok(strip > source.indexOf('id="chesscoach-header"'));
    assert.ok(strip < source.indexOf('id="cc-mode-switcher-bar"'));
    assert.ok(strip < source.indexOf('id="chesscoach-workspace"'));
    assert.ok(source.includes('safeSendMessage({ type: "OPEN_PROJECT_PAGE" }'));
  }
});
