"use strict";

// Offline, finite Chrome check of the real page/CSS, not a remote deployment.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const root = path.resolve(__dirname, "..");
const chromePath = process.env.CC_BROWSER_CHROME || (process.platform === "win32" ? path.join(process.env.ProgramFiles || "C:\\Program Files", "Google/Chrome/Application/chrome.exe") : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome");
const tempParent = process.env.CC_BROWSER_TEMP || os.tmpdir();
const viewports = [[320, 568], [390, 844], [640, 360], [768, 1024], [1280, 800]];
const pages = process.argv.slice(2).length ? process.argv.slice(2).map(file => path.resolve(file)) : [path.join(root, "pages/credits.html")];

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.requests = [];
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Network.requestWillBeSent") this.requests.push(message.params.request.url);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result || {});
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error("CDP closed")); }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

async function main() {
  await fs.access(chromePath);
  await fs.access(tempParent);
  for (const page of pages) await fs.access(page);
  const reportDir = await fs.mkdtemp(path.join(tempParent, "cc-credits-"));
  const profileDir = path.join(reportDir, "profile");
  const browser = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-extensions", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
  let socket, cdp;
  try {
    const debuggingUrl = await new Promise((resolve, reject) => {
      let text = "";
      const timer = setTimeout(() => reject(new Error("Chrome startup timed out")), 20000);
      browser.on("error", error => { clearTimeout(timer); reject(error); });
      browser.stderr.on("data", chunk => {
        text += chunk;
        const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(debuggingUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP startup timed out")), 15000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP startup failed")); }, { once: true });
    });
    cdp = new CDP(socket);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    const evaluate = async expression => {
      const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    let checks = 0;
    for (const [index, page] of pages.entries()) {
      const url = pathToFileURL(page).href;
      await cdp.send("Page.navigate", { url }, sessionId);
      await evaluate(`new Promise((resolve, reject) => { const deadline = Date.now() + 10000; const ready = () => { if (location.href === ${JSON.stringify(url)} && document.readyState === 'complete') resolve(true); else if (Date.now() > deadline) reject(new Error('Page did not load')); else setTimeout(ready, 25); }; ready(); })`);
      for (const [width, height] of viewports) {
        await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 }, sessionId);
        const result = await evaluate(`(() => {
          const cards = [...document.querySelectorAll('.credit')];
          const bounds = cards.map(card => { const rect = card.getBoundingClientRect(); return { width: rect.width, left: rect.left, right: rect.right }; });
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, sheetLoaded: getComputedStyle(document.documentElement).getPropertyValue('--green').trim() === '#bee0bd', headingFont: getComputedStyle(document.querySelector('h1')).fontFamily, names: cards.map(card => card.querySelector('.credit-name').textContent), bounds, links: [...document.querySelectorAll('a[href^="https:"]')].map(link => link.href) };
        })()`);
        assert.ok(result.scrollWidth <= width + 1, `Horizontal overflow ${width}: ${JSON.stringify(result)}`);
        assert.ok(result.sheetLoaded, "Packaged CSS was not loaded");
        assert.ok(result.headingFont.includes("Georgia"), "Editorial heading font missing");
        assert.deepEqual(result.names, ["@norbza", "@ahahebe", "@axlainter"]);
        assert.ok(result.bounds.every(rect => rect.width > 200 && rect.left >= 0 && rect.right <= width + 1));
        assert.ok(result.links.includes("https://t.me/chesscoach_dev"));
        checks++;
        if (index === 0 && (width === 390 || width === 1280)) {
          const metrics = await cdp.send("Page.getLayoutMetrics", {}, sessionId);
          const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } }, sessionId);
          await fs.writeFile(path.join(reportDir, `credits-${width}.png`), Buffer.from(screenshot.data, "base64"));
        }
      }
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.credit')).transitionDuration"), "0s");
      assert.equal(await evaluate("document.querySelector('.primary-link').focus(); getComputedStyle(document.activeElement).outlineStyle"), "solid");
      await cdp.send("Emulation.setEmulatedMedia", { features: [] }, sessionId);
      checks += 2;
    }
    assert.ok(cdp.requests.every(url => url.startsWith("file:") || url === "about:blank" || url.startsWith("data:")), `Unexpected network request: ${cdp.requests.join(", ")}`);
    console.log(`PASS: ${checks} real-page responsive/accessibility checks; no external requests.`);
    console.log(`Screenshots: ${reportDir}`);
  } finally {
    if (cdp) await cdp.send("Browser.close").catch(() => {});
    socket?.close();
    if (browser.exitCode === null) {
      const exited = once(browser, "exit");
      const timer = setTimeout(() => browser.kill(), 5000);
      await exited;
      clearTimeout(timer);
    }
    await fs.rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
