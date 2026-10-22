// Every state the panel can be in when things don't go to plan, on the real extension: what it says,
// and whether it offers the way out. Rejected key, rate limit, an answer cut off, no connection, out of
// credit, a key without access, overload, a fault on the API's side, an answer that isn't JSON, no AI set
// up, sold prices that can't be had (none sold, eBay's check, offline), a search with no results, the
// budget used up, a scan under way and stopped, a page with nothing to scan, and Delete everything in
// settings. Prints PASS/FAIL lines; with STATES_OUT=dir it also saves a screenshot of each.
//   tests/e2e/run.sh states.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
const OUT = Deno.env.get("STATES_OUT");
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const store = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const closeAll = async () => {
  const { targetInfos } = await c.send("Target.getTargets");
  for (const t of targetInfos) if (t.type === "page" && /www\.(ebay|facebook)\.com/.test(t.url)) await c.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
};
const reset = async (extra: string) => {
  await closeAll();
  await o.ev(`chrome.storage.local.clear()`);
  await store(`{anthropicUrl:'${API}', useSoldComps:false, introDone:true, ...${extra}}`);
};
const shot = async (p: any, name: string) => {
  if (!OUT) return;
  await c.send("Target.activateTarget", { targetId: p.targetId });
  const [vw, vh] = await p.ev(`[innerWidth, innerHeight]`);
  // not a full-page capture: that resizes the page for a moment, which moves the panel's scroll
  const r = await c.send("Page.captureScreenshot", { format: "png", clip: { x: vw - 440, y: 0, width: 440, height: vh, scale: 1 } }, p.sessionId);
  await Deno.writeFile(`${OUT}/${name}.png`, Uint8Array.from(atob(r.data), (x) => x.charCodeAt(0)));
};
const SEARCH = "https://www.ebay.com/sch/i.html?_nkw=pentax+k1000";
const openPanel = async (url: string) => {
  const p = await open(url);
  await c.send("Target.activateTarget", { targetId: p.targetId }); // as you'd see it: the tab in front
  await sleep(1200);
  await R(p, `r.querySelector('[data-act=tab]').click()`);
  await sleep(400);
  return p;
};
const inView = (p: any, sel: string) => R(p, `const b=r.querySelector('.body').getBoundingClientRect(), e=r.querySelector('${sel}').getBoundingClientRect(); return e.height > 0 && e.top >= b.top && e.bottom <= b.bottom ? true : JSON.stringify({body:[b.top, b.bottom], el:[e.top, e.bottom]})`);
// What the status line says, and the label of its button if it has one.
const status = (p: any) => R(p, `const s=r.querySelector('.view-page .status'); return [s.textContent, s.classList.contains('err'), s.querySelector('button')?.textContent || '']`);
// Scan, then wait for the panel to finish (a 429 is retried twice, quietly, before it's reported).
const scanAndRead = async (p: any) => {
  await R(p, `r.querySelector('[data-act=scan]').click()`);
  await sleep(600);
  for (let i = 0; i < 40 && (await R(p, `return r.querySelector('.wrap').classList.contains('busy')`)); i++) await sleep(500);
  await sleep(300);
  return status(p);
};

// ---- errors from the model's service ----
const cases: [string, string, RegExp, string][] = [
  ["a rejected key", `{anthropicKey:'bad'}`, /didn't accept that key/, "Open settings"],
  ["a rate limit", `{anthropicKey:'ratelimit'}`, /short break/, ""],
  ["an answer cut off", `{anthropicKey:'cutoff'}`, /cut off/, "Open settings"],
  ["no connection", `{anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:9'}`, /Can't reach/, ""],
  // The API's own error bodies are JSON: the panel says what happened in words, never the raw body.
  ["out of credit", `{anthropicKey:'nocredit'}`, /^Your Anthropic account is out of credit\. Add some under Plans & Billing/, ""],
  ["a key without access", `{anthropicKey:'forbidden'}`, /^The Claude API won't let that key do this \(Your API key does not have permission[^{]*\)\. Check the key/, "Open settings"],
  ["overloaded", `{anthropicKey:'overloaded'}`, /overloaded right now/, ""],
  ["a fault on the API's side", `{anthropicKey:'servererror'}`, /^The Claude API had a problem on its side \(error 500\)\. Try again in a minute\.$/, ""],
  ["an answer that isn't JSON", `{anthropicKey:'garbage'}`, /didn't make sense/, "Open settings"],
];
for (const [name, extra, says, fix] of cases) {
  await reset(extra);
  const p = await openPanel(SEARCH);
  const [text, err, btn] = await scanAndRead(p);
  await shot(p, `error_${name.replace(/\W+/g, "_")}`);
  ok(`${name}: says so plainly`, says.test(text) && err && !/[{}]/.test(text), text);
  const seen = await inView(p, ".view-page .statusrow");
  ok(`${name}: the message is in view, not scrolled away`, seen === true, seen);
  ok(`${name}: ${fix ? `offers ${fix}` : "no fix button (Scan again is the retry)"}`, btn === fix, btn || "none");
  ok(`${name}: Scan is still there to try again`, await R(p, `return !r.querySelector('[data-act=scan]').hidden`));
}

// ---- no AI set up at all: the free parts work, and Scan isn't offered ----
await reset(`{useSoldComps:true}`);
{
  const p = await openPanel(SEARCH);
  const ui = await R(p, `const s=r.querySelector('[data-act=scan]'); return [s.offsetHeight === 0, !r.querySelector('.setup').hidden, r.querySelector('.setup').textContent, r.querySelector('.setup button')?.textContent]`);
  await shot(p, "no_ai");
  ok("no AI yet: no Scan button, and the setup card says what's free and where to add one", ui[0] && ui[1] && /work without one/.test(ui[2]) && ui[3] === "Open settings", ui);
  await R(p, `r.querySelector('[data-act=prices]').click()`);
  await sleep(600);
  for (let i = 0; i < 20 && (await R(p, `return r.querySelector('.wrap').classList.contains('busy')`)); i++) await sleep(500);
  const m = await R(p, `return r.querySelector('.market').textContent`);
  ok("no AI yet: Typical price still works", /Typical price/.test(m), m.slice(0, 80));
}

// ---- sold prices that can't be had: none sold, eBay's check, offline ----
for (const [name, q, says] of [
  ["no sales at all", "nosales camera", /Not enough eBay sales/],
  ["eBay asks for a browser check", "blockme", /paused \d+ min \(eBay asked for a browser check\)/],
] as [string, string, RegExp][]) {
  // Both pages list the same items: give the last tab's remembered scores time to land before clearing
  // storage, or this page restores them and has nothing new to scan.
  await closeAll();
  await sleep(1500);
  await reset(`{anthropicKey:'sk-ant-test', useSoldComps:true}`);
  const p = await openPanel(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`);
  const [text, err] = await scanAndRead(p);
  const m = await R(p, `return r.querySelector('.market').textContent`);
  await shot(p, `sold_${name.replace(/\W+/g, "_")}`);
  ok(`sold prices, ${name}: the price box says so`, says.test(m), m);
  ok(`sold prices, ${name}: the scan still scores the listings`, /Scored \d+/.test(text) && !err, text);
}
await reset(`{anthropicKey:'sk-ant-test', useSoldComps:true}`);
{
  const p = await openPanel(SEARCH);
  await c.send("Network.enable", {}, p.sessionId);
  await c.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, p.sessionId);
  await R(p, `r.querySelector('[data-act=prices]').click()`);
  await sleep(600);
  for (let i = 0; i < 20 && (await R(p, `return r.querySelector('.wrap').classList.contains('busy')`)); i++) await sleep(500);
  const m = await R(p, `return [r.querySelector('.market').textContent, r.querySelector('.market a')?.textContent]`);
  await c.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, p.sessionId);
  ok("sold prices offline: says so, and links eBay's own sold search", /offline|Couldn't reach eBay/.test(m[0]) && m[1] === "See sold listings on eBay", m);
}

// ---- a search with no results ----
await reset(`{anthropicKey:'sk-ant-test'}`);
{
  const p = await openPanel(SEARCH + "&none=1");
  const [text, err, btn] = await scanAndRead(p);
  const warn = await R(p, `return r.querySelector('.readwarn').hidden`);
  await shot(p, "empty_search");
  ok("a search with no results: says the site found nothing, not that its layout changed", /^eBay found no listings for this search/.test(text) && !err && !btn, [text, btn]);
  ok("…and no layout warning", warn);
  const health = await o.ev(`chrome.storage.local.get('siteHealth').then(v => v.siteHealth?.ebay || null)`);
  ok("…and Home isn't told eBay looks broken", !health?.bad, health);
}

// ---- the budget used up ----
await reset(`{anthropicKey:'sk-ant-test', monthlyBudget:0.0001, usage:{days:{[new Date().toLocaleDateString('en-CA')]:{usd:0.01}}}}`); // usage is kept by local day
{
  const p = await openPanel(SEARCH);
  const [text, err, btn] = await scanAndRead(p);
  await shot(p, "error_budget");
  ok("the budget used up: says how much and what to do", /budget of \$0\.0001 is used up/.test(text) && err, text);
  ok("the budget used up: offers Open settings", btn === "Open settings", btn || "none");
  ok("the budget used up: the message is in view", await inView(p, ".view-page .statusrow"));
}

// ---- automatic scanning, on eBay and on Marketplace, without pressing Scan ----
for (const [site, url] of [["eBay", SEARCH], ["Marketplace", "https://www.facebook.com/marketplace/albuquerque/search?query=film+camera"]]) {
  await reset(`{anthropicKey:'sk-ant-test', autoScan:true, monthlyBudget:5}`);
  await fetch(`${API}/calls`, { method: "DELETE" });
  const p = await open(url); // the panel stays closed: the tags on the cards are the point
  await c.send("Target.activateTarget", { targetId: p.targetId });
  let tags = 0;
  for (let i = 0; i < 24 && !tags; i++) {
    await sleep(500);
    tags = await p.ev(`document.querySelectorAll('.tirekick-sticker').length`);
  }
  const calls = (await (await fetch(`${API}/calls`)).json()).length;
  ok(`${site}: with Scan automatically on, the cards get scores without a press`, tags > 0, { tags, calls });
  await sleep(5000);
  const again = (await (await fetch(`${API}/calls`)).json()).length;
  ok(`${site}: …once: nothing new, nothing sent again`, again === calls, { calls, again });
}
await reset(`{anthropicKey:'bad', autoScan:true}`);
await fetch(`${API}/calls`, { method: "DELETE" });
{
  const p = await open(SEARCH);
  await c.send("Target.activateTarget", { targetId: p.targetId });
  await sleep(9000);
  const badge = await R(p, `const b=r.querySelector('.count'); return [b.hidden, b.textContent, b.title]`);
  ok("automatic scanning stops at a problem and says so on the closed tab", !badge[0] && badge[1] === "!" && /didn't accept/.test(badge[2]), badge);
  await R(p, `r.querySelector('[data-act=tab]').click()`);
  await sleep(400);
  const [, err] = await status(p);
  ok("…and the panel has the message", err);
}

// ---- a scan under way, then Stop ----
await reset(`{anthropicKey:'slow'}`);
{
  const p = await openPanel(SEARCH);
  await R(p, `r.querySelector('[data-act=scan]').click()`);
  await sleep(1200);
  const busy = await R(p, `return [r.querySelector('.wrap').classList.contains('busy'), !r.querySelector('.stopbtn').hidden, !r.querySelector('.progress').hidden, r.querySelector('.view-page .status').textContent]`);
  await shot(p, "busy_scanning");
  ok("scanning: says what it's doing, with Stop and the progress line", busy[0] && busy[1] && busy[2] && busy[3].length > 0, busy);
  await R(p, `r.querySelector('.stopbtn').click()`);
  await sleep(1500);
  const after = await R(p, `return [r.querySelector('.wrap').classList.contains('busy'), r.querySelector('.stopbtn').hidden, r.querySelector('.view-page .status').textContent]`);
  await shot(p, "busy_stopped");
  ok("Stop: the work stops and the panel says so", !after[0] && after[1] && /stop/i.test(after[2]), after);
}

// ---- a page with nothing to scan ----
await reset(`{anthropicKey:'sk-ant-test'}`);
{
  const p = await openPanel("https://www.ebay.com/help/nothing-here");
  const s = await R(p, `return [r.querySelector('[data-view=home]').getAttribute('aria-selected'), r.querySelector('[data-act=scan]').hidden]`);
  await shot(p, "empty_other_page");
  ok("a page that isn't a search or a listing: opens on Home, with no Scan", s[0] === "true" && s[1], s);
  await R(p, `r.querySelector('[data-view=page]').click()`);
  await sleep(300);
  const note = await R(p, `const n=r.querySelector('.other-note'); return n.offsetHeight > 0 && /Open a search/.test(n.textContent)`);
  ok("…and This page says what to open", note);
}

// ---- empty Saved and Home ----
{
  const p = await openPanel(SEARCH);
  await R(p, `r.querySelector('[data-view=saved]').click()`);
  await sleep(400);
  const saved = await R(p, `return r.querySelector('.saved-body').textContent`);
  await shot(p, "empty_saved");
  ok("Saved, empty: says how things get there", /press Save/.test(saved), saved.slice(0, 80));
  await R(p, `r.querySelector('[data-view=home]').click()`);
  await sleep(700);
  const home = await R(p, `return r.querySelector('.view-home').textContent`);
  await shot(p, "empty_home");
  ok("Home, empty: says what will show up", /Nothing new/.test(home), home.slice(0, 80));
}

// ---- Delete everything ----
await store(`{anthropicKey:'sk-ant-test', saved:{'ebay:1':{t:'x',u:'https://www.ebay.com/itm/1',p:1,p0:1,a:1,a0:1}}}`);
{
  const s = await open(`chrome-extension://${EXT}/options/options.html`);
  await sleep(600);
  await s.ev(`window.confirm = () => false; document.getElementById('wipeAll').click()`);
  await sleep(400);
  const kept = await s.ev(`chrome.storage.local.get(null).then(v=>Object.keys(v).length)`);
  ok("Delete everything: canceling the question keeps everything", kept > 0, kept);
  await s.ev(`window.confirm = () => true; document.getElementById('wipeAll').click()`);
  await sleep(1200);
  const left = await o.ev(`chrome.storage.local.get(null).then(v=>Object.keys(v))`);
  ok("Delete everything: nothing is left, keys included", Array.isArray(left) && !left.length, left);
}

console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
