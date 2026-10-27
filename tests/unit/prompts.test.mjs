import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadScripts } from "../helpers/load.mjs";

// background.js's prompt text, with a chrome.* that does nothing (as tests/eval/model.mjs loads it).
const { R } = await loadScripts();
const noop = () => {};
const events = { addListener: noop };
globalThis.importScripts = noop;
globalThis.chrome = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, onChanged: events },
  runtime: { onMessage: events, onInstalled: events, onStartup: events, getURL: (p) => p, id: "unit" },
  contextMenus: { removeAll: noop, create: noop, onClicked: events },
  action: { onClicked: events },
  tabs: { query: async () => [], onRemoved: events, onUpdated: events },
  alarms: { create: noop, clear: noop, onAlarm: events },
};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
(0, eval)(fs.readFileSync(path.join(ROOT, "background.js"), "utf8"));

const market = { median: 200, p25: 150, p75: 240, n: 52, confidence: "fair", variants: {
  _same: ["@switch"],
  "lite/*/*": { median: 95, p10: 80, p25: 88, p75: 102, n: 14, confidence: "fair" },
  "/*/*": { median: 165, p10: 140, p25: 155, p75: 175, n: 22, confidence: "good" },
} };

test("scan prompt: a listing compared with its own version says so, with that version's median", () => {
  const lite = R.forVariant(market, { title: "Nintendo Switch Lite Coral" });
  const line = globalThis.priceNotesText({ vsWorking: 0.9, refKind: lite.variantWords.join(" ") || "plain", refN: lite.n, refWorking: lite.median });
  assert.deepEqual(line, ["90% of working median for its version (lite: $95, 14 sales)"]);
  const plain = globalThis.priceNotesText({ vsWorking: 1, refKind: "plain", refN: 22, refWorking: 165, pickupShip: 14 });
  assert.deepEqual(plain, ["100% of working median for its version (sales that name no other version: $165, 22 sales) less $14 typical shipping (local pickup)"]);
  assert.deepEqual(globalThis.priceNotesText({ vsWorking: 0.5 }), ["50% of working median"], "against the whole search: as before");
  assert.match(globalThis.marketText("nintendo switch", market), /These sales mix versions/);
  assert.doesNotMatch(globalThis.marketText("ps5", { median: 330, p25: 300, p75: 360, n: 55, confidence: "good" }), /mix versions/);
});

test("Analyze prompt: a market for one version names it", () => {
  const t = globalThis.marketText("iphone 13", R.forVariant({ median: 320, p25: 280, p75: 400, n: 60, confidence: "good", variants: { _same: ["gen 13", "@iphone"], "pro/*/256gb": { median: 480, p25: 460, p75: 500, n: 9, confidence: "fair" } } }, { title: "Apple iPhone 13 Pro 256GB" }));
  assert.match(t, /^Sold-price reference for "iphone 13" that are the same version as this listing \(pro, 256GB\) .*median \$480/);
  assert.doesNotMatch(t, /mix versions/, "one version's numbers: no note about the mix");
});
