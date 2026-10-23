// Draws store screenshots 4 (Home) and 5 (Saved), 1280 x 800, into store/screenshots: the real extension on a
// test page, with a fake model and some saved things so Home and Saved have something to show.
//   tests/e2e/run.sh screenshots.ts
// Screenshots 1 to 3 are real eBay and Marketplace captures (store/LISTING.md); this doesn't touch them.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const OUT = new URL("../../store/screenshots/", import.meta.url).pathname;
await Deno.mkdir(OUT, { recursive: true });
const NOW = Date.now(), DAY = 864e5;
const days: Record<string, unknown> = {};
for (let i = 0; i < 30; i++) if (i % 2 === 0 || i < 5) {
  const usd = 0.01 + ((i * 7) % 9) * 0.004;
  days[new Date(NOW - i * DAY).toLocaleDateString("en-CA")] = { usd, calls: 2 + (i % 4), models: { "claude-haiku-5-5": { usd, calls: 2 + (i % 4) } } };
}
const seed = {
  useAI: true, anthropicKey: "sk-ant-test", anthropicUrl: "http://localhost:1234", useSoldComps: false, introDone: true, theme: "dark", provider: "anthropic",
  anthropicScanModel: "claude-haiku-5-5", anthropicModel: "claude-sonnet-5-5", usage: { days }, monthlyBudget: 5, alertsAck: {},
  saved: {
    "ebay:100000000001": { t: "Nintendo Game Boy Advance SP AGS-001 Cobalt Blue Working", u: "https://www.ebay.com/itm/100000000001", p0: 70, a0: NOW - 9 * DAY, p: 52, a: NOW - DAY },
    "ebay:100000000002": { t: "Game Boy Advance SP Pearl Blue w/ charger", u: "https://www.ebay.com/itm/100000000002", p0: 79, a0: NOW - 5 * DAY, p: 79, a: NOW - DAY },
    "fb:991": { t: "Super Nintendo console with 2 controllers", u: "https://www.facebook.com/marketplace/item/991/", p0: 120, a0: NOW - 3 * DAY, p: 95, a: NOW - 2 * DAY },
  },
  savedSearches: {
    "ebay|game boy sp": { site: "ebay", q: "game boy sp", url: "https://www.ebay.com/sch/i.html?_nkw=game+boy+sp", a0: NOW - 8 * DAY, v: NOW - 2 * DAY, n: 48, fresh: 3, deal: 60, deals: 4 },
    "facebook|snes": { site: "facebook", q: "snes", url: "https://www.facebook.com/marketplace/search?query=snes", a0: NOW - 6 * DAY, v: NOW - 6 * DAY, n: 30, fresh: 0, deal: 80, deals: 0 },
  },
  listingMemory: { "ebay:100000000001": { p: 52, pa: NOW - 1 * DAY, f: NOW - 9 * DAY, a: NOW - DAY, h: [[85, NOW - 9 * DAY], [78, NOW - 8 * DAY], [70, NOW - 6 * DAY]] } },
  stats: { since: NOW - 12 * DAY, scans: 14, soldLookups: 9, analyses: 3, saves: 6, hides: 11, ideas: 2, photoChecks: 4, flipSwitches: 1 },
};
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set(${JSON.stringify(seed)})`);
const size = async (p: any) => { await c.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, p.sessionId); await sleep(300); };
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host').shadowRoot; ${js}})()`);
const shot = (p: any, name: string) => p.shot(`${OUT}${name}`, { x: 0, y: 0, width: 1280, height: 800 });

// 4. Home, 5. Saved, after a scan so the page behind has tags
const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await size(p); await sleep(3000);
await R(p, `r.querySelector('[data-act=tab]').click()`); await sleep(500);
await R(p, `r.querySelector('[data-act=scan]').click()`); await sleep(2800);
await R(p, `r.querySelector('[data-view=home]').click()`); await sleep(800);
await shot(p, "4-home.png");
await R(p, `r.querySelector('[data-view=saved]').click()`); await sleep(500);
await shot(p, "5-saved.png");
console.log("wrote 4-home.png and 5-saved.png to store/screenshots");
c.close();
