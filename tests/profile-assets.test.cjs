"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function load() {
  const context = { window: {}, chrome: { runtime: { id: "fixture" } }, URL };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../lib/privacy-mask.js"), "utf8"), context);
  return context.window.ChessCoachPrivacyMask;
}

test("built-in profiles use generated artwork rather than unverified portrait files", () => {
  const api = load();
  for (const profile of api.profiles) {
    assert.equal(profile.avatarUrl, "");
    assert.equal(profile.avatarPath, undefined);
    assert.ok(api.makeGeneratedAvatar(profile.nickname).startsWith("data:image/svg+xml;"));
  }
});

test("saved bundled portraits fall back without breaking user-supplied avatars", () => {
  const api = load();
  const normalized = api.normalizeConfig({ my: { nickname: "Example", avatarUrl: "chrome-extension://fixture/assets/profiles/magnus.jpg" } });
  assert.equal(normalized.my.avatarUrl, "");
  assert.equal(normalized.my.nickname, "Example");
  assert.equal(api.sanitizeAvatarUrl("https://example.com/my-authorized-image.png"), "https://example.com/my-authorized-image.png");
  assert.equal(api.sanitizeAvatarUrl("data:image/png;base64,test"), "data:image/png;base64,test");
});
