"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist/chesscoach-extension");
// Explicit inputs keep the separate Android checkout, keys and test outputs out of distribution.
const inputs = ["manifest.json", "LICENSE", "README.md", "CHESSCOACH_API_DOCS.md", "background", "content", "data", "lib", "offscreen", "pages", "vendor", "scripts/sample.js"];

async function main() {
  for (const entry of inputs) await fs.access(path.join(root, entry));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output);
  for (const entry of inputs) {
    await fs.cp(path.join(root, entry), path.join(output, entry), {
      recursive: true,
      filter: source => !/(?:^|[\\/])\.[^\\/]+$|\.(?:log|tmp|bak|chess|jks|keystore|p12|pfx)$/i.test(source)
    });
  }
  const manifest = JSON.parse(await fs.readFile(path.join(output, "manifest.json"), "utf8"));
  const runtimeFiles = [manifest.background.service_worker, manifest.options_page,
    ...manifest.content_scripts.flatMap(entry => entry.js), "content/content.css", "pages/credits.css",
    "lib/stockfish-local.js", "vendor/stockfish/stockfish-19-single.wasm"];
  for (const file of runtimeFiles) await fs.access(path.join(output, file));
  console.log(`Prepared ChessCoach ${manifest.version}: ${output}`);
  console.log("Load this folder unpacked or ZIP its contents. Android files and local credentials are not included.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
