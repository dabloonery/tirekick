// The eval with the real prompts: the scan prompt (background.js rankBatch) on the eval's cheap listings and the
// scams that look like them, through the Claude API, then the same price check the panel runs on its answer.
// It costs money and the answers vary, so it never runs in CI or in `deno task test`: run it by hand after a
// prompt change.
//   ANTHROPIC_API_KEY=... deno task eval:model
//   EVAL_MODEL=claude-sonnet-5-5   another scan model (default: the extension's, Haiku)
//   EVAL_LIMIT=10                  only the first N listings
//   EVAL_API_URL=http://localhost:1234   a stand-in server (tests/e2e/server.ts) to try the script for free
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCases } from "./pipeline.mjs";
import { MARKETS } from "./cases.mjs";

const key = Deno.env.get("ANTHROPIC_API_KEY");
const base = Deno.env.get("EVAL_API_URL");
if (!key && !base) {
  console.log("Set ANTHROPIC_API_KEY to run the eval with the real prompts (it calls the Claude API and costs a little).");
  Deno.exit(0);
}
const R = globalThis.TKRules; // loaded by pipeline.mjs

// background.js as the browser runs it, with a chrome.* that only stores settings in memory.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const store = {};
const noop = () => {};
const events = { addListener: noop };
globalThis.importScripts = noop; // lib/sites.js and lib/shared.js are loaded already
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (k && typeof k === "object" && !Array.isArray(k) ? { ...k, ...store } : typeof k === "string" ? { [k]: store[k] } : { ...store }),
      set: async (o) => void Object.assign(store, o),
      remove: async () => {},
    },
    onChanged: events,
  },
  runtime: { onMessage: events, onInstalled: events, onStartup: events, getURL: (p) => p, id: "eval" },
  contextMenus: { removeAll: noop, create: noop, onClicked: events },
  action: { onClicked: events },
  tabs: { query: async () => [], onRemoved: events, onUpdated: events },
  alarms: { create: noop, clear: noop, onAlarm: events },
  permissions: { onAdded: events, onRemoved: events, contains: async () => false },
  scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, unregisterContentScripts: async () => {} },
};
Object.assign(store, { anthropicKey: key || "stand-in", ...(base && { anthropicUrl: base }), ...(Deno.env.get("EVAL_MODEL") && { anthropicScanModel: Deno.env.get("EVAL_MODEL") }) });
(0, eval)(Deno.readTextFileSync(path.join(ROOT, "background.js")));

// The listings where the model's reason matters: the honest cheap ones and the scams that tell the same stories.
const limit = +Deno.env.get("EVAL_LIMIT") || Infinity;
const rows = runCases().filter((r) => r.c.cheapWhy).slice(0, limit);
const byQuery = Map.groupBy(rows, (r) => r.c.query);
const out = [];
let cost = 0;
for (const [query, list] of byQuery) {
  const m = MARKETS[query];
  const market = { p25: Math.round(m.median * 0.85), p75: Math.round(m.median * 1.15), ...m };
  const items = list.map((r, i) => {
    const mk = R.forPickup(market, r.f, r.c.site === "facebook");
    const own = R.forVariant(market, r.f); // the version's own sales, as the panel's priceNotes sends them
    return {
      refKind: own.variantUsed ? own.variantWords.join(" ") || "plain" : "",
      refN: own.n,
      refWorking: own.median,
      ...r.f,
      id: i + 1,
      site: r.c.site,
      raw: [r.c.title, r.c.text, r.c.page].filter(Boolean).join(" "),
      vsWorking: r.f.vsSold,
      pickupShip: mk.pickupShip || 0,
      cheapPct: (r.f.vsSold != null && R.tooCheap(r.f, mk)?.pct) || 0,
    };
  });
  const res = await globalThis.rankBatch({ items, query, market });
  cost += res.cost || 0;
  for (const a of res.items) {
    const r = list[a.id - 1];
    if (!r) continue;
    const mk = R.forPickup(market, r.f, r.c.site === "facebook");
    const shown = R.priceVerdict(a.verdict, { ...r.f, score: a.score, cheapWhy: a.cheapWhy }, mk).v;
    const ok = r.c.truth === "scam" ? shown === "suspicious" || shown === "pass" : (shown === "suspicious") === (r.c.shown === "suspicious");
    out.push({ r, a, shown, ok });
  }
}

const bad = out.filter((x) => !x.ok);
const why = out.filter((x) => x.a.cheapWhy === x.r.c.cheapWhy).length;
console.log(`The scan prompt on ${out.length} listings ($${cost.toFixed(3)}):`);
console.log(`  scams still a warning after the price check: ${out.filter((x) => x.r.c.truth === "scam" && x.ok).length} of ${out.filter((x) => x.r.c.truth === "scam").length}`);
console.log(`  honest cheap listings as labeled (warning or not): ${out.filter((x) => x.r.c.truth !== "scam" && x.ok).length} of ${out.filter((x) => x.r.c.truth !== "scam").length}`);
console.log(`  cheapWhy as labeled: ${why} of ${out.length}`);
for (const x of bad) console.log(`  NOT AS LABELED: "${x.r.c.title}" [${x.r.c.query}] ${x.r.c.truth}: model ${x.a.verdict} (${x.a.score}), cheapWhy ${x.a.cheapWhy}, shown ${x.shown}. ${x.a.reason}`);
